import {effortAnswer} from './helpers/decision.ts';
import {fakeCurl} from './helpers/fake-curl.ts';
import {test,expect} from 'bun:test';
import {registerObserveHooks} from '../src/observe-hooks.ts';
test('full observe adapter leaves event, stream and terminal result unchanged exactly once',async()=>{
 const hooks:Record<string,Function>={},logs:string[]=[],messages:any[]=[];let fetches=0,envReads=0,continuations=0;
 registerObserveHooks(((n:string,fn:Function)=>hooks[n]=fn) as any,{use_environment_key:true});
 const $={session:{id:async()=> 'a',messages:async()=>messages},clock:{now:async()=>0,after:()=>({cancel:()=>{}})},
  env:{get:async(name:string)=>{if(name==='CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC')return undefined;envReads++;return 'synthetic-test-key'}},ui:{status:()=>{},log:(s:string)=>logs.push(s)},http:{fetch:async()=>{fetches++;return{ok:true,status:200,text:JSON.stringify({model:'typesafe/jev-1.13',answers:{effort_choice:effortAnswer('low'),model_choice:{type:'choice',choice:'fable',confidence:1,probabilities:{sonnet:0,opus:0,fable:1}}}})}}}};
 Object.assign($,{process:{run:fakeCurl($.http.fetch)}});
 await hooks['prompt.submit']($,{text:'Design the new architecture.',origin:{kind:'sdk'},wait:false},async(e:any)=>{messages.push({role:'user',text:e.text,toolUses:[]});return e});
 await hooks['turn.start']($,{text:'Design the new architecture.',turnId:'t'},async()=>({}));
 const event={turnId:'t',index:0,model:'claude-sonnet-5',effort:'high',messageCount:1};
 const chunks=[{kind:'thinking',text:'private'},{kind:'text',text:'answer'}],result={success:true};
 async function* next(e:any){expect(e).toBe(event);continuations++;yield* chunks;return result}
 const stream=hooks['turn.step']($,event,next),got=[];let final;
 while(true){const n=await stream.next();if(n.done){final=n.value;break}got.push(n.value)}
 expect(got).toEqual(chunks);expect(final).toBe(result);expect(continuations).toBe(1);expect(fetches).toBe(1);expect(envReads).toBe(1);
 expect(logs.some(s=>s.includes('recommend Fable / low; keeping claude-sonnet-5'))).toBe(true);
});
test('key environment is opt-in and a configured sensitive option takes precedence',async()=>{
 for(const options of [{},{openrouter_api_key:'synthetic-option-key',use_environment_key:true}]){
  const hooks:Record<string,Function>={},messages:any[]=[];let env=0,fetch=0;
  registerObserveHooks(((n:string,fn:Function)=>hooks[n]=fn) as any,options);
  const $={session:{id:async()=> 'a',messages:async()=>messages},clock:{now:async()=>0,after:()=>({cancel:()=>{}})},env:{get:async(name:string)=>{if(name==='CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC')return undefined;env++;return 'never'}},
   ui:{status:()=>{},log:()=>{}},http:{fetch:async(url:any,init:any)=>{fetch++;expect(init.headers.Authorization).toBe('Bearer synthetic-option-key');return{ok:false,status:429,text:'{}'}}}};
  Object.assign($,{process:{run:fakeCurl($.http.fetch)}});
 await hooks['prompt.submit']($,{text:'hello',origin:{kind:'sdk'},wait:false},async(e:any)=>{messages.push({role:'user',text:e.text});return e});
  await hooks['turn.start']($,{text:'hello',turnId:'t'},async()=>({}));
  async function* next(){return {}}
  for await(const x of hooks['turn.step']($,{turnId:'t',index:0,model:'sonnet'},next)){}
  expect(env).toBe(0);expect(fetch).toBe('openrouter_api_key' in options?1:0);
 }
});
test('native nonessential-network opt-out prevents starting any evaluator process',async()=>{
 const hooks:Record<string,Function>={},messages:any[]=[];let calls=0;const events:any[]=[];
 registerObserveHooks(((name:string,fn:Function)=>hooks[name]=fn) as any,{openrouter_api_key:'synthetic'},e=>events.push(e));
 const $={session:{id:async()=> 'a',messages:async()=>messages},clock:{now:async()=>0,after:()=>({cancel:()=>{}})},ui:{log:()=>{},status:()=>{}},
 env:{get:async(name:string)=>name==='CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC'?'1':undefined},process:{run:async()=>{calls++;throw Error('must not run')}}};
 await hooks['prompt.submit']($,{text:'Design a component.',origin:{kind:'sdk'},wait:false},async(e:any)=>{messages.push({role:'user',text:e.text});return e});
 await hooks['turn.start']($,{text:'Design a component.',turnId:'t'},async()=>({}));
 async function* next(e:any){expect(e.model).toBe('claude-sonnet-5');return{}}
 for await(const x of hooks['turn.step']($,{turnId:'t',index:0,model:'claude-sonnet-5'},next)){}
 expect(calls).toBe(0);expect(events.at(-1)).toMatchObject({outcome:'transport_disabled',billing:'not_requested'});
});
