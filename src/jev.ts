import { bytes } from './context.ts';
import { JEV_PROMPT } from './jev-prompt.ts';

export const ENDPOINT = 'https://openrouter.ai/api/alpha/decisions';
export type Tier = 'sonnet' | 'opus' | 'fable';
export type Usage = {inputTokens: number; outputTokens: number; costUsd: number};
export type Reply = {status: number; ok: boolean; text: string};
export type Decision = {choice: Tier; confidence: number; probabilities: Record<Tier,number>; model: string};
export type Parsed = {outcome: 'recommended' | 'http_error' | 'invalid_response'; decision?: Decision; usage?: Usage; httpStatus: number};
const object = (x: unknown): x is Record<string,any> => !!x && typeof x === 'object' && !Array.isArray(x);
const probability = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= 1;
const count = (x: unknown): x is number => Number.isSafeInteger(x) && (x as number) >= 0;
export function requestBody(state: string): string | null {
  const body = JSON.stringify({...JEV_PROMPT,state});
  return bytes(body) <= 9000 ? body : null;
}
/** Never return raw response bodies or server error text to diagnostics. */
export function parseReply(reply: Reply): Parsed {
  const base: Parsed = {outcome: reply.ok ? 'invalid_response' : 'http_error', httpStatus:reply.status};
  if (reply.text.length > 65536) return base;
  let x: any;
  try { x = JSON.parse(reply.text); } catch { return base; }
  if (!object(x)) return base;
  const u = x.usage;
  if (object(u) && count(u.input_tokens) && count(u.output_tokens) && typeof u.cost === 'number' && Number.isFinite(u.cost) && u.cost >= 0)
    base.usage = {inputTokens:u.input_tokens, outputTokens:u.output_tokens, costUsd:u.cost};
  if (!reply.ok) return base;
  const a = x.answers?.model_choice, p = a?.probabilities;
  if (!object(a) || a.type !== 'choice' || !['sonnet','opus','fable'].includes(a.choice) ||
      !probability(a.confidence) || !object(p) || Object.keys(p).sort().join(',') !== 'fable,opus,sonnet' ||
      ![p.sonnet,p.opus,p.fable].every(probability) || Math.abs(p.sonnet+p.opus+p.fable-1) >= .02 ||
      typeof x.model !== 'string' || !/^typesafe\/jev-1\.13(?:-\d{8})?$/.test(x.model)) return base;
  return {...base,outcome:'recommended',decision:{choice:a.choice,confidence:a.confidence,probabilities:p as Record<Tier,number>,model:x.model}};
}
