import {test,expect} from 'bun:test';
import {ObserveSession,type ObserveHost,type Observation} from '../src/observe.ts';
import {buildContext} from '../src/context.ts';
import {parseReply,requestBody,ENDPOINT} from '../src/jev.ts';
import {JEV_PROMPT} from '../src/jev-prompt.ts';
const snap=(generation=1)=>buildContext([],{text:'Design a new sync architecture.',origin:'sdk',generation});
const id=(turnId='t',signal?:AbortSignal)=>({sessionId:'a',turnId,step:0,nativeModel:'claude-sonnet-5',signal});
const reply=(choice='fable')=>({status:200,ok:true,text:JSON.stringify({model:'typesafe/jev-1.13-20260917',answers:{model_choice:{type:'choice',choice,confidence:1,probabilities:{sonnet:choice==='sonnet'?1:0,opus:choice==='opus'?1:0,fable:choice==='fable'?1:0}}},usage:{input_tokens:500,output_tokens:30,cost:.000021}})});
const flush=async()=>{for(let i=0;i<20;i++)await Promise.resolve()};
function setup(){
 let time=0, resolve:(x:ReturnType<typeof reply>)=>void=()=>{},key:string|undefined='synthetic-test-key';
 const events:Observation[]=[],notices:string[]=[],calls:any[]=[],timers:{at:number;fn:()=>void;active:boolean}[]=[];
 const pending=new Promise<ReturnType<typeof reply>>(r=>resolve=r);
 const host:ObserveHost={now:async()=>time,after:(ms,fn)=>{const t={at:time+ms,fn,active:true};timers.push(t);return{cancel:()=>{t.active=false}}},key:async()=>key,
  fetch:async(url,init)=>{calls.push({url,init});return pending},show:text=>notices.push(text)};
 const observer=new ObserveSession(e=>events.push(e));
 return{host,observer,events,notices,calls,resolve,missing:()=>{key=undefined},advance:async(ms:number)=>{time+=ms;for(const t of timers)if(t.active&&t.at<=time){t.active=false;t.fn()}await flush()}};
}
test('one typed question, no current-model field, bounded full body',()=>{
 const body=JSON.parse(requestBody(snap().state!)!);
 expect(body.questions).toEqual(JEV_PROMPT.questions);expect(Object.keys(body.questions)).toEqual(['model_choice']);
 expect(body.state).not.toContain('current_model');expect(requestBody('z'.repeat(9000))).toBeNull();
});
test('strict parsing keeps billing separately from invalid decisions',()=>{
 expect(parseReply(reply()).decision?.choice).toBe('fable');
 for(const mutation of [(x:any)=>x.answers.model_choice.choice='unknown',(x:any)=>x.answers.model_choice.probabilities.sonnet=.5,
   (x:any)=>x.answers.model_choice.confidence='1',(x:any)=>x.model='unexpected',(x:any)=>x.answers.model_choice.probabilities.extra=0]){
  const x=JSON.parse(reply().text);mutation(x);const p=parseReply({...reply(),text:JSON.stringify(x)});
  expect(p.outcome).toBe('invalid_response');expect(p.usage?.costUsd).toBe(.000021);
 }
 expect(parseReply({...reply(),status:429,ok:false}).outcome).toBe('http_error');
 expect(parseReply({...reply(),text:'bad JSON'}).outcome).toBe('invalid_response');
 expect(parseReply({...reply(),text:' '.repeat(65537)}).outcome).toBe('invalid_response');
});
test('success shows recommendation and incoming model, deduplicates tool steps',async()=>{
 const t=setup();const p=t.observer.consume(snap(),id(),t.host);await flush();t.resolve(reply());await p;
 await t.observer.consume(snap(),{...id(),step:1},t.host);
 await t.observer.consume(snap(),id('empty-continuation'),t.host);
 expect(t.calls).toHaveLength(1);expect(t.calls[0].url).toBe(ENDPOINT);
 expect(t.notices).toEqual(['JevShift · Observe: recommend Fable; keeping claude-sonnet-5.']);
 expect(t.events.at(-1)).toMatchObject({outcome:'recommended',recommendation:'fable',usage:{costUsd:.000021}});
 expect(JSON.stringify(t.events)).not.toContain('Design a new');expect(JSON.stringify(t.events)).not.toContain('synthetic-test-key');
});
test('deadline releases waiting, late settlement accounts usage without recommending',async()=>{
 const t=setup();const p=t.observer.consume(snap(),id(),t.host);await flush();await t.advance(6000);await p;
 expect(t.events.at(-1)).toMatchObject({outcome:'timeout',elapsedMs:6000});
 await t.observer.consume(snap(2),id('next'),t.host);
 expect(t.calls).toHaveLength(1);expect(t.events.at(-1)?.outcome).toBe('request_still_pending');
 t.resolve(reply());await flush();expect(t.events.at(-1)).toMatchObject({event:'late_settlement',usage:{costUsd:.000021}});
 expect(t.notices.some(x=>x.includes('recommend Fable'))).toBe(false);
 await t.observer.consume(snap(2),id('next'),t.host);expect(t.calls).toHaveLength(1);
 await t.observer.consume(snap(3),id('third'),t.host);expect(t.calls).toHaveLength(2);
});
test('new input invalidates old waiting result immediately',async()=>{
 const t=setup();const p=t.observer.consume(snap(),id(),t.host);await flush();t.observer.invalidate();await p;
 expect(t.events.at(-1)?.outcome).toBe('stale');t.resolve(reply());await flush();expect(t.notices).toEqual([]);
});
test('interrupt ends wait; no late recommendation',async()=>{
 const t=setup(),ac=new AbortController();const p=t.observer.consume(snap(),id('t',ac.signal),t.host);await flush();ac.abort();await p;
 t.resolve(reply());await flush();expect(t.notices).toEqual([]);expect(t.calls).toHaveLength(1);
});
test('slow key lookup does not start paid HTTP after the deadline',async()=>{
 const t=setup();let resolve:(s:string)=>void=()=>{};t.host.key=()=>new Promise(r=>resolve=r);
 const p=t.observer.consume(snap(),id(),t.host);await flush();await t.advance(6000);await p;resolve('key');await flush();
 expect(t.calls).toHaveLength(0);
});
test('missing key, invalid response and network errors preserve work with no retries',async()=>{
 const m=setup();m.missing();await m.observer.consume(snap(),id(),m.host);await m.observer.consume(snap(2),id('two'),m.host);
 expect(m.calls).toHaveLength(0);expect(m.notices).toHaveLength(1);
 const t=setup();const p=t.observer.consume(snap(),id(),t.host);await flush();t.resolve(reply('unknown'));await p;
 expect(t.events.at(-1)?.outcome).toBe('invalid_response');expect(t.notices[0]).toContain('unchanged');
 const n=setup();n.host.fetch=async()=>{throw Error('secret raw response')};await n.observer.consume(snap(),id(),n.host);
 expect(n.events.at(-1)?.outcome).toBe('network_error');expect(JSON.stringify(n.events)).not.toContain('secret raw response');
});
test('concurrent registrations keep recommendations separate',async()=>{
 const a=setup(),b=setup();const pa=a.observer.consume(snap(),id(),a.host),pb=b.observer.consume(snap(),{...id(),sessionId:'b',nativeModel:'claude-opus-5'},b.host);
 await flush();a.resolve(reply('sonnet'));b.resolve(reply('fable'));await Promise.all([pa,pb]);
 expect(a.notices[0]).toContain('recommend Sonnet; keeping claude-sonnet-5');expect(b.notices[0]).toContain('recommend Fable; keeping claude-opus-5');
});
test('unavailable context and an already interrupted request make no call',async()=>{
 const t=setup();await t.observer.consume(buildContext([],null),id(),t.host);
 await t.observer.consume(snap(2),id('next',AbortSignal.abort()),t.host);expect(t.calls).toHaveLength(0);
});
test('transport timeout records unknown billing and never retries the checkpoint',async()=>{
 const {TransportError}=await import('../src/transport.ts');const t=setup();let calls=0;
 t.host.fetch=async()=>{calls++;throw new TransportError('transport_timeout')};await t.observer.consume(snap(),id(),t.host);await t.observer.consume(snap(),id(),t.host);
 expect(calls).toBe(1);expect(t.events.at(-1)).toMatchObject({outcome:'transport_timeout',billing:'unknown'});
 expect(JSON.stringify(t.events)).not.toContain('synthetic-test-key');
});

test('a valid reply after the old cutoff is accepted within the new bound',async()=>{
 const t=setup();const p=t.observer.consume(snap(),id(),t.host);await flush();await t.advance(2200);
 expect(t.events.some(e=>e.event==='finished')).toBe(false);t.resolve(reply());await p;
 expect(t.events.at(-1)).toMatchObject({outcome:'recommended',recommendation:'fable',elapsedMs:2200});
});
