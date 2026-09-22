import {test,expect} from 'bun:test';
import {registerContextHooks} from '../src/context-hooks.ts';
function setup(fail=false){
 const hooks:Record<string,Function>={}, snapshots:any[]=[];
 registerContextHooks(((name:string,fn:Function)=>{hooks[name]=fn}) as any,async(s,id)=>{snapshots.push({s,id});if(fail)throw Error('observer failed')});
 const messages:any[]=[]; const $={session:{id:async()=> 'a',messages:async()=>messages}};
 return {hooks,snapshots,messages,$};
}
async function begin(t:ReturnType<typeof setup>){
 const prompt={text:'go',origin:{kind:'sdk'},wait:false};
 await t.hooks['prompt.submit'](t.$,prompt,async(e:any)=>{
  t.messages.push({role:'user',text:'go',toolUses:[]});
  await t.hooks['turn.start'](t.$,{turnId:'t1',text:'go'},async(e:any)=>({turnId:e.turnId}));
  return {text:e.text,origin:e.origin};
 });
}
test('hook forwards identical event, every stream chunk and result exactly once',async()=>{
 const t=setup();await begin(t);const event={turnId:'t1',index:0,model:'native-model',effort:'high',messageCount:1};let calls=0;
 const chunks=[{kind:'thinking',text:'NOT_CONTEXT'},{kind:'text',text:'answer'},{kind:'stop'}],result={answer:'answer'};
 async function* next(e:any){expect(e).toBe(event);calls++;for(const x of chunks)yield x;return result;}
 const stream=t.hooks['turn.step'](t.$,event,next);const got=[];let end;
 while(true){const x=await stream.next();if(x.done){end=x.value;break}got.push(x.value)}
 expect(calls).toBe(1);expect(got).toEqual(chunks);expect(end).toBe(result);expect(t.snapshots).toHaveLength(1);
 expect(t.snapshots[0].s.state).not.toContain('NOT_CONTEXT');
});
test('collector observer failure leaves the native request and stream intact',async()=>{
 const t=setup(true);await begin(t);let calls=0;
 async function* next(){calls++;yield {kind:'text',text:'ok'};return 'done';}
 const stream=t.hooks['turn.step'](t.$,{turnId:'t1',index:0,model:'x'},next);
 expect((await stream.next()).value.text).toBe('ok');expect((await stream.next()).value).toBe('done');expect(calls).toBe(1);
});
test('subagent requests bypass collection',async()=>{
 const t=setup();let calls=0;async function* next(){calls++;return {};}
 for await(const x of t.hooks['turn.step'](t.$,{agentId:'worker',turnId:'w',index:0},next)){}
 expect(t.snapshots).toHaveLength(0);expect(calls).toBe(1);
});
test('a downstream dropped prompt is not used by a later unknown turn',async()=>{
 const t=setup();await t.hooks['prompt.submit'](t.$,{text:'blocked',origin:{kind:'sdk'},wait:false},async()=>({drop:'blocked'}));
 await t.hooks['turn.start'](t.$,{turnId:'t',text:'blocked'},async()=>({}));
 async function* next(){return {};}
 for await(const x of t.hooks['turn.step'](t.$,{turnId:'t',index:0},next)){}
 expect(t.snapshots[0].s.state).toBeNull();
});
test('prompt collection read failure still forwards prompt once',async()=>{
 const t=setup();let calls=0;const $={session:{id:async()=>{throw Error('unavailable')}}};
 const input={text:'hello',origin:{kind:'sdk'},wait:false};
 expect(await t.hooks['prompt.submit']($,input,async(e:any)=>{calls++;expect(e).toBe(input);return {text:e.text}})).toEqual({text:'hello'});
 expect(calls).toBe(1);
});
