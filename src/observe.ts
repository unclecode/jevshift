import {EVALUATOR_LIMITS} from './evaluator-limits.ts';
import {TransportError,type TransportOutcome} from './transport.ts';
import type { ContextSnapshot } from './context.ts';
import type { Boundary } from './context-hooks.ts';
import { ENDPOINT, parseReply, requestBody, type Reply, type Parsed, type Tier, type Usage } from './jev.ts';

export type ObserveHost = {
  now: () => Promise<number>;
  after: (ms: number, fn: () => void) => {cancel: () => void};
  fetch: (url: string, init: {method:string;headers:Record<string,string>;body:string}) => Promise<Reply>;
  key: () => Promise<string | undefined>;
  show: (text: string) => void;
};
export type Observation = {
  event: 'started' | 'finished' | 'late_settlement' | 'skipped';
  sessionId: string; turnId: string; generation: number; step: number; attempt?: number;
  outcome: string; nativeModel: string; recommendation?: Tier;
  timestampMs: number; elapsedMs?: number; billing?:'reported'|'unknown'|'not_requested'; usage?: Usage; httpStatus?: number; evaluatorModel?: string;
};
const safeModel = (x: string) => typeof x === 'string' && /^[\w./:-]{1,128}$/.test(x) ? x : 'selected model';
const title = (s: string) => s.charAt(0).toUpperCase()+s.slice(1);

/** One instance per registration. No model/effort mutation, raw-context log, or retries. */
export class ObserveSession {
  private session = '';
  private seen = '';
  private epoch = 0;
  private serial = 0;
  private pending = false;
  private cancelWait: (() => void) | undefined;
  private lastNotice = '';
  constructor(private readonly record: (event: Observation) => void = () => {}) {}
  invalidate(clearSeen = false): void { this.epoch++; this.cancelWait?.(); if (clearSeen) this.seen=""; }
  private emit(e: Observation): void { try { this.record(e); } catch { /* Diagnostics cannot break native work. */ } }
  private notice(host: ObserveHost, text: string): void {
    if (this.lastNotice === text) return;
    this.lastNotice = text;
    try { host.show(text); } catch { /* UI is advisory. */ }
  }
  async consume(snapshot: ContextSnapshot, id: Boundary, host: ObserveHost,
    options: {checkpoint?:string; quiet?:boolean} = {}): Promise<Observation | undefined> {
    if (this.session !== id.sessionId) { this.invalidate(); this.session=id.sessionId; this.seen=''; this.lastNotice=''; }
    const key = options.checkpoint ?? String(snapshot.meta.generation);
    if (key === this.seen) return;
    this.seen = key;
    this.invalidate();
    const epoch = this.epoch;
    const nativeModel = safeModel(id.nativeModel);
    const started = await host.now();
    const base = {sessionId:id.sessionId,turnId:id.turnId,generation:snapshot.meta.generation,step:id.step,nativeModel,timestampMs:started};
    if (!snapshot.state || !snapshot.meta.ready || id.signal?.aborted) {
      this.emit({...base,event:'skipped',outcome:'no_current_context'}); return;
    }
    if (this.pending) {
      this.emit({...base,event:'skipped',outcome:'request_still_pending'});
      if (!options.quiet) this.notice(host,'JevShift · Observe: previous Jev request still pending; selected model unchanged.'); return;
    }
    const body = requestBody(snapshot.state);
    if (!body) { this.emit({...base,event:'skipped',outcome:'payload_too_large'}); return; }
    // Start the deadline before reading credentials. A local deadline does not cancel HTTP.
    let wake: (value: 'timeout' | 'stale' | 'aborted') => void = () => {};
    const stopped = new Promise<'timeout' | 'stale' | 'aborted'>(resolve => { wake=resolve; });
    const cancel = () => wake('stale');
    const abort = () => wake('aborted');
    this.cancelWait = cancel;
    const timer = host.after(EVALUATOR_LIMITS.selectionWaitMs,() => wake('timeout'));
    id.signal?.addEventListener('abort',abort,{once:true});
    this.pending = true;
    let attempt: number | undefined;
    let abandoned = false;
    type Result = Parsed | {outcome:'missing_key' | 'network_error' | 'stale' | TransportOutcome};
    const operation = (async (): Promise<Result> => {
      try {
        const credential = (await host.key())?.trim();
        if (abandoned || epoch !== this.epoch || id.signal?.aborted) return {outcome:'stale'};
        if (!credential || credential.length > 4096 || /[\r\n]/.test(credential)) return {outcome:'missing_key'};
        attempt = ++this.serial;
        this.emit({...base,event:'started',outcome:'requested',attempt});
        const reply = await host.fetch(ENDPOINT,{method:'POST',headers:{Authorization:`Bearer ${credential}`,'Content-Type':'application/json'},body});
        return parseReply(reply);
      } catch (error) { return {outcome:error instanceof TransportError?error.outcome:'network_error'}; }
    })();
    const settlement = operation.then(async result => {
      this.pending = false;
      if (abandoned) {
        let now = started;
        try { now = await host.now(); } catch { /* Preserve settlement accounting. */ }
        this.emit({...base,event:'late_settlement',outcome:result.outcome,attempt,elapsedMs:now-started,
          billing:('usage' in result && result.usage)?'reported':attempt&&result.outcome!=='transport_disabled'?'unknown':'not_requested',
          ...('usage' in result ? {usage:result.usage,httpStatus:result.httpStatus} : {})});
      }
      return result;
    });
    let result: Result | 'timeout' | 'stale' | 'aborted';
    try { result = await Promise.race([settlement,stopped]); }
    finally {
      timer.cancel(); id.signal?.removeEventListener('abort',abort);
      if (this.cancelWait === cancel) this.cancelWait=undefined;
    }
    if (typeof result === 'string') abandoned = true;
    const elapsedMs = Math.max(0,(await host.now())-started);
    const stale = epoch !== this.epoch || id.signal?.aborted;
    const outcome = stale ? 'stale' : typeof result === 'string' ? result : result.outcome;
    const decision = typeof result === 'object' && 'decision' in result ? result.decision : undefined;
    const observation: Observation = {...base,event:'finished',attempt,outcome,elapsedMs,
      billing:typeof result==='object'&&'usage' in result&&result.usage?'reported':attempt&&!(typeof result==='object'&&result.outcome==='transport_disabled')?'unknown':'not_requested',
      ...(!stale && outcome==='recommended' && decision ? {recommendation:decision.choice,evaluatorModel:decision.model} : {}),
      ...(typeof result==='object' && 'httpStatus' in result ? {usage:result.usage,httpStatus:result.httpStatus} : {})};
    this.emit(observation);
    if (stale || outcome==='aborted' || outcome==='stale' || options.quiet) return observation;
    if (outcome==='recommended' && decision) {
      this.notice(host,`JevShift · Observe: recommend ${title(decision.choice)}; keeping ${nativeModel}.`);
    } else if (outcome==='missing_key') {
      this.notice(host,'JevShift · Observe needs an OpenRouter key. Set the sensitive openrouter_api_key plugin option; selected model unchanged.');
    } else {
      this.notice(host,`JevShift · Observe: ${outcome==='timeout'||outcome==='transport_timeout' ? 'Jev request timed out' : 'Jev unavailable or reply invalid'}; selected model unchanged.`);
    }
    return observation;
  }
}
