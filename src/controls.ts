import {AutoSession,type Catalog,type RoutingEvent} from './auto.ts';
import {ObserveSession,type ObserveHost,type Observation} from './observe.ts';
import {compatible,resolveTarget,modelId,isTier,TIERS} from './catalog.ts';
import type {Boundary,ModelSelection} from './context-hooks.ts';
import type {ContextSnapshot} from './context.ts';
import {isEffort,withinCap,type Effort,type EffortPolicy} from './effort.ts';
export type Mode='observe'|'auto'|'off'|'pin';
export type SavedControl={version:1;sessionId:string;mode:Mode;pin?:string;effort?:EffortPolicy;blocked?:boolean};
export type ControlHost={get:(key:string)=>Promise<unknown>;set:(key:string,value:unknown)=>Promise<void>;discover:()=>Promise<Catalog>};
const key=(id:string)=>`session-v1:${id}`;
const help='Use /jevshift status, setup, refresh, observe, auto, off, pin <model> [effort], or effort <low|medium|high|xhigh|max|auto|native>.';
export class SessionControls {
  mode:Mode='observe';pin:string|undefined;blocked=false;catalog:Catalog={};sessionId='';
  nativeModel='unknown';recommended:string|undefined;requested:string|undefined;actual:string|undefined;
  effort:EffortPolicy='auto';nativeEffort:Boundary['effort'];recommendedEffort:Effort|undefined;requestedEffort:Boundary['effort'];
  private nativeEffortSeen=false;
  note='';private revision=0;private loaded=false;private loading:Promise<void>|undefined;
  private catalogPending:Promise<Catalog>|undefined;private saveQueue:Promise<void>=Promise.resolve();
  private catalogEpoch=0;
  private host:ControlHost|undefined;private auto:AutoSession|undefined;
  private observer:ObserveSession;
  private lastEvaluation:Observation|undefined;
  constructor(private allowAuto=false,private record:(event:Observation|RoutingEvent)=>void=()=>{},private maxEffort:Effort='max') {
    this.observer=new ObserveSession(e=>{
      if(e.event==='finished'&&e.sessionId===this.sessionId&&e.outcome!=='stale'&&e.outcome!=='aborted'){
        this.lastEvaluation=e;if(e.recommendation){this.recommended=e.recommendation;this.recommendedEffort=e.effortRecommendation;}
      }
      this.record(e);
    });
  }
  invalidate():void{this.revision++;this.observer.invalidate();this.auto?.invalidate();}
  private change(mode:Mode,pin?:string,effort:EffortPolicy=mode==='pin'||mode==='off'?'native':'auto'):void {
    this.invalidate();this.auto?.stop();this.auto=undefined;this.observer.invalidate(true);
    this.mode=mode;this.pin=pin;this.effort=effort;this.blocked=false;this.note='';this.recommended=undefined;this.lastEvaluation=undefined;
    this.requested=undefined;this.requestedEffort=undefined;this.recommendedEffort=undefined;
  }
  async bind(id:string,source:string,host:ControlHost):Promise<void>{
    if(this.sessionId===id&&this.loaded&&source!=='clear'&&source!=='fork'){this.host=host;return;}
    if(this.sessionId===id&&this.loading)return this.loading;
    this.change('observe');this.sessionId=id;this.host=host;this.loaded=false;
    this.actual=undefined;this.nativeModel='unknown';this.nativeEffort=undefined;this.nativeEffortSeen=false;this.catalog={};this.catalogPending=undefined;this.catalogEpoch++;
    const revision=this.revision;
    const pending=(async()=>{
      let saved:unknown,readFailed=false;
      try{saved=source==='clear'||source==='fork'?undefined:await host.get(key(id));}
      catch{readFailed=true;}
      if(this.sessionId!==id||this.revision!==revision)return;
      if(readFailed)this.note='Saved mode could not be read; observe selected.';
      const s=saved as Partial<SavedControl>|undefined;
      if(s?.version===1&&s.sessionId===id&&['observe','off','auto','pin'].includes(s.mode??'')){
        const effort=isEffort(s.effort)||s.effort==='auto'||s.effort==='native'?s.effort:undefined;
        if((s.mode==='auto'||(s.mode==='pin'&&effort==='auto'))&&!this.allowAuto){this.change('off');this.note='Saved auto mode is unavailable until experimental auto is enabled.';}
        else if(s.mode==='pin'&&(isTier(s.pin)||modelId(s.pin)||(s.pin===undefined&&effort!==undefined))){this.change('pin',s.pin,effort);this.blocked=s.blocked===true;}
        else if(s.mode!=='pin')this.change(s.mode as Mode,undefined,effort);
      }
      this.loaded=true;
    })();
    this.loading=pending;
    try{await pending}finally{if(this.loading===pending)this.loading=undefined}
  }
  private async discover():Promise<Catalog>{
    if(Object.keys(this.catalog).length)return this.catalog;
    const session=this.sessionId,epoch=this.catalogEpoch;
    if(!this.catalogPending)this.catalogPending=this.host!.discover();
    const pending=this.catalogPending;
    try{const catalog=await pending;if(this.sessionId!==session)throw Error('Session changed');
      if(epoch===this.catalogEpoch)this.catalog=this.capped(catalog);return this.catalog;}
    finally{if(this.catalogPending===pending)this.catalogPending=undefined;}
  }
  private capped(catalog:Catalog):Catalog{
    const result:Catalog={};for(const tier of TIERS){const target=catalog[tier];if(!target)continue;
      const efforts=target.efforts.filter((e):e is Effort=>isEffort(e)&&withinCap(e,this.maxEffort));
      const versions=target.versions?.map(v=>({model:v.model,efforts:v.efforts.filter(e=>isEffort(e)&&withinCap(e,this.maxEffort))})).filter(v=>v.efforts.length);
      if(efforts.length)result[tier]={model:target.model,efforts,...(versions?.length?{versions}:{})};}return result;
  }
  async warmCatalog():Promise<void>{
    const revision=this.revision;
    try{await this.discover()}catch{if(this.revision===revision)this.note='Model discovery unavailable; /jevshift refresh retries. Native control is unchanged.';}
  }
  async save():Promise<void>{
    if(!this.host||!this.loaded)return;
    const host=this.host,id=this.sessionId;
    const value:SavedControl={version:1,sessionId:id,mode:this.mode,effort:this.effort,...(this.pin?{pin:this.pin}:{}),...(this.blocked?{blocked:true}:{})};
    this.saveQueue=this.saveQueue.catch(()=>{}).then(()=>host.set(key(id),value));
    try{await this.saveQueue}catch{if(this.sessionId===id)this.note='Mode changed for this process, but could not be saved for resume.';}
  }
  async command(args:string,native:string):Promise<string>{
    this.nativeModel=native;
    const words=args.trim().split(/\s+/).filter(Boolean),action=words[0]??'status';
    if(action==='status'&&words.length<=1)return this.status();
    if(['setup','refresh'].includes(action)&&words.length===1){
      const revision=this.revision;
      try{
        const discovered=await this.host!.discover();
        if(revision!==this.revision)return 'Discovery discarded because controls changed.';
        const blocked=this.blocked,note=this.note;
        this.catalog=this.capped(discovered);this.catalogEpoch++;
        this.change(action==='setup'?'observe':this.mode,action==='setup'?undefined:this.pin,action==='setup'?'auto':this.effort);
        if(action==='refresh'){this.blocked=blocked;this.note=blocked?note:'';}
        await this.save();
        return `Models discovered: ${TIERS.filter(t=>this.catalog[t]).map(t=>`${t} = ${this.catalog[t]!.model} (${this.catalog[t]!.efforts.join(', ')})`).join('; ')}. ${action==='setup'?'Observe selected.':'Current controls preserved.'} Automatic effort cap: ${this.maxEffort}.`;
      }catch{return 'Model discovery failed; existing mode unchanged. Check that the configured Claude executable is available.';}
    }
    if(['off','observe','auto'].includes(action)&&words.length===1){
      if(action==='auto'){
        if(!this.allowAuto)return 'Auto is still experimental and disabled. Selection quality and real-world evaluator reliability remain under review; enable experimental_auto only for an isolated development test.';
        const revision=this.revision;
        try{await this.discover()}catch{return 'Model discovery failed; existing mode unchanged.';}
        if(this.revision!==revision)return 'Auto request discarded because controls changed.';
      }
      this.change(action as Mode);await this.save();return this.status();
    }
    if(action==='pin'&&(words.length===2||words.length===3)){
      if(words.length===3&&(!isEffort(words[2])||!withinCap(words[2],this.maxEffort)))return 'Invalid or capped effort; existing mode unchanged. '+help;
      if(!TIERS.includes(words[1] as any)&&!modelId(words[1]))return 'Invalid pin; existing mode unchanged. '+help;
      const revision=this.revision;
      try{await this.discover()}catch{return 'Model discovery failed; existing mode unchanged.';}
      if(this.revision!==revision)return 'Pin request discarded because controls changed.';
      const target=resolveTarget(this.catalog,words[1],native);
      if(!target)return 'That model is not in the supported native catalog; existing mode unchanged.';
      if(!compatible(target.target,native,words[2]))return 'That pin is incompatible with the selected context window or supported effort; existing mode unchanged.';
      this.change('pin',words[1],words[2] as Effort|undefined);await this.save();return this.status();
    }
    if(action==='effort'&&words.length===2){
      const effort=words[1];
      if(!isEffort(effort)&&effort!=='auto'&&effort!=='native')return 'Invalid effort; existing mode unchanged. '+help;
      if(isEffort(effort)&&!withinCap(effort,this.maxEffort))return `Effort exceeds the configured ${this.maxEffort} cap; existing mode unchanged.`;
      if(effort==='auto'&&!this.allowAuto&&this.mode!=='observe')return 'Automatic effort is experimental; enable experimental_auto first.';
      const revision=this.revision;
      try{await this.discover()}catch{return 'Model discovery failed; existing mode unchanged.';}
      if(revision!==this.revision)return 'Effort request discarded because controls changed.';
      if(this.mode==='pin'&&isEffort(effort)){
        const target=resolveTarget(this.catalog,this.pin??native,native);
        if(!target||!compatible(target.target,native,effort))return 'That effort is unavailable for the pinned model; existing mode unchanged.';
      }
      // Observe remains advisory. Off plus a fixed effort holds the native model without calling Jev.
      const mode=this.mode==='off'?(effort==='native'?'off':'pin'):this.mode;
      this.change(mode,this.pin,effort);await this.save();return this.status();
    }
    return help+' Existing mode unchanged.';
  }
  status():string{
    const evaluation=this.lastEvaluation;
    const outcome=evaluation?({transport_timeout:'timed out',timeout:'timed out',missing_key:'missing key',
      transport_disabled:'disabled by native network setting',recommended:'recommended'} as Record<string,string>)[evaluation.outcome]??evaluation.outcome:'none';
    const evaluationText=outcome+(evaluation?.elapsedMs!==undefined?` (${evaluation.elapsedMs} ms)`:'');
    return [`JevShift: ${this.mode}${this.pin?` (${this.pin})`:''}${this.blocked?' (blocked; choose another model or /jevshift off)':''}`,
      `Native default: ${this.nativeModel}`,`Native effort: ${this.nativeEffort??'default'}`,`Effort control: ${this.effort} (cap: ${this.maxEffort})`,
      `Resolved models: ${TIERS.filter(t=>this.catalog[t]).map(t=>`${t} = ${this.catalog[t]!.model}`).join('; ')||'not discovered'}`,
      `Last Jev result: ${evaluationText}`,`Last Jev recommendation: ${this.recommended??'none'}`,`Last Jev effort: ${this.recommendedEffort??'none'}`,
      `Last requested model: ${this.requested??'none'}`,`Last returned model: ${this.actual??'none'}`,
      `Last requested effort: ${this.requested===undefined?'none':this.requestedEffort??'default'}`,
      ...(this.note?[this.note]:[]),...(this.mode==='pin'?[this.effort==='auto'?'Model held; Jev chooses effort.':'Pin makes no Jev calls. Changes apply on the next model request.']:[])].join('\n');
  }
  async nativeEffortCommand():Promise<void>{this.change('off');this.note='Native effort selection took control.';await this.save();}
  private fallback(id:Boundary):ModelSelection{
    const pinned=this.mode==='pin',fixed=isEffort(this.effort)&&!['off','observe'].includes(this.mode);
    const input=pinned?this.pin??id.nativeModel:id.nativeModel,effort=fixed?this.effort as Effort:id.effort;
    let model=input;
    if(pinned||fixed){
      const target=resolveTarget(this.catalog,model,id.nativeModel);
      if(!target||!compatible(target.target,id.nativeModel,effort))return {model:id.nativeModel,block:'The held model/effort pair is unavailable. Choose another pin or use /jevshift off.'};
      model=target.target.model;
    }
    return {model,effort,...(pinned?{stopFallback:true}:{})};
  }
  async nativeSwitch(source:string,model:string):Promise<void>{
    this.nativeModel=model;
    if(['command','picker','sdk'].includes(source)){this.change('off');this.note='Native model selection took control.';await this.save();}
    else if(source==='auto'){
      if(this.mode==='pin'){this.invalidate();this.blocked=true;this.note='Native fallback attempted; pin remains blocked.';await this.save();}
      else if(this.mode==='auto'){this.change('off');this.note='Native fallback stopped automatic selection.';await this.save();}
    }
  }
  async guard(id:Boundary):Promise<ModelSelection|undefined>{
    if(id.sessionId!==this.sessionId)return;
    this.nativeModel=id.nativeModel;
    if(this.nativeEffortSeen&&this.nativeEffort!==id.effort&&this.mode!=='off'){
      this.change('off');this.note='Native effort changed; native control retained.';await this.save();
    }
    this.nativeEffort=id.effort;this.nativeEffortSeen=true;
    if(this.mode==='off')return this.track({model:id.nativeModel,effort:id.effort},id);
    if(this.mode!=='pin')return;
    if(!this.blocked){
      const revision=this.revision;
      try{await this.discover()}catch{if(revision===this.revision){this.blocked=true;this.note='Pinned model could not be revalidated.';}}
      if(revision!==this.revision)return this.guard(id);
      const target=resolveTarget(this.catalog,this.pin??id.nativeModel,id.nativeModel);
      const effort=this.effort==='auto'?undefined:this.effort==='native'?id.effort:this.effort;
      if(!target||!compatible(target.target,id.nativeModel,effort)){this.blocked=true;this.note='Pinned model is unavailable or incompatible with this effort/context setting.';}
    }
    if(this.blocked){await this.save();return {model:id.nativeModel,block:this.note||'Pinned model is blocked. Choose a model or /jevshift off.'};}
    if(this.effort==='auto')return;
    return this.track({model:resolveTarget(this.catalog,this.pin??id.nativeModel,id.nativeModel)!.target.model,effort:this.effort==='native'?id.effort:this.effort,stopFallback:true},id,true);
  }
  async select(snapshot:ContextSnapshot,id:Boundary,host:ObserveHost):Promise<ModelSelection|undefined>{
    if(id.sessionId!==this.sessionId)return;
    const guarded=await this.guard(id);if(guarded)return guarded;
    const revision=this.revision;
    let selected:ModelSelection|undefined;
    if(this.mode==='auto'||(this.mode==='pin'&&this.effort==='auto')){
      try{await this.discover()}catch{if(revision===this.revision){this.change('off');this.note='Model discovery failed; native control retained.';await this.save();}return;}
      if(revision!==this.revision)return this.guard(id);
      const pinned=this.mode==='pin'?resolveTarget(this.catalog,this.pin??id.nativeModel,id.nativeModel):undefined;
      const catalog=pinned?{[pinned.tier]:pinned.target}:this.catalog;
      this.auto??=new AutoSession(catalog,e=>this.record(e),this.observer);
      // A restored auto controller is rebuilt after current-process discovery.
      selected=await this.auto.select(snapshot,id,host,{...(pinned?{pinnedModel:pinned.tier}:{}),
        ...(this.effort!=='auto'?{fixedEffort:this.effort}:{}),nativeEffort:id.effort});
      if(pinned&&!selected)selected=this.fallback(id);
    }else {
      try{await this.discover()}catch{this.note='Model discovery failed; recommendation skipped.';return this.track({model:id.nativeModel,effort:id.effort},id);}
      if(revision!==this.revision)return this.guard(id);
      await this.observer.consume(snapshot,id,host,{scope:{catalog:this.catalog,...(this.effort!=='auto'?{fixedEffort:this.effort}:{}),nativeEffort:id.effort}});
    }
    if(this.revision!==revision)return this.guard(id);
    return this.track(selected?{...selected,...(this.mode==='pin'?{stopFallback:true}:{})}:this.fallback(id),id,this.mode==='pin',this.mode==='auto');
  }
  async finalize(selected:ModelSelection|undefined,id:Boundary):Promise<ModelSelection|undefined>{
    if(id.sessionId!==this.sessionId)return;
    // An immediate pin/off command can supersede a decision while Jev is awaited.
    if((this.mode==='pin'&&this.effort!=='auto')||this.mode==='off')return this.guard(id);
    if((this.mode==='pin'||this.mode==='auto')&&!selected)return this.track(this.fallback(id),id,this.mode==='pin',this.mode==='auto');
    if(selected?.valid&&!selected.valid())return this.track(this.fallback(id),id,this.mode==='pin',this.mode==='auto');
    return selected;
  }
  private track(selection:ModelSelection,id:Boundary,pinned=false,automatic=false):ModelSelection{
    const revision=this.revision,session=this.sessionId;
    this.requested=selection.model;this.requestedEffort=selection.effort;
    return {...selection,valid:()=>revision===this.revision&&!id.signal?.aborted&&(!selection.valid||selection.valid()),
      completed:async actual=>{
        if(session!==this.sessionId)return;
        await selection.completed?.(actual);this.actual=actual??undefined;
        if(revision!==this.revision)return;
        if(actual&&actual!==selection.model.replace('[1m]','')){
          if(pinned){this.blocked=true;this.note='Returned model differed from the pin; further requests blocked.';}
          else if(automatic){this.change('off');this.note='Returned model differed; native control retained.';}
          await this.save();
        }
      },
      failed:async error=>{
        await selection.failed?.(error);
        if(revision!==this.revision)return;
        if(pinned){this.blocked=true;this.note='Pinned model request failed. Choose another model, re-pin to retry, or use /jevshift off.';}
        else if(automatic){this.change('off');this.note='Native request failed; automatic selection stopped.';}
        await this.save();
      }};
  }
}
