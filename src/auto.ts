import type { Boundary, ModelSelection } from './context-hooks.ts';
import type { ContextSnapshot } from './context.ts';
import { ObserveSession, type ObserveHost, type Observation } from './observe.ts';
import type { Tier } from './jev.ts';

export type Target = {model:string; efforts:readonly string[]};
/** Supplied by the host after native capability discovery; no inferred account entitlement. */
export type Catalog = Partial<Record<Tier,Target>>;
export type RoutingEvent = {event:'routing';sessionId:string;turnId:string;step:number;generation:number;
  outcome:string;reason?:string;incomingModel:string;selectedModel?:string;actualModel?:string|null;choice?:Tier;evaluations:number};
export const AUTO_LIMITS = {evaluations:3, progressSteps:2, progressResults:2, repeatedErrors:2} as const;
type Picked = {tier:Tier;model:string;effort:Boundary['effort']};
export class AutoSession {
  private evaluator: ObserveSession;
  private session=''; private instruction=-1; private generation=-1;
  private enabled=true; private epoch=0; private evaluations=0;
  private selected: Picked|undefined; private visited=new Set<Tier>();
  private seenOutcomes=new Set<string>(); private boundary=''; private boundaryCount=0; private evaluatedAt=0;
  private notice='';
  constructor(private readonly catalog: Catalog, private readonly record:(e:Observation|RoutingEvent)=>void=()=>{}, evaluator?:ObserveSession) {
    this.evaluator=evaluator??new ObserveSession(e=>this.emit(e));
  }
  private emit(e:Observation|RoutingEvent):void { try {this.record(e)} catch { /* Diagnostics never select models. */ } }
  invalidate():void {this.epoch++;this.evaluator.invalidate();this.selected=undefined;}
  stop():void {this.enabled=false;this.invalidate();}
  private show(host:ObserveHost,text:string):void {if(this.notice===text)return;this.notice=text;try{host.show(text)}catch{}}
  private supported(tier:Tier,id:Boundary):Picked|undefined {
    const target=this.catalog[tier];
    if (!target || !/^claude-[a-z0-9-]+(?:\[1m\])?$/.test(target.model)) return;
    // A catalog entry is capability evidence, never a quota/entitlement bypass.
    if (id.effort !== undefined && (typeof id.effort!=='string' || !target.efforts.includes(id.effort))) return;
    if (id.nativeModel.includes('[1m]') && !target.model.includes('[1m]')) return;
    return {tier,model:target.model,effort:id.effort};
  }
  async select(snapshot:ContextSnapshot,id:Boundary,host:ObserveHost):Promise<ModelSelection|undefined> {
    if (!this.enabled || id.signal?.aborted || !snapshot.state || !snapshot.meta.ready) return;
    if (this.session && this.session!==id.sessionId) {this.stop();return;}
    this.session=id.sessionId;
    const event=(outcome:string,extra:Partial<RoutingEvent>={})=>this.emit({event:'routing',sessionId:id.sessionId,
      turnId:id.turnId,step:id.step,generation:snapshot.meta.generation,incomingModel:id.nativeModel,
      evaluations:this.evaluations,outcome,...extra});
    const instruction=snapshot.meta.instructionId;
    const fresh=instruction!==this.instruction;
    const revision=snapshot.meta.generation!==this.generation;
    if (fresh) {
      this.invalidate();this.instruction=instruction;this.evaluations=0;this.visited.clear();this.seenOutcomes.clear();
      this.boundaryCount=0;this.evaluatedAt=0;this.boundary='';
    } else if (revision) this.invalidate();
    this.generation=snapshot.meta.generation;
    const boundary=`${id.turnId}/${id.step}/${snapshot.meta.generation}`;
    if (boundary!==this.boundary) {this.boundary=boundary;this.boundaryCount++;}
    const outcomes=id.outcomes ?? [], newOutcomes=outcomes.filter(t=>!this.seenOutcomes.has(t.id));
    let reason:string|undefined;
    if (fresh || revision) reason=fresh?'new_instruction':'context_revision';
    else if (newOutcomes.some(t=>t.tool==='ExitPlanMode'&&!t.error)) reason='plan_approved';
    else if (newOutcomes.filter(t=>t.error).length>=AUTO_LIMITS.repeatedErrors) reason='repeated_tool_errors';
    else if (this.boundaryCount-this.evaluatedAt>=AUTO_LIMITS.progressSteps && newOutcomes.length>=AUTO_LIMITS.progressResults) reason='new_tool_progress';
    if (reason && this.evaluations<AUTO_LIMITS.evaluations) {
      const previous=this.selected;this.selected=undefined;
      const epoch=this.epoch;
      this.evaluations++;this.evaluatedAt=this.boundaryCount;
      this.seenOutcomes=new Set(outcomes.map(t=>t.id));
      const result=await this.evaluator.consume(snapshot,id,host,{checkpoint:`${instruction}/${snapshot.meta.generation}/${this.evaluations}`,quiet:true});
      if (!this.enabled || this.epoch!==epoch || id.signal?.aborted) {event('stale');return;}
      if (result?.outcome!=='recommended' || !result.recommendation) {
        event('native_passthrough',{reason:result?.outcome ?? 'evaluator_skipped'});
        this.show(host,'JevShift · Auto: no fresh Jev choice; keeping the incoming model.');return;
      }
      const choice=result.recommendation,target=this.supported(choice,id);
      if (!target) {
        event('target_not_validated',{reason,choice});
        this.show(host,'JevShift · Auto: target model or effort not validated; keeping the incoming model.');return;
      }
      // Reversals need fresh repeated failures, not another routine progress sample.
      if (previous && choice!==previous.tier && this.visited.has(choice) && reason!=='repeated_tool_errors') {
        this.selected=previous;event('reversal_held',{reason,choice,selectedModel:previous.model});
      } else {
        this.selected=target;this.visited.add(choice);event('choice_accepted',{reason,choice,selectedModel:target.model});
      }
    } else if (reason && this.evaluations>=AUTO_LIMITS.evaluations) event('evaluation_cap',{reason});
    const selected=this.selected;
    if (!selected) return;
    // A reused choice must still fit this incoming request's effort/context mode.
    const compatible=this.supported(selected.tier,id);
    if (!compatible || compatible.model!==selected.model) {this.selected=undefined;event('incompatible_request');return;}
    const epoch=this.epoch;
    event('request_selected',{choice:selected.tier,selectedModel:selected.model});
    this.show(host,`JevShift · Auto: requesting ${selected.model}.`);
    return {model:selected.model,effort:id.effort,
      valid:()=>this.enabled && this.epoch===epoch && this.selected===selected && !id.signal?.aborted,
      completed:actual=>{
        event('response_observed',{selectedModel:selected.model,actualModel:actual});
        if (epoch===this.epoch && actual && actual!==selected.model.replace('[1m]','')) {
          this.stop();this.show(host,'JevShift · Auto stopped: Claude returned a different model. Native control retained.');
        }
      },
      failed:()=>{if(epoch===this.epoch)this.stop();event('native_request_failed',{selectedModel:selected.model});
        this.show(host,'JevShift · Auto stopped after a native request error. The original error remains visible.');},
    };
  }
}
