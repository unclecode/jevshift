import {test,expect} from 'bun:test';
import {parseCatalog,resolveTarget} from '../src/catalog.ts';
import {discoverCatalog} from '../src/discovery.ts';
import {SessionControls} from '../src/controls.ts';
import type {Catalog} from '../src/auto.ts';
import {decisionReply} from './helpers/decision.ts';
import {AutoSession} from '../src/auto.ts';
const old='claude-opus-5',latest='claude-opus-5-5';
const row=(model:string,extra:Record<string,unknown>={})=>({value:model,resolvedModel:model,supportedEffortLevels:['low','high'],...extra});
const response=(models:unknown[],resolved:unknown=latest)=>[
 {type:'control_response',response:{subtype:'success',request_id:'jevshift-catalog',response:{models,account:{email:'not retained'}}}},
 {type:'control_response',response:{subtype:'success',request_id:'jevshift-resolved',response:{applied:{model:resolved},unrelated:'not retained'}}},
].map(x=>JSON.stringify(x)).join('\n');
const catalog=(model=latest):Catalog=>({opus:parseCatalog(response([row(old),row(latest)],model),'opus')});
const id={sessionId:'a',turnId:'t',step:0,nativeModel:'claude-sonnet-5',effort:'low'} as const;
const snapshot={state:'<current_request>Implement the agreed plan.</current_request>',meta:{ready:true,generation:1,instructionId:1}} as any;
const evaluator={now:async()=>0,after:()=>({cancel:()=>{}}),key:async()=> 'synthetic',show:()=>{},fetch:async()=>decisionReply('opus','low')};
function setup(){
 let current=catalog(old),calls=0;const store=new Map();
 const host={get:async(k:string)=>store.get(k),set:async(k:string,v:unknown)=>{store.set(k,v)},discover:async()=>{calls++;return current}};
 return{host,store,calls:()=>calls,upgrade:()=>{current=catalog()},removeOld:()=>{current={opus:{model:latest,efforts:['low','high']}}}};
}
test('alias resolution wins over catalog order, a larger version number, and the default row',()=>{
 for(const rows of [[row(old),row(latest)],[row(latest),row(old)]]){
  expect(parseCatalog(response(rows),'opus').model).toBe(latest);
  expect(parseCatalog(response(rows,old),'opus').model).toBe(old);
 }
 expect(parseCatalog(response([row(old,{value:'default'}),row(latest,{value:'opus'})]),'opus').model).toBe(latest);
});
test('Fable may be a concrete menu row; context variant stays in the resolved version',()=>{
 const fable='claude-fable-5-1';expect(parseCatalog(response([row(fable)],fable),'fable').model).toBe(fable);
 const parsed=parseCatalog(response([row(old),row(latest+'[1m]')]),'opus');
 expect(parsed.model).toBe(latest+'[1m]');expect(resolveTarget({opus:parsed},latest)?.target.model).toBe(latest);
 expect(parseCatalog(response([row(latest+'[1m]'),row(latest)]),'opus').model).toBe(latest);
});
test('resolution needs matching capabilities and rejects disabled, conflicting and wrong-family results',()=>{
 for(const body of [response([row(old)]),response([row(latest,{disabled:true})]),response([row(latest,{supportsEffort:false})]),
  response([row(latest,{supportedEffortLevels:['unknown']})]),response([row(latest),row(latest,{disabled:true})]),
  response([row(latest,{disabled:true}),row(latest+'[1m]')]),response([row(latest)],'claude-sonnet-5'),'{}','bad'])expect(()=>parseCatalog(body,'opus')).toThrow();
 const body=response([row(latest,{supportedEffortLevels:['low','high']}),row(latest,{supportedEffortLevels:['high']})]);
 expect(parseCatalog(body,'opus').efforts).toEqual(['high']);
 expect(JSON.stringify(parseCatalog(response([row(latest)]),'opus'))).not.toContain('not retained');
});
test('exact older pins remain available, without becoming automatic alternatives',()=>{
 const c=catalog();expect(c.opus?.model).toBe(latest);
 expect(resolveTarget(c,old)?.target.model).toBe(old);expect(resolveTarget(c,'opus')?.target.model).toBe(latest);
 expect(resolveTarget(c,'claude-opus-unknown')).toBeUndefined();
});
test('family routing preserves 1M context using only the resolved version; exact pins stay exact',async()=>{
 const c:Catalog={opus:parseCatalog(response([row(old+'[1m]'),row(latest),row(latest+'[1m]')]),'opus')};
 const long={...id,nativeModel:'claude-sonnet-5[1m]'};
 expect(resolveTarget(c,'opus',long.nativeModel)?.target.model).toBe(latest+'[1m]');
 expect(resolveTarget(c,latest,long.nativeModel)?.target.model).toBe(latest);
 expect((await new AutoSession(c).select(snapshot,long,evaluator))?.model).toBe(latest+'[1m]');
 const missing:Catalog={opus:parseCatalog(response([row(old+'[1m]'),row(latest)]),'opus')};
 expect(await new AutoSession(missing).select(snapshot,long,evaluator)).toBeUndefined();
 const controls=new SessionControls(true),t=setup();t.host.discover=async()=>c;
 await controls.bind('a','startup',t.host);await controls.command('pin opus',long.nativeModel);
 expect((await controls.guard(long))?.model).toBe(latest+'[1m]');
});
test('no-inference helpers resolve each alias; one unavailable family does not hide the others',async()=>{
 const seen:string[]=[];
 const c=await discoverCatalog(async(argv,init)=>{
  const tier=argv.at(-1)!;seen.push(tier);expect(argv).toContain('--safe-mode');expect(argv).toContain('--model');
  expect(init.stdin).not.toContain('"type":"user"');expect(init.stdin).toContain('get_settings');expect(init.timeoutMs).toBe(8000);
  if(tier==='fable')return{exitCode:1,stdout:''};
  const model=tier==='opus'?latest:'claude-sonnet-5';return{exitCode:0,stdout:response([row(model)],model)};
 },'claude');
 expect(seen.sort()).toEqual(['fable','opus','sonnet']);expect(Object.keys(c).sort()).toEqual(['opus','sonnet']);
 expect(discoverCatalog(async()=>({exitCode:1,stdout:''}),'claude')).rejects.toThrow();
});
test('startup discovery caches per process and refresh preserves auto and fixed effort',async()=>{
 const t=setup(),c=new SessionControls(true);await c.bind('a','startup',t.host);await c.warmCatalog();expect(t.calls()).toBe(1);
 await c.command('auto',id.nativeModel);await c.command('effort high',id.nativeModel);expect(t.calls()).toBe(1);t.upgrade();
 await c.command('refresh',id.nativeModel);expect(t.calls()).toBe(2);expect(c.mode).toBe('auto');expect(c.effort).toBe('high');
 expect((await c.select(snapshot,id,evaluator))?.model).toBe(latest);expect(c.status()).toContain('opus = '+latest);
 const resumed=new SessionControls(true);await resumed.bind('a','resume',t.host);await resumed.warmCatalog();expect(t.calls()).toBe(3);
});
test('family pin follows refresh and resume; explicit and legacy version pins stay fixed',async()=>{
 for(const input of ['opus',old]){
  const t=setup(),c=new SessionControls(true);await c.bind('a','startup',t.host);await c.warmCatalog();await c.command('pin '+input+' high',id.nativeModel);
  t.upgrade();await c.command('refresh',id.nativeModel);expect(c.mode).toBe('pin');expect(c.effort).toBe('high');
  expect((await c.guard(id))?.model).toBe(input==='opus'?latest:old);
  const next=new SessionControls(true);await next.bind('a','resume',t.host);await next.warmCatalog();expect((await next.guard(id))?.model).toBe(input==='opus'?latest:old);
 }
 const t=setup();t.upgrade();t.store.set('session-v1:a',{version:1,sessionId:'a',mode:'pin',pin:old});
 const legacy=new SessionControls(true);await legacy.bind('a','resume',t.host);await legacy.warmCatalog();expect((await legacy.guard(id))?.model).toBe(old);
});
test('a removed exact pin blocks instead of silently switching to the current alias',async()=>{
 const t=setup(),c=new SessionControls(true);await c.bind('a','startup',t.host);await c.command('pin '+old,id.nativeModel);
 t.removeOld();await c.command('refresh',id.nativeModel);expect((await c.guard(id))?.block).toBeTruthy();expect(c.pin).toBe(old);
});
test('refresh invalidates an outstanding choice, and cannot override a newer command',async()=>{
 const t=setup(),c=new SessionControls(true);await c.bind('a','startup',t.host);await c.command('auto',id.nativeModel);
 let ready!:()=>void,release:any;const started=new Promise<void>(r=>ready=r);
 const pending=c.select(snapshot,id,{...evaluator,fetch:async()=>{ready();return new Promise(r=>release=r)}});await started;
 t.upgrade();await c.command('refresh',id.nativeModel);expect((await pending)?.model).not.toBe(old);release(decisionReply('opus','low'));
 let discover:any;t.host.discover=()=>new Promise(r=>discover=r);const refreshing=c.command('refresh',id.nativeModel);
 await c.command('off',id.nativeModel);discover(catalog());expect(await refreshing).toContain('discarded');expect(c.mode).toBe('off');
});
test('refresh while Jev is pending still applies an explicit effort at the request boundary',async()=>{
 const t=setup(),c=new SessionControls(true);await c.bind('a','startup',t.host);
 await c.command('auto',old);await c.command('effort high',old);
 let ready!:()=>void,release:any;const started=new Promise<void>(r=>ready=r),boundary={...id,nativeModel:old};
 const pending=c.select(snapshot,boundary,{...evaluator,fetch:async()=>{ready();return new Promise(r=>release=r)}});await started;
 t.upgrade();await c.command('refresh',old);const selected=await pending;
 expect(await c.finalize(selected,boundary)).toMatchObject({model:old,effort:'high'});release(decisionReply('opus','low'));
});
test('late startup discovery cannot overwrite a successful refresh; failure preserves controls',async()=>{
 const t=setup(),c=new SessionControls(true);let release:any,n=0;
 t.host.discover=()=>++n===1?new Promise(r=>release=r):Promise.resolve(catalog());
 await c.bind('a','startup',t.host);const warm=c.warmCatalog();await c.command('refresh',id.nativeModel);release(catalog(old));await warm;
 expect(c.catalog.opus?.model).toBe(latest);await c.command('pin opus',id.nativeModel);
 t.host.discover=async()=>{throw Error('offline')};expect(await c.command('refresh',id.nativeModel)).toContain('unchanged');
 expect((await c.guard(id))?.model).toBe(latest);
});
