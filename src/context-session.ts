import { buildContext, LIMITS, type ContextSnapshot, type Message, type RequestEvidence } from './context.ts';
type Prompt = { text: string; origin: {kind: string}; turnId?: string; wait: boolean };
type Pending = { ticket: number; text: string; origin: RequestEvidence['origin']; turnId?: string;
  wait: boolean; beforeMatches: number };
const humanOrigins = new Set(['composer','bridge','sdk']);
function occurrences(messages: readonly Message[], text: string): number {
  return messages.filter(m => m.role === 'user' && !m.toolResults?.length && m.text.trim() === text.trim()).length;
}
/** One instance per plugin registration; session id changes and /clear reset all evidence. */
export class ContextSession {
  private session = '';
  private active: RequestEvidence | null = null;
  private turn = '';
  private pending: Pending[] = [];
  private serial = 0;
  private generation = 0;
  bind(sessionId: string): void {
    if (sessionId !== this.session) { this.reset(); this.session = sessionId; }
  }
  reset(): void { this.active = null; this.pending = []; this.turn = ''; this.generation++; }
  stage(sessionId: string, input: Prompt, before: readonly Message[]): number | null {
    this.bind(sessionId);
    if (!humanOrigins.has(input.origin.kind) || !input.text.trim() || input.text.length > LIMITS.inputChars) return null;
    const ticket = ++this.serial;
    this.pending.push({ ticket, text: input.text, origin: input.origin.kind as Pending['origin'],
      turnId: input.turnId, wait: input.wait, beforeMatches: occurrences(before, input.text) });
    this.pending = this.pending.slice(-8);
    return ticket;
  }
  reject(ticket: number | null): void { this.pending = this.pending.filter(p => p.ticket !== ticket); }
  private activate(p: Pending): void {
    this.active = { text: p.text.length <= LIMITS.inputChars ? p.text : '', origin: p.origin, generation: ++this.generation, instructionId:p.ticket };
    this.pending = this.pending.filter(item => item.ticket > p.ticket);
  }
  beginTurn(sessionId: string, turnId: string, text: string): void {
    this.bind(sessionId); this.turn = turnId;
    const p = this.pending.findLast(item => item.text.trim() === text.trim());
    // A real turn starting with this staged input confirms it was not dropped.
    if (p) this.activate(p);
    else if (text.trim()) this.active = null; // A peer/notification is not a fresh human request.
  }
  compacted(): void {
    // Retain the verified active request; never promote a user-role summary to a human prompt.
    this.pending = []; this.generation++;
    if (this.active) this.active = {...this.active, generation: this.generation};
  }
  snapshot(sessionId: string, turnId: string, messages: readonly Message[]): ContextSnapshot {
    this.bind(sessionId);
    if (turnId !== this.turn) return buildContext(messages, null);
    // Mid-turn input becomes eligible only when its actual user-text row is visible.
    for (const p of [...this.pending]) {
      if (p.turnId === turnId && !p.wait && occurrences(messages,p.text) > p.beforeMatches) this.activate(p);
    }
    return buildContext(messages, this.active);
  }
}
