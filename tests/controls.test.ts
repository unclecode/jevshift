import {effortAnswer} from './helpers/decision.ts';
import {test,expect} from 'bun:test';
import {SessionControls} from '../src/controls.ts';
const catalog={sonnet:{model:'claude-sonnet-5',efforts:['low']},opus:{model:'claude-opus-5[1m]',efforts:['low']},fable:{model:'claude-fable-5-1',efforts:['low']}};
const id={sessionId:'a',turnId:'turn',step:0,nativeModel:'claude-sonnet-5',effort:'low'} as any;
const snapshot={state:'<current_request>Design a system.</current_request>',meta:{ready:true,generation:1,instructionId:1}} as any;
function setup(store=new Map<string,unknown>(),enabled=true){
 let discoveries=0,calls=0;const c=new SessionControls(enabled);
 const host={get:async(k:string)=>store.get(k),set:async(k:string,v:unknown)=>{store.set(k,JSON.parse(JSON.stringify(v)))},discover:async()=>{discoveries++;return catalog}};
 const evaluator={now:async()=>0,after:()=>({cancel:()=>{}}),key:async()=> 'fake',show:()=>{},fetch:async()=>{calls++;return{ok:true,status:200,text:JSON.stringify({model:'typesafe/jev-1.13',answers:{effort_choice:effortAnswer('low'),model_choice:{type:'choice',choice:'fable',confidence:1,probabilities:{sonnet:0,opus:0,fable:1}}}})}}};
 return{c,host,evaluator,store,discoveries:()=>discoveries,calls:()=>calls};
}
test('pin/off never call evaluator; invalid inputs preserve accepted pin',async()=>{
 const t=setup();await t.c.bind('a','startup',t.host);expect(t.c.mode).toBe('observe');
 await t.c.command('pin opus',id.nativeModel);expect((await t.c.guard(id))?.model).toBe(catalog.opus.model);
 for(const cmd of ['pin unknown','pin claude-fable-does-not-exist','off extra','pin opus extra'])await t.c.command(cmd,id.nativeModel);
 expect(t.c.pin).toBe('opus');await t.c.select(snapshot,id,t.evaluator);expect(t.calls()).toBe(0);
 await t.c.command('off',id.nativeModel);expect((await t.c.select(snapshot,id,t.evaluator))?.model).toBe(id.nativeModel);expect(t.calls()).toBe(0);
});
test('same-ID resume restores pin; other IDs, clear and fork default observe',async()=>{
 const a=setup();await a.c.bind('a','startup',a.host);await a.c.command('pin opus',id.nativeModel);
 const b=setup(a.store);await b.c.bind('b','startup',b.host);await b.c.command('off',id.nativeModel);
 const r=setup(a.store);await r.c.bind('a','resume',r.host);expect(r.c.mode).toBe('pin');expect(r.discoveries()).toBe(0);
 expect((await r.c.guard(id))?.model).toBe(catalog.opus.model);expect(r.discoveries()).toBe(1);
 await r.c.bind('new','fork',r.host);expect(r.c.mode).toBe('observe');await r.c.bind('a','clear',r.host);expect(r.c.mode).toBe('observe');expect(b.c.mode).toBe('off');
});
test('malformed saved state defaults observe; missing restored pin blocks',async()=>{
 for(const s of [{version:9,sessionId:'a',mode:'auto'},{version:1,sessionId:'b',mode:'off'},{version:1,sessionId:'a',mode:'pin',pin:'garbage'}]){
 const t=setup(new Map([['session-v1:a',s]]));await t.c.bind('a','resume',t.host);expect(t.c.mode).toBe('observe');}
 const t=setup(new Map([['session-v1:a',{version:1,sessionId:'a',mode:'pin',pin:'claude-old-model'}]]));await t.c.bind('a','resume',t.host);expect((await t.c.guard(id))?.block).toBeTruthy();
});
test('manual native switches release pin; resume does not; native fallback blocks',async()=>{
 for(const source of ['command','picker','sdk']){const t=setup();await t.c.bind('a','startup',t.host);await t.c.command('pin opus',id.nativeModel);
 await t.c.nativeSwitch('resume',id.nativeModel);expect(t.c.mode).toBe('pin');await t.c.nativeSwitch(source,id.nativeModel);expect(t.c.mode).toBe('off');}
 const t=setup();await t.c.bind('a','startup',t.host);await t.c.command('pin opus',id.nativeModel);await t.c.nativeSwitch('auto',id.nativeModel);expect((await t.c.guard(id))?.block).toBeTruthy();
});
test('failed pin persists block; explicit re-pin retries; effort and response mismatch block',async()=>{
 const t=setup();await t.c.bind('a','startup',t.host);await t.c.command('pin opus',id.nativeModel);await (await t.c.guard(id))?.failed?.();expect((await t.c.guard(id))?.block).toBeTruthy();
 const r=setup(t.store);await r.c.bind('a','resume',r.host);expect((await r.c.guard(id))?.block).toBeTruthy();
 await t.c.command('pin opus',id.nativeModel);expect((await t.c.guard(id))?.block).toBeUndefined();await (await t.c.guard(id))?.completed?.('claude-sonnet-5');expect(t.c.blocked).toBe(true);
 await t.c.command('pin opus',id.nativeModel);expect(await t.c.guard({...id,effort:'max'})).toMatchObject({model:id.nativeModel,effort:'max'});expect(t.c.mode).toBe('off');
});
test('auto gated by default; enabled auto and restored auto discover before selection',async()=>{
 const no=setup(undefined,false);await no.c.bind('a','startup',no.host);await no.c.command('auto',id.nativeModel);expect(no.c.mode).toBe('observe');expect(no.discoveries()).toBe(0);
 const t=setup();await t.c.bind('a','startup',t.host);await t.c.command('auto',id.nativeModel);expect((await t.c.select(snapshot,id,t.evaluator))?.model).toBe(catalog.fable.model);
 const r=setup(t.store);await r.c.bind('a','resume',r.host);expect((await r.c.select(snapshot,id,r.evaluator))?.model).toBe(catalog.fable.model);expect(r.discoveries()).toBe(1);
});
test('pin supersedes waiting evaluator; subsequent observe shares outstanding-call guard',async()=>{
 const t=setup();await t.c.bind('a','startup',t.host);await t.c.command('auto',id.nativeModel);
 let finish:any,started:any;const running=new Promise<void>(r=>started=r);t.evaluator.fetch=()=>{started();return new Promise(r=>finish=r)};
 const decision=t.c.select(snapshot,id,t.evaluator);await running;await t.c.command('pin opus',id.nativeModel);expect((await decision)?.model).toBe(catalog.opus.model);
 await t.c.command('observe',id.nativeModel);expect((await t.c.select({...snapshot,meta:{...snapshot.meta,generation:2}},id,t.evaluator))?.model).toBe(id.nativeModel);finish({ok:false,status:500,text:'{}'});
});
test('status distinguishes all four models and old failure cannot stop a new pin',async()=>{
 const t=setup();await t.c.bind('a','startup',t.host);await t.c.command('auto',id.nativeModel);const s=await t.c.select(snapshot,id,t.evaluator);await s?.completed?.(catalog.fable.model);
 for(const part of ['Native default: claude-sonnet-5','Last Jev recommendation: fable','Last requested model: claude-fable-5-1','Last returned model: claude-fable-5-1'])expect(t.c.status()).toContain(part);
 await t.c.command('pin opus',id.nativeModel);await s?.failed?.();expect(t.c.mode).toBe('pin');expect(t.c.blocked).toBe(false);
});
test('slow discovery cannot undo off; persistence failure is visible',async()=>{
 const t=setup();let release:any;t.host.discover=()=>new Promise(r=>release=r);await t.c.bind('a','startup',t.host);const pin=t.c.command('pin opus',id.nativeModel);
 await Promise.resolve();await t.c.command('off',id.nativeModel);release(catalog);await pin;expect(t.c.mode).toBe('off');t.host.set=async()=>{throw Error('disk')};await t.c.command('observe',id.nativeModel);expect(t.c.status()).toContain('could not be saved');
});
test('old response cannot overwrite new session status or trigger a cross-session evaluation',async()=>{
 const t=setup();await t.c.bind('a','startup',t.host);await t.c.command('pin opus',id.nativeModel);const selection=await t.c.guard(id);
 await t.c.bind('b','clear',t.host);await selection?.completed?.(catalog.opus.model);expect(t.c.actual).toBeUndefined();
 expect(await t.c.select(snapshot,id,t.evaluator)).toBeUndefined();expect(t.calls()).toBe(0);
});
test('overlapping session loads retain the current load promise',async()=>{
 const t=setup();let a:any,b:any,reads=0;
 t.host.get=(key:string)=>{reads++;return new Promise(r=>key.endsWith(':a')?a=r:b=r)};
 const first=t.c.bind('a','resume',t.host),second=t.c.bind('b','resume',t.host);a(undefined);await first;
 const again=t.c.bind('b','resume',t.host);b({version:1,sessionId:'b',mode:'off'});await Promise.all([second,again]);expect(reads).toBe(2);expect(t.c.mode).toBe('off');
});
test('stale failed pin discovery cannot mark a new session blocked',async()=>{
 const t=setup(new Map([['session-v1:a',{version:1,sessionId:'a',mode:'pin',pin:catalog.opus.model}]]));let reject:any;
 t.host.discover=()=>new Promise((_,r)=>reject=r);await t.c.bind('a','resume',t.host);const pending=t.c.guard(id);await Promise.resolve();
 await t.c.bind('b','clear',t.host);reject(Error('old failure'));await pending;expect(t.c.mode).toBe('observe');expect(t.c.blocked).toBe(false);expect(t.c.nativeModel).toBe('unknown');
});

test('status explains timeout, records later success and clears across sessions',async()=>{
 const {TransportError}=await import('../src/transport.ts');const t=setup();await t.c.bind('a','startup',t.host);
 const good=t.evaluator.fetch;t.evaluator.fetch=async()=>{throw new TransportError('transport_timeout')};
 const first=await t.c.select(snapshot,id,t.evaluator);expect(first?.model).toBe(id.nativeModel);
 expect(t.c.status()).toContain('Last Jev result: timed out (0 ms)');expect(t.c.status()).toContain('Last Jev recommendation: none');
 t.evaluator.fetch=good;await t.c.select({...snapshot,meta:{...snapshot.meta,generation:2}},id,t.evaluator);
 expect(t.c.status()).toContain('Last Jev result: recommended (0 ms)');expect(t.c.status()).toContain('Last Jev recommendation: fable');
 await t.c.bind('b','startup',t.host);expect(t.c.status()).toContain('Last Jev result: none');
});
