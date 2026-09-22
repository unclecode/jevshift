import {test,expect} from 'bun:test';
import {AutoSession,type Catalog} from '../src/auto.ts';
import {buildContext} from '../src/context.ts';
import {routingEvidence} from '../src/routing-evidence.ts';
import type {Boundary} from '../src/context-hooks.ts';
import type {ObserveHost} from '../src/observe.ts';
const catalog:Catalog={sonnet:{model:'claude-sonnet-5',efforts:['low']},opus:{model:'claude-opus-5',efforts:['low']},fable:{model:'claude-fable-5-1',efforts:['low']}};
const snapshot=(generation=1,instructionId=generation)=>buildContext([],{text:'Build the agreed plan.',origin:'sdk',generation,instructionId});
const outcome=(id:string,error=false,tool='Read')=>({id,error,tool});
const boundary=(step=0,outcomes:Boundary['outcomes']=[],extra:Partial<Boundary>={}):Boundary=>({sessionId:'a',turnId:'t',step,nativeModel:'claude-sonnet-5',effort:'low',outcomes,...extra});
const response=(choice:string)=>({status:200,ok:true,text:JSON.stringify({model:'typesafe/jev-1.13',answers:{model_choice:{type:'choice',choice,confidence:1,probabilities:{sonnet:+(choice==='sonnet'),opus:+(choice==='opus'),fable:+(choice==='fable')}}}})});
function setup(choices=['fable','opus','fable'],targets=catalog){
 let calls=0;const events:any[]=[],notices:string[]=[],timers:(()=>void)[]=[];
 const host:ObserveHost={now:async()=>0,after:(ms,fn)=>{timers.push(fn);return{cancel:()=>{}}},key:async()=> 'test-key',
  fetch:async()=>response(choices[Math.min(calls++,choices.length-1)]),show:s=>notices.push(s)};
 const auto=new AutoSession(targets,e=>events.push(e));return{auto,host,events,notices,timers,calls:()=>calls};
}
test('fresh instructions route Fable, Opus, Sonnet and preserve supported effort',async()=>{
 const t=setup(['fable','opus','sonnet']);const got=[];
 for(let i=1;i<=3;i++){const d=await t.auto.select(snapshot(i),boundary(0,[],{turnId:`t${i}`}),t.host);got.push(d?.model);d?.completed?.(d.model)}
 expect(got).toEqual(['claude-fable-5-1','claude-opus-5','claude-sonnet-5']);expect(t.calls()).toBe(3);
});
test('reuse between meaningful boundaries, then stop at three evaluations',async()=>{
 const t=setup(['fable','opus','sonnet']);const results=[];
 for(let i=0;i<9;i++)results.push(await t.auto.select(snapshot(),boundary(i,Array.from({length:i},(_,n)=>outcome(`r${n}`))),t.host));
 expect(t.calls()).toBe(3);expect(results[0]?.model).toBe('claude-fable-5-1');expect(results[1]?.model).toBe('claude-fable-5-1');
 expect(results[2]?.model).toBe('claude-opus-5');expect(results[4]?.model).toBe('claude-sonnet-5');expect(results[8]?.model).toBe('claude-sonnet-5');
});
test('routine progress cannot bounce back to an earlier model',async()=>{
 const t=setup();await t.auto.select(snapshot(),boundary(),t.host);
 await t.auto.select(snapshot(),boundary(1,[outcome('1')]),t.host);
 await t.auto.select(snapshot(),boundary(2,[outcome('1'),outcome('2')]),t.host);
 await t.auto.select(snapshot(),boundary(3,[outcome('1'),outcome('2'),outcome('3')]),t.host);
 const d=await t.auto.select(snapshot(),boundary(4,[1,2,3,4].map(n=>outcome(String(n)))),t.host);
 expect(d?.model).toBe('claude-opus-5');expect(t.events.some(e=>e.outcome==='reversal_held')).toBe(true);
});
test('fresh repeated failures can justify returning to Fable',async()=>{
 const t=setup();await t.auto.select(snapshot(),boundary(),t.host);
 await t.auto.select(snapshot(),boundary(1,[outcome('plan',false,'ExitPlanMode')]),t.host);
 const d=await t.auto.select(snapshot(),boundary(2,[outcome('plan',false,'ExitPlanMode'),outcome('f1',true),outcome('f2',true)]),t.host);
 expect(d?.model).toBe('claude-fable-5-1');expect(t.calls()).toBe(3);
});
test('failed plan approval and one error do not cause an immediate evaluation',async()=>{
 const t=setup();await t.auto.select(snapshot(),boundary(),t.host);
 await t.auto.select(snapshot(),boundary(1,[outcome('plan',true,'ExitPlanMode')]),t.host);expect(t.calls()).toBe(1);
});
test('compaction invalidates choice without resetting the instruction budget',async()=>{
 const t=setup(['opus']);for(let gen=1;gen<=5;gen++)await t.auto.select(snapshot(gen,1),boundary(gen),t.host);
 expect(t.calls()).toBe(3);
});
test('same boundary does not reevaluate and old tool results are not new evidence',async()=>{
 const t=setup();const b=boundary(0,[outcome('old1',true),outcome('old2',true)]);
 await t.auto.select(snapshot(),b,t.host);await t.auto.select(snapshot(),b,t.host);
 for(let i=1;i<5;i++)await t.auto.select(snapshot(),{...b,step:i},t.host);expect(t.calls()).toBe(1);
});
test('unsupported model, effort, numeric effort and shrinking a long-context selection are rejected',async()=>{
 for(const [targets,change] of [[{},{}],[catalog,{effort:'max'}],[catalog,{effort:99}],[catalog,{nativeModel:'claude-sonnet-5[1m]'}]] as any[]){
  const t=setup(['opus'],targets);expect(await t.auto.select(snapshot(),boundary(0,[],change),t.host)).toBeUndefined();
  expect(t.events.some(e=>e.outcome==='target_not_validated')).toBe(true);
 }
});
test('no previous-instruction choice survives evaluator failure',async()=>{
 const t=setup(['fable','unknown']);expect((await t.auto.select(snapshot(),boundary(),t.host))?.model).toBe('claude-fable-5-1');
 expect(await t.auto.select(snapshot(2),boundary(0,[],{turnId:'new'}),t.host)).toBeUndefined();
 expect(await t.auto.select(snapshot(2),boundary(1,[],{turnId:'new'}),t.host)).toBeUndefined();
});
test('manual stop and native errors prevent further evaluator or override calls',async()=>{
 for(const action of ['manual','error','mismatch']){
  const t=setup();const d=await t.auto.select(snapshot(),boundary(),t.host);
  expect(d?.valid?.()).toBe(true);
  if(action==='manual')t.auto.stop();else if(action==='error')d?.failed?.();else d?.completed?.('different-model');
  expect(d?.valid?.()).toBe(false);
  expect(await t.auto.select(snapshot(2),boundary(),t.host)).toBeUndefined();expect(t.calls()).toBe(1);
 }
});
test('a result invalidated while in flight cannot select a model',async()=>{
 const t=setup();let resolve:any; t.host.fetch=()=>new Promise(r=>resolve=r);
 const p=t.auto.select(snapshot(),boundary(),t.host);for(let i=0;i<20;i++)await Promise.resolve();t.auto.stop();
 expect(await p).toBeUndefined();resolve(response('fable'));for(let i=0;i<20;i++)await Promise.resolve();
 expect(t.events.some(e=>e.outcome==='request_selected')).toBe(false);
});
test('a timed-out new instruction cannot reuse the preceding choice or its own late reply',async()=>{
 const t=setup();await t.auto.select(snapshot(),boundary(),t.host);let resolve:any;
 t.host.fetch=()=>new Promise(r=>resolve=r);
 const pending=t.auto.select(snapshot(2),boundary(0,[],{turnId:'new'}),t.host);
 for(let i=0;i<20;i++)await Promise.resolve();t.timers.at(-1)!();expect(await pending).toBeUndefined();
 resolve(response('fable'));for(let i=0;i<20;i++)await Promise.resolve();
 expect(await t.auto.select(snapshot(2),boundary(1,[],{turnId:'new'}),t.host)).toBeUndefined();
 expect(t.events.filter(e=>e.outcome==='request_selected'&&e.generation===2)).toEqual([]);
});
test('session rebinding stops auto, concurrent registrations stay independent',async()=>{
 const a=setup(['fable']),b=setup(['opus']);
 expect((await a.auto.select(snapshot(),boundary(),a.host))?.model).toBe('claude-fable-5-1');
 expect((await b.auto.select(snapshot(),boundary(0,[],{sessionId:'b'}),b.host))?.model).toBe('claude-opus-5');
 expect(await a.auto.select(snapshot(),boundary(0,[],{sessionId:'b'}),a.host)).toBeUndefined();expect(a.calls()).toBe(1);
});
test('routing evidence pairs and deduplicates visible tool outcomes without reading inputs',()=>{
 const events=routingEvidence([{role:'assistant',text:'plan',toolUses:[{tool_use_id:'a',tool:'ExitPlanMode',text:'approved'}]},
  {role:'user',text:'',toolResults:[{tool_use_id:'a',text:'approved',isError:false},{tool_use_id:'b',text:'failed',isError:true}]}]);
 expect(events).toEqual([{id:'a',tool:'ExitPlanMode',error:false},{id:'b',tool:'Tool',error:true}]);
});
