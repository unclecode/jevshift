import {fakeCurl} from './helpers/fake-curl.ts';
import {test,expect} from 'bun:test';
import {registerAutoHooks} from '../src/auto-hooks.ts';
function setup(){
 const hooks:Record<string,Function>={},messages:any[]=[],events:any[]=[];let fetches=0;
 registerAutoHooks(((n:string,f:Function)=>hooks[n]=f) as any,{openrouter_api_key:'test-key'},
  {fable:{model:'claude-fable-5-1',efforts:['low']}},e=>events.push(e));
 const $={env:{get:async()=>undefined},session:{id:async()=> 'a',messages:async()=>messages},clock:{now:async()=>0,after:()=>({cancel:()=>{}})},ui:{status:()=>{},log:()=>{}},
  http:{fetch:async()=>{fetches++;return{ok:true,status:200,text:JSON.stringify({model:'typesafe/jev-1.13',answers:{model_choice:{type:'choice',choice:'fable',confidence:1,probabilities:{sonnet:0,opus:0,fable:1}}}})}}}};
 Object.assign($,{process:{run:fakeCurl($.http.fetch)}});
 return {hooks,messages,$,events,fetches:()=>fetches};
}
async function begin(t:ReturnType<typeof setup>){
 await t.hooks['prompt.submit'](t.$,{text:'Design a system.',origin:{kind:'sdk'},wait:false},async(e:any)=>{t.messages.push({role:'user',text:e.text});return e});
 await t.hooks['turn.start'](t.$,{text:'Design a system.',turnId:'t'},async()=>({}));
}
test('auto rewrites only model and effort, preserves every chunk/result and next is called once',async()=>{
 const t=setup();await begin(t);const e={turnId:'t',index:0,model:'claude-sonnet-5',effort:'low',messageCount:1};let calls=0;
 const chunks=[{kind:'thinking',text:'not evaluator evidence'},{kind:'text',text:'answer'}],result={usage:{model:'claude-fable-5-1'},answer:'answer'};
 async function* next(x:any){calls++;expect(x).toEqual({...e,model:'claude-fable-5-1'});yield* chunks;return result}
 const s=t.hooks['turn.step'](t.$,e,next),got=[];let last;
 while(true){const n=await s.next();if(n.done){last=n.value;break}got.push(n.value)}
 expect(got).toEqual(chunks);expect(last).toBe(result);expect(calls).toBe(1);expect(t.fetches()).toBe(1);
 expect(t.events.some(e=>e.outcome==='response_observed'&&e.actualModel==='claude-fable-5-1')).toBe(true);
});
test('subagents bypass selection and manual native model changes stop auto',async()=>{
 const t=setup();await begin(t);const base={turnId:'t',index:0,model:'claude-sonnet-5',effort:'low',messageCount:1};
 const worker={...base,agentId:'worker'};async function* pass(e:any){expect(e).toBe(worker);return {}}
 for await(const x of t.hooks['turn.step'](t.$,worker,pass)){} expect(t.fetches()).toBe(0);
 await t.hooks['classic.PostModelSwitch'](t.$,{source:'sdk'},async(e:any)=>e);
 async function* native(e:any){expect(e).toBe(base);return{}}
 for await(const x of t.hooks['turn.step'](t.$,base,native)){} expect(t.fetches()).toBe(0);
});
test('native provider error is rethrown identically and the request is not replayed',async()=>{
 const t=setup();await begin(t);const error=new Error('provider failed');let calls=0;
 async function* failed(){calls++;throw error}
 const stream=t.hooks['turn.step'](t.$,{turnId:'t',index:0,model:'claude-sonnet-5',effort:'low'},failed);
 try{await stream.next();throw Error('expected failure')}catch(e){expect(e).toBe(error)}
 expect(calls).toBe(1);expect(t.events.some(e=>e.outcome==='native_request_failed')).toBe(true);
});
test('a native failure returned without throwing also stops auto, preserving the result',async()=>{
 const t=setup();await begin(t);const result={usage:null,stopReason:null,answer:''};let calls=0;
 async function* failed(){calls++;return result}
 const e={turnId:'t',index:0,model:'claude-sonnet-5',effort:'low'};
 const stream=t.hooks['turn.step'](t.$,e,failed);expect((await stream.next()).value).toBe(result);
 async function* native(actual:any){expect(actual.model).toBe(e.model);return {}}
 for await(const x of t.hooks['turn.step'](t.$,{...e,index:1},native)){}
 expect(calls).toBe(1);expect(t.fetches()).toBe(1);expect(t.events.some(e=>e.outcome==='native_request_failed')).toBe(true);
});
