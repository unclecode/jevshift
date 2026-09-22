/** Pure, bounded context construction. No filesystem, network, or transcript mutation. */
export type Message = {
  role: 'user' | 'assistant'; text: string;
  toolUses?: readonly { tool_use_id: string; tool: string; text?: string; isError?: boolean }[];
  toolResults?: readonly { tool_use_id: string; text: string; isError: boolean }[];
};
export type RequestEvidence = { text: string; origin: 'composer' | 'bridge' | 'sdk'; generation: number; instructionId?: number };
export type ContextSnapshot = {
  state: string | null;
  meta: { version: 1; ready: boolean; reason: string; bytes: number; serializedBytes: number; generation: number; instructionId: number;
    messagesIncluded: number; toolsIncluded: number; redactions: number; truncated: boolean };
};
export const LIMITS = Object.freeze({ bytes: 7000, serializedBytes: 7000, scanToolsPerMessage: 32, inputChars: 65536, scanMessages: 64,
  recentMessages: 6, requestBytes: 1600, messageBytes: 350, planBytes: 1100,
  tools: 3, toolBytes: 650 });

export function bytes(s: string): number {
  let n = 0;
  for (const c of s) { const p = c.codePointAt(0)!; n += p <= 0x7f ? 1 : p <= 0x7ff ? 2 : p <= 0xffff ? 3 : 4; }
  return n;
}
function prefix(s: string, budget: number): string {
  let result = '', n = 0;
  for (const c of s) { const size = bytes(c); if (n + size > budget) break; result += c; n += size; }
  return result;
}
function excerpt(s: string, budget: number): string {
  if (bytes(s) <= budget) return s;
  const mark = '\n[excerpt clipped]\n', head = Math.floor((budget - bytes(mark)) * .72);
  // Input is sanitized before cutting, so clipping cannot expose a secret's suffix.
  const tail = Array.from(s).reverse().join('');
  return prefix(s, head) + mark + Array.from(prefix(tail, budget - bytes(mark) - head)).reverse().join('');
}
export function redact(raw: string): { text: string; count: number; oversized: boolean } {
  if (raw.length > LIMITS.inputChars) return { text: '[oversized content omitted]', count: 0, oversized: true };
  let text = raw.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');
  let count = 0;
  const replace = (pattern: RegExp, value: string) => { text = text.replace(pattern, () => { count++; return value; }); };
  replace(/-----BEGIN [^-\n]*PRIVATE KEY-----[\s\S]*?(?:-----END [^-\n]*PRIVATE KEY-----|$)/g, '[REDACTED:private_key]');
  replace(/\b(?:sk-(?:ant-|or-)?[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9_]{16,}|github_pat_[A-Za-z0-9_]{16,}|AIza[A-Za-z0-9_-]{25,}|xox[baprs]-[A-Za-z0-9-]{12,})\b/g, '[REDACTED:credential]');
  replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[REDACTED:jwt]');
  replace(/^(?:cookie|set-cookie)\s*:[^\n]*/gim, '[REDACTED:cookie]');
  replace(/\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, '[REDACTED:authorization]');
  replace(/(?:["']?)(?:[A-Za-z0-9_]*(?:api[_-]?key|access[_-]?token|refresh[_-]?token|secret|password)|authorization|cookie)(?:["']?)\s*[:=]\s*(?:"[^"\n]*"|'[^'\n]*'|[^\s,;\n}]+)/gi, '[REDACTED:secret_assignment]');
  replace(/https?:\/\/[^\s/@:]+:[^\s/@]+@[^\s<>'"]+/gi, '[REDACTED:credential_url]');
  replace(/[?&](?:key|token|secret|password|code|api_key|access_token)=[^\s&#<>"']+/gi, '[REDACTED:query_secret]');
  replace(/[A-Za-z0-9.+_-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[REDACTED:email]');
  replace(/\/(?:Users|home)\/[^/\s<>"']+/g, '[HOME]');
  return { text, count, oversized: false };
}
function xml(s: string): string { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
const planPattern = /(?:^|\n)\s*(?:#{1,4}\s*)?(?:plan|next steps|implementation|approach|design|proposed|agreed|decision)\b|(?:^|\n)\s*(?:\d+[.)]|- \[[ x]\])\s/im;

export function buildContext(messages: readonly Message[], request: RequestEvidence | null): ContextSnapshot {
  const meta: ContextSnapshot['meta'] = { version: 1, ready: false, reason: 'missing_verified_request', bytes: 0, serializedBytes: 0,
    generation: request?.generation ?? 0, instructionId: request?.instructionId ?? request?.generation ?? 0,
    messagesIncluded: 0, toolsIncluded: 0, redactions: 0, truncated: false };
  if (!request || !request.text.trim()) return { state: null, meta };
  if (request.text.length > LIMITS.inputChars) { meta.reason = 'request_too_large'; return { state: null, meta }; }
  const clean = (raw: string, budget: number) => {
    const safe = redact(raw); meta.redactions += safe.count;
    if (safe.oversized || bytes(xml(safe.text)) > budget) meta.truncated = true;
    // Clip escaped text using a raw prefix/tail first, then reduce without breaking entities.
    let rawBudget = budget;
    let cut = excerpt(safe.text, rawBudget);
    while (bytes(xml(cut)) > budget) {
      rawBudget = Math.max(1, Math.floor(rawBudget * .65));
      cut = rawBudget < 24 ? prefix(safe.text, rawBudget) : excerpt(safe.text, rawBudget);
    }
    return xml(cut);
  };
  const current = clean(request.text.trim(), LIMITS.requestBytes);
  const tail = messages.slice(-LIMITS.scanMessages);
  meta.truncated ||= messages.length > tail.length;
  // Exact current request is already represented separately. Tool-only rows are never dialogue.
  const currentIndex = tail.findLastIndex(m => m.role === 'user' && !m.toolResults?.length && m.text.trim() === request.text.trim());
  const dialogue = tail.map((m, i) => ({ m, i })).filter(({ m, i }) => i !== currentIndex && m.text?.trim() && !(m.toolResults?.length));
  const recent = dialogue.slice(-LIMITS.recentMessages);
  meta.truncated ||= dialogue.length > recent.length;
  const history = recent.map(({m}) => `### ${m.role === 'assistant' ? 'Assistant' : 'User-role transcript (origin not retained)'}\n\n${clean(m.text, LIMITS.messageBytes)}`);
  meta.messagesIncluded = history.length;
  // Quote a nearby visible plan, not an invented summary or an arbitrarily old design.
  const candidates = dialogue.slice(-12).filter(({m}) => m.role === 'assistant');
  const plan = candidates.slice(-3).filter(({m}) => planPattern.test(m.text)).at(-1) ?? candidates.at(-1);
  const planText = plan ? clean(plan.m.text, LIMITS.planBytes) : '';
  const calls = new Map<string, {tool: string; text?: string; isError?: boolean; order: number}>();
  const results = new Map<string, {tool: string; text: string; isError: boolean; order: number}>();
  for (let i = 0; i < tail.length; i++) {
    const uses = tail[i].toolUses ?? [], outcomes = tail[i].toolResults ?? [];
    meta.truncated ||= uses.length > LIMITS.scanToolsPerMessage || outcomes.length > LIMITS.scanToolsPerMessage;
    for (const t of uses.slice(-LIMITS.scanToolsPerMessage)) {
      calls.set(t.tool_use_id, {tool: t.tool, text: t.text, isError: t.isError, order: i});
      if (t.text !== undefined) results.set(t.tool_use_id, {tool: t.tool, text: t.text, isError: !!t.isError, order: i});
    }
    for (const t of outcomes.slice(-LIMITS.scanToolsPerMessage)) results.set(t.tool_use_id,
      {tool: calls.get(t.tool_use_id)?.tool ?? 'Tool', text: t.text, isError: t.isError, order: i});
  }
  const selected = [...results.values()].sort((a,b) => a.order-b.order).slice(-LIMITS.tools);
  meta.truncated ||= results.size > selected.length;
  const tools = selected.map(t => `### ${clean(t.tool, 80)} — ${t.isError ? 'error' : 'completed'}\n\n${clean(t.text, LIMITS.toolBytes)}`);
  meta.toolsIncluded = tools.length;
  const section = (name: string, text: string) => `<${name}>\n${text || '(none available)'}\n</${name}>`;
  let state = ['# Claude Code session context', section('current_request', current),
    section('recent_messages', history.join('\n\n')),
    section('work_summary', planText ? 'Visible assistant plan or latest work excerpt; not independently verified.\n\n' + planText : ''),
    section('recent_tool_results', tools.join('\n\n'))].join('\n\n');
  // Whole-section fallback keeps XML valid and gives the current request priority.
  if (bytes(state) > LIMITS.bytes || bytes(JSON.stringify(state)) > LIMITS.serializedBytes) {
    meta.truncated = true; meta.messagesIncluded = 0;
    state = ['# Claude Code session context', section('current_request', current), section('recent_messages','[omitted to fit size limit]'),
      section('work_summary', planText), section('recent_tool_results', tools.join('\n\n'))].join('\n\n');
  }
  if (bytes(state) > LIMITS.bytes || bytes(JSON.stringify(state)) > LIMITS.serializedBytes) { meta.reason = 'size_limit'; return { state: null, meta }; }
  if (bytes(JSON.stringify(state)) > LIMITS.serializedBytes) { meta.reason = 'serialized_size_limit'; return { state: null, meta }; }
  meta.ready = true; meta.reason = 'ready'; meta.bytes = bytes(state); meta.serializedBytes = bytes(JSON.stringify(state));
  return { state, meta };
}
