import {test,expect} from 'bun:test';
import {registerControlHooks} from '../src/controls-hooks.ts';
function setup(){
 const hooks:Record<string,Function>={},store=new Map(),messages:any[]=[],commands:any[]=[];let aborts=0,fetches=0,processes=0;
 registerControlHooks(((name:string,...args:any[])=>{hooks[name]=args.at(-1)}) as any,{});
 const $={session:{id:async()=> 'a',model:async()=> 'claude-sonnet-5',messages:async()=>messages},store:{get:async(k:string)=>store.get(k),set:async(k:string,v:any)=>{store.set(k,v)}},
 process:{run:async(argv:string[],init:any)=>{processes++;expect(argv).toContain('--safe-mode');expect(init.stdin).not.toContain('"type":"user"');
  return{exitCode:0,stdout:[{type:'control_response',response:{subtype:'success',request_id:'jevshift-catalog',response:{models:[{value:'opus[1m]',resolvedModel:'claude-opus-5[1m]',supportedEffortLevels:['low']}]}}},
    {type:'control_response',response:{subtype:'success',request_id:'jevshift-resolved',response:{applied:{model:'claude-opus-5[1m]'}}}}].map(x=>JSON.stringify(x)).join('\n')}}},
 command:{register:async(x:any)=>{commands.push(x)}},turn:{abort:async()=>{aborts++}},ui:{log:()=>{},status:()=>{}},clock:{now:async()=>0,after:()=>({cancel:()=>{}})},http:{fetch:async()=>{fetches++;throw Error('Must not fetch')}},env:{get:async()=>undefined}};
 const start=async()=>{await hooks['classic.SessionStart']($,{source:'startup'},async()=>({}));await hooks['session.start']($,{},async()=>({}))};
 const command=(args:string)=>hooks['command.run']($,{command:'jevshift',args});
 const step=(next:any)=>hooks['turn.step']($,{turnId:'t',index:0,model:'claude-sonnet-5',effort:'low'},next);
 return{hooks,$,store,commands,start,command,step,aborts:()=>aborts,fetches:()=>fetches,processes:()=>processes};
}
test('native command registers immediate, needs no key, invokes no model; status reports returned model',async()=>{
 const t=setup();await t.start();expect(t.commands[0].immediate).toBe(true);await t.command('pin opus');
 const result={usage:{model:'claude-opus-5'},answer:'unchanged',stopReason:'end_turn'};let calls=0;
 async function* next(e:any){calls++;expect(e.model).toBe('claude-opus-5[1m]');yield{kind:'text',text:'exact'};return result}
 const stream=t.step(next);expect((await stream.next()).value).toEqual({kind:'text',text:'exact'});expect((await stream.next()).value).toBe(result);
 expect((await t.command('status')).text).toContain('Last returned model: claude-opus-5');expect(t.fetches()).toBe(0);expect(calls).toBe(1);expect(t.processes()).toBe(3);
});
test('native overload fallback is aborted and subsequent pinned prompts send no request',async()=>{
 const t=setup();await t.start();await t.command('pin opus');let calls=0;
 async function* next(){calls++;throw Error('Model fallback triggered: sonnet')}
 expect((await t.step(next).next()).value.stopReason).toBeNull();expect(t.aborts()).toBe(1);
 expect((await t.step(next).next()).value.stopReason).toBeNull();expect(calls).toBe(1);expect(t.aborts()).toBe(2);
 await t.command('off');async function* native(e:any){expect(e.model).toBe('claude-sonnet-5');return {answer:'native'}}
 expect((await t.step(native).next()).value.answer).toBe('native');
});
test('native ordinary error is preserved exactly and a returned failure blocks the next pin request',async()=>{
 const t=setup();await t.start();await t.command('pin opus');const error=Error('404');
 async function* throwing(){throw error}try{await t.step(throwing).next();throw Error('expected')}catch(e){expect(e).toBe(error)}
 await t.command('pin opus');const returned={usage:null,stopReason:null,answer:''};async function* failing(){return returned}
 expect((await t.step(failing).next()).value).toBe(returned);expect((await t.command('status')).text).toContain('blocked');
});
test('subagent requests bypass pin and evaluator',async()=>{
 const t=setup();await t.start();await t.command('pin opus');const e={turnId:'t',index:0,model:'claude-sonnet-5',agentId:'worker'};
 async function* next(x:any){expect(x).toBe(e);return{answer:'worker'}}
 expect((await t.hooks['turn.step'](t.$,e,next).next()).value.answer).toBe('worker');expect(t.fetches()).toBe(0);
});
