import {test,expect} from 'bun:test';
import {boundedFetch,TransportError,TRANSPORT_LIMITS} from '../src/transport.ts';
import {ENDPOINT} from '../src/jev.ts';
const init={method:'POST',headers:{Authorization:'Bearer synthetic-credential'},body:'{"state":"a quote \\" and line\\n"}'};
test('bounded process keeps key/context on stdin, disables curl defaults, redirects and retries',async()=>{
 const result=await boundedFetch(async(argv,options)=>{
  expect(argv[1]).toBe('--disable');expect(argv).toContain('--config');expect(argv.at(-1)).toBe('-');
  expect(argv).toContain('=https');expect(argv.join(' ')).not.toContain('synthetic-credential');expect(argv.join(' ')).not.toContain(init.body);
  expect(argv.slice(argv.indexOf('--retry'),argv.indexOf('--retry')+2)).toEqual(['--retry','0']);
  expect(argv.slice(argv.indexOf('--connect-timeout'),argv.indexOf('--connect-timeout')+2)).toEqual(['--connect-timeout','2']);
  expect(argv.slice(argv.indexOf('--max-time'),argv.indexOf('--max-time')+2)).toEqual(['--max-time','5']);
  expect(options.timeoutMs).toBe(5500);
  expect(argv).not.toContain('--location');expect(options.timeoutMs).toBe(TRANSPORT_LIMITS.processMs);expect(options.env).toEqual({OPENROUTER_API_KEY:''});
  expect(options.stdin).toContain('header = "Authorization: Bearer synthetic-credential"');expect(options.stdin).toContain('data-raw = ');
  return {exitCode:0,stdout:'{"ok":true}\n200',stderr:'private stderr'};
 },ENDPOINT,init);expect(result).toEqual({status:200,ok:true,text:'{"ok":true}'});
});
test('config metacharacters cannot add options and @body remains literal data',async()=>{
 const body='@secret\nurl = "https://untrusted.invalid"\n\\\r\t';
 await boundedFetch(async(_,options)=>{
  expect(options.stdin!.split('\n').filter(x=>x.startsWith('url = '))).toHaveLength(1);
  expect(options.stdin!.split('\n').find(x=>x.startsWith('data-raw = '))).toContain('\\n');
  return{exitCode:0,stdout:'{}\n200',stderr:''};
 },ENDPOINT,{...init,body});
});
test('invalid destination, credential, oversized body or method never starts a process',async()=>{
 let calls=0;const run=async()=>{calls++;throw Error('no')};
 for(const [url,data] of [['http://evil',init],[ENDPOINT,{...init,method:'GET'}],[ENDPOINT,{...init,body:'x'.repeat(9001)}],[ENDPOINT,{...init,headers:{Authorization:'Bearer x\r\nBad: value'}}]] as any[]){
  await expect(boundedFetch(run,url,data)).rejects.toBeInstanceOf(TransportError);
 }expect(calls).toBe(0);
});
test('curl failure, large/partial/truncated output and host rejection expose only typed errors, no retries',async()=>{
 for(const [exitCode,stdout,outcome] of [[28,'secret partial','transport_timeout'],[63,'secret','response_too_large'],[7,'','transport_unavailable'],[0,'partial','invalid_transport'],[0,'x'.repeat(65541),'response_too_large']] as const){
  let calls=0;try{await boundedFetch(async()=>{calls++;return{exitCode,stdout,stderr:'SECRET'}},ENDPOINT,init);throw Error('expected')}
  catch(e){expect(e).toBeInstanceOf(TransportError);expect((e as TransportError).outcome).toBe(outcome);expect(String(e)).not.toContain('SECRET')}
  expect(calls).toBe(1);
 }
 await expect(boundedFetch(async()=>{throw Error('key=SECRET')},ENDPOINT,init)).rejects.toThrow('transport_unavailable');
});
test('non-success HTTP keeps response available for safe parser accounting, never follows redirect',async()=>{
 for(const status of [302,401,429,500])expect(await boundedFetch(async()=>({exitCode:0,stdout:'{}\n'+status,stderr:''}),ENDPOINT,init)).toEqual({status,ok:false,text:'{}'});
});
