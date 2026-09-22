import type { Register, EngineInterface, TurnStepInput } from 'claude-code';
import type {Reply} from './jev.ts';
import { boundedFetch,TransportError } from './transport.ts';
import { ContextSession } from './context-session.ts';
import type { ContextSnapshot } from './context.ts';
import { routingEvidence, type ToolOutcome } from './routing-evidence.ts';

/** Collect at native request boundaries; only an explicit validated selection rewrites a model. */
export type Boundary = {sessionId: string; turnId: string; step: number; nativeModel: string; effort?: TurnStepInput['effort']; signal?: AbortSignal; outcomes?: ToolOutcome[]};
export type Invalidation = 'prompt' | 'turn' | 'session' | 'compact';
export type ModelSelection = {model:string; effort?: TurnStepInput['effort']; valid?:()=>boolean; block?:string; stopFallback?:boolean; completed?:(actual:string|null)=>void|Promise<void>; failed?:(error?:unknown)=>void|Promise<void>};
export type BoundaryHost = {
  clock: Pick<EngineInterface['clock'],'now'|'after'>;
  http: {fetch:(url:string,init:{method:string;headers:Record<string,string>;body:string})=>Promise<Reply>};
  ui: Pick<EngineInterface['ui'],'log'|'status'>;
  environmentKey: () => Promise<string | undefined>;
};
export type ContextControls = {
  lifecycle?:(id:string,source:string,host:{get:(key:string)=>Promise<unknown>;set:(key:string,value:unknown)=>Promise<void>})=>Promise<void>;
  guard?:(id:Boundary)=>Promise<ModelSelection|undefined>;
  finalize?:(selection:void|ModelSelection,id:Boundary)=>Promise<ModelSelection|undefined>;
};
export function registerContextHooks(on: Parameters<Register>[0], consume: (snapshot: ContextSnapshot,
  identity: Boundary, host: BoundaryHost) => Promise<void | ModelSelection>, invalidate: (reason:Invalidation) => void = () => {}, controls:ContextControls = {}): void {
  const context = new ContextSession();
  on('prompt.submit', async ($, e, next) => {
    let ticket: number | null = null;
    try {
      ticket = context.stage(await $.session.id(), e, await $.session.messages());
      if (ticket !== null) invalidate('prompt');
    } catch { /* Native prompt still proceeds. */ }
    try {
      const result = await next(e);
      if ('drop' in result) context.reject(ticket);
      return result;
    } catch (error) { context.reject(ticket); throw error; }
  });
  on('turn.start', async ($, e, next) => {
    invalidate('turn');
    try { context.beginTurn(await $.session.id(), e.turnId, e.text); } catch { context.reset(); }
    return next(e);
  });
  on('classic.SessionStart', async ($, e, next) => {
    if (['clear','fork','resume'].includes(e.source)) { context.reset(); invalidate('session'); }
    await controls.lifecycle?.(await $.session.id(),e.source,{get:key=>$.store.get(key),set:(key,value)=>$.store.set(key,value)});
    return next(e);
  });
  on('session.compact', async ($, e, next) => {
    const result = await next(e);
    if (!e.agentId && e.trigger !== 'precompute' && !result.skip) { context.compacted(); invalidate('compact'); }
    return result;
  });
  on('turn.step', async function* ($, e, next) {
    let selection: void | ModelSelection;
    let identity:Boundary|undefined;
    if (!e.agentId) {
      // A collection/evaluator failure preserves native behavior and does not retry.
      try {
        const id = await $.session.id();
        identity={sessionId:id,turnId:e.turnId,step:e.index,nativeModel:e.model,effort:e.effort,signal:next.signal};
        selection=await controls.guard?.(identity);
        if(!selection){
        const messages = await $.session.messages();
        const snapshot = context.snapshot(id, e.turnId, messages);
        selection = await consume(snapshot, {sessionId:id, turnId:e.turnId, step:e.index, nativeModel:e.model, effort:e.effort,
          outcomes:routingEvidence(messages),signal:next.signal}, {
          clock:{now:()=>$.clock.now(),after:(ms,fn)=>$.clock.after(ms,fn)},
          http:{fetch:async(url,init)=>{
            const disabled=await $.env.get('CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC');
            if(disabled==='1'||disabled==='true')throw new TransportError('transport_disabled');
            return boundedFetch((argv,options)=>$.process.run(argv,options),url,init);
          }},
          ui:{log:(text,options)=>$.ui.log(text,options),status:text=>$.ui.status(text)},
          environmentKey:()=>$.env.get('OPENROUTER_API_KEY'),
        });
        }
      } catch { /* A collector failure leaves native behavior intact. */ }
    }
    if(identity&&controls.finalize)selection=await controls.finalize(selection,identity);
    if(selection?.block){
      $.ui.log(`JevShift · ${selection.block}`);$.ui.status('JevShift · Pin blocked');
      await $.turn.abort({turnId:e.turnId});
      return {turnId:e.turnId,index:e.index,answer:'',toolUses:[],stopReason:null,usage:null};
    }
    // Only model and effort are rewritable. Result and stream are returned verbatim.
    if (selection?.valid && !selection.valid()) selection=undefined;
    try {
      const result = yield* next(selection ? {...e,model:selection.model,effort:selection.effort} : e);
      try {
        if (result?.stopReason === null && !result.usage) await selection?.failed?.();
        else await selection?.completed?.(result?.usage?.model ?? null);
      } catch { /* Diagnostic only. */ }
      return result;
    } catch (error) {
      try { await selection?.failed?.(error); } catch { /* Preserve the original native error. */ }
      if(selection?.stopFallback&&String(error).includes('Model fallback triggered:')){
        $.ui.log('JevShift · Pinned model unavailable; automatic fallback stopped. Choose another model or /jevshift off.');
        await $.turn.abort({turnId:e.turnId});
        return {turnId:e.turnId,index:e.index,answer:'',toolUses:[],stopReason:null,usage:null};
      }
      throw error;
    }
  });
}
