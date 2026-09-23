import {test,expect} from 'bun:test';
import {decisionReply} from './helpers/decision.ts';
import {EFFORTS} from '../src/effort.ts';
import {requestBody,parseReply} from '../src/jev.ts';
import {AutoSession} from '../src/auto.ts';
import {SessionControls} from '../src/controls.ts';
import {buildContext} from '../src/context.ts';
const catalog={sonnet:{model:'claude-sonnet-5',efforts:EFFORTS},opus:{model:'claude-opus-5-5',efforts:EFFORTS},fable:{model:'claude-fable-5-1',efforts:EFFORTS}};
const id={sessionId:'a',turnId:'t',step:0,nativeModel:'claude-opus-5-5',effort:'low'} as any;
const snapshot=(n=1)=>buildContext([],{text:'Implement the agreed algorithm.',origin:'sdk',generation:n,instructionId:n});
function setup(){
 let model='opus',effort='high',calls=0;const bodies:any[]=[],store=new Map();
 const host={get:async(k:string)=>store.get(k),set:async(k:string,v:unknown)=>{store.set(k,v)},discover:async()=>catalog};
 const evaluator={now:async()=>0,after:()=>({cancel:()=>{}}),key:async()=> 'test',show:()=>{},fetch:async(_url:string,init:any)=>{calls++;bodies.push(JSON.parse(init.body));return decisionReply(model,effort)}};
 const c=new SessionControls(true);return{c,host,evaluator,bodies,store,calls:()=>calls,pick:(m:string,e:string)=>{model=m;effort=e}};
}
test('requires both choices unless a dimension is explicitly fixed',()=>{
 const reply=decisionReply(),x=JSON.parse(reply.text);delete x.answers.effort_choice;
 expect(parseReply({...reply,text:JSON.stringify(x)}).outcome).toBe('invalid_response');
 expect(parseReply({...reply,text:JSON.stringify(x)},{fixedEffort:'medium'}).decision?.effort).toBe('medium');
 delete x.answers.model_choice;x.answers=JSON.parse(reply.text).answers;delete x.answers.model_choice;
 expect(parseReply({...reply,text:JSON.stringify(x)},{pinnedModel:'fable'}).decision).toMatchObject({choice:'fable',effort:'high'});
 for(const effort of ['unknown',99,null]){const r=JSON.parse(reply.text);r.answers.effort_choice.choice=effort;
  expect(parseReply({...reply,text:JSON.stringify(r)}).outcome).toBe('invalid_response');}
});
test('large context retains verified request within full payload limit',()=>{
 const snap=buildContext(Array.from({length:12},(_,i)=>({role:(i%2?'assistant':'user') as any,text:'Plan '+('evidence '.repeat(300))})),
  {text:'Keep this verified request intact.',origin:'sdk',generation:1});
 const body=requestBody(snap.state!,{catalog});expect(body).not.toBeNull();expect(new TextEncoder().encode(body!).length).toBeLessThanOrEqual(9000);
 expect(JSON.parse(body!).state).toContain('<current_request>\nKeep this verified request intact.\n</current_request>');
 expect(JSON.parse(body!).state).toContain('allowed effort: low, medium, high, xhigh, max');
});
test('one native model can use every effort across fresh instructions',async()=>{
 const t=setup();await t.c.bind('a','startup',t.host);await t.c.command('auto',id.nativeModel);
 for(let i=0;i<EFFORTS.length;i++){
  t.pick('opus',EFFORTS[i]);const s=await t.c.select(snapshot(i+1),{...id,turnId:`t${i}`},t.evaluator);
  expect(s).toMatchObject({model:catalog.opus.model,effort:EFFORTS[i]});await s?.completed?.(catalog.opus.model);
 }
 expect(t.calls()).toBe(5);expect(t.c.status()).toContain('Last requested effort: max');
 expect(t.c.status()).toContain('Native effort: low');
});
test('model pin alone keeps native effort; pin both makes no Jev calls',async()=>{
 const t=setup();await t.c.bind('a','startup',t.host);await t.c.command('pin opus',id.nativeModel);
 expect(await t.c.select(snapshot(),id,t.evaluator)).toMatchObject({model:catalog.opus.model,effort:'low'});
 await t.c.command('pin fable xhigh',id.nativeModel);
 expect(await t.c.select(snapshot(2),id,t.evaluator)).toMatchObject({model:catalog.fable.model,effort:'xhigh'});expect(t.calls()).toBe(0);
});
test('fixed model with automatic effort asks only effort; fixed effort asks only model',async()=>{
 const t=setup();await t.c.bind('a','startup',t.host);await t.c.command('pin fable',id.nativeModel);await t.c.command('effort auto',id.nativeModel);
 t.pick('opus','max');const s=await t.c.select(snapshot(),id,t.evaluator);
 expect(s).toMatchObject({model:catalog.fable.model,effort:'max',stopFallback:true});
 expect(Object.keys(t.bodies[0].questions)).toEqual(['effort_choice']);
 await t.c.command('auto',id.nativeModel);await t.c.command('effort medium',id.nativeModel);t.pick('sonnet','max');
 expect(await t.c.select(snapshot(2),id,t.evaluator)).toMatchObject({model:catalog.sonnet.model,effort:'medium'});
 expect(Object.keys(t.bodies[1].questions)).toEqual(['model_choice']);
});
test('observe recommends both without rewriting either, and off restores both',async()=>{
 const t=setup();await t.c.bind('a','startup',t.host);t.pick('fable','max');
 expect(await t.c.select(snapshot(),id,t.evaluator)).toMatchObject({model:id.nativeModel,effort:'low'});
 expect(t.c.status()).toContain('Last Jev effort: max');
 await t.c.command('pin fable max',id.nativeModel);await t.c.command('off',id.nativeModel);
 expect(await t.c.select(snapshot(2),id,t.evaluator)).toMatchObject({model:id.nativeModel,effort:'low'});expect(t.calls()).toBe(1);
});
test('explicit native effort command or a changed incoming effort releases plugin control',async()=>{
 const t=setup();await t.c.bind('a','startup',t.host);await t.c.command('auto',id.nativeModel);await t.c.select(snapshot(),id,t.evaluator);
 await t.c.nativeEffortCommand();expect(t.c.mode).toBe('off');
 await t.c.command('auto',id.nativeModel);
 expect(await t.c.select(snapshot(2),{...id,effort:'medium'},t.evaluator)).toMatchObject({model:id.nativeModel,effort:'medium'});
 expect(t.c.mode).toBe('off');expect(t.calls()).toBe(1);
});
test('effort policy persists for same session and clears across sessions',async()=>{
 const t=setup();await t.c.bind('a','startup',t.host);await t.c.command('pin opus xhigh',id.nativeModel);
 const c=new SessionControls(true);await c.bind('a','resume',t.host);expect(c.effort).toBe('xhigh');
 expect(await c.guard(id)).toMatchObject({model:catalog.opus.model,effort:'xhigh'});
 await c.bind('b','fork',t.host);expect(c.effort).toBe('auto');expect(c.mode).toBe('observe');
});
test('invalid effort reply cannot apply the otherwise valid model',async()=>{
 const t=setup();await t.c.bind('a','startup',t.host);await t.c.command('auto',id.nativeModel);t.pick('fable','unknown');
 expect(await t.c.select(snapshot(),id,t.evaluator)).toMatchObject({model:id.nativeModel,effort:'low'});
});
test('model capabilities and configured cap reject unsupported choices',async()=>{
 const t=setup(),c=new SessionControls(true,()=>{},'high');await c.bind('a','startup',t.host);await c.command('auto',id.nativeModel);t.pick('fable','max');
 expect(await c.select(snapshot(),id,t.evaluator)).toMatchObject({model:id.nativeModel,effort:'low'});
 expect(await c.command('effort max',id.nativeModel)).toContain('exceeds');expect(c.effort).toBe('auto');
 const a=new AutoSession({opus:{model:catalog.opus.model,efforts:['low']}});t.pick('opus','high');
 expect(await a.select(snapshot(),id,t.evaluator)).toBeUndefined();
});
test('late evaluator answer cannot undo a new pair pin',async()=>{
 const t=setup();await t.c.bind('a','startup',t.host);await t.c.command('auto',id.nativeModel);
 let release:any,ready:any;const started=new Promise<void>(r=>ready=r);
 t.evaluator.fetch=async()=>{ready();return new Promise(r=>release=r)};
 const pending=t.c.select(snapshot(),id,t.evaluator);await started;
 await t.c.command('pin sonnet medium',id.nativeModel);
 expect(await pending).toMatchObject({model:catalog.sonnet.model,effort:'medium'});release(decisionReply('fable','max'));
 expect(t.c.effort).toBe('medium');
});
test('evaluator failure retains explicit effort or model pins without reusing an old recommendation',async()=>{
 const t=setup();await t.c.bind('a','startup',t.host);await t.c.command('auto',id.nativeModel);await t.c.command('effort medium',id.nativeModel);
 t.evaluator.fetch=async()=>{throw Error('offline')};
 expect(await t.c.select(snapshot(),id,t.evaluator)).toMatchObject({model:id.nativeModel,effort:'medium'});
 await t.c.command('pin fable',id.nativeModel);await t.c.command('effort auto',id.nativeModel);
 expect(await t.c.select(snapshot(2),id,t.evaluator)).toMatchObject({model:catalog.fable.model,effort:'low'});
});
test('same-model effort changes do not oscillate on routine progress',async()=>{
 const t=setup(),auto=new AutoSession(catalog);t.pick('opus','high');
 expect((await auto.select(snapshot(),id,t.evaluator))?.effort).toBe('high');t.pick('opus','medium');
 const s=snapshot(),outcomes=[{id:'p',tool:'ExitPlanMode',error:false}];
 expect((await auto.select(s,{...id,step:1,outcomes},t.evaluator))?.effort).toBe('medium');
 t.pick('opus','high');await auto.select(s,{...id,step:2,outcomes:[...outcomes,{id:'r1',tool:'Read',error:false}]},t.evaluator);
 expect((await auto.select(s,{...id,step:3,outcomes:[...outcomes,{id:'r1',tool:'Read',error:false},{id:'r2',tool:'Read',error:false}]},t.evaluator))?.effort).toBe('medium');
});
