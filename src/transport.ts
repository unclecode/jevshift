import type {ProcessRunInit,ProcessRunResult} from 'claude-code';
import {ENDPOINT,type Reply} from './jev.ts';
import {bytes} from './context.ts';
import {EVALUATOR_LIMITS} from './evaluator-limits.ts';
export const TRANSPORT_LIMITS=EVALUATOR_LIMITS;
export type TransportOutcome='transport_timeout'|'transport_unavailable'|'response_too_large'|'invalid_transport'|'transport_disabled';
export class TransportError extends Error {
  constructor(readonly outcome:TransportOutcome){super(outcome)}
}
export type RunProcess=(argv:readonly string[],init:ProcessRunInit)=>Promise<ProcessRunResult>;
type Init={method?:string;headers?:Record<string,string>;body?:string};
// Curl config quoting, NOT shell quoting. Nothing passes through a shell.
const quote=(s:string)=>'"'+s.replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/\n/g,'\\n').replace(/\r/g,'\\r').replace(/\t/g,'\\t').replace(/\v/g,'\\v')+'"';
export async function boundedFetch(run:RunProcess,url:string,init:Init):Promise<Reply>{
  const auth=init.headers?.Authorization;
  if(url!==ENDPOINT||init.method!=='POST'||typeof init.body!=='string'||bytes(init.body)>9000||
    typeof auth!=='string'||!auth.startsWith('Bearer ')||auth.length>4103||/[\x00-\x1f\x7f]/.test(auth)||init.body.includes('\0'))throw new TransportError('invalid_transport');
  const config=[`url = ${quote(ENDPOINT)}`,'request = "POST"',`header = ${quote(auth?'Authorization: '+auth:'')}`,
    'header = "Content-Type: application/json"',`data-raw = ${quote(init.body)}`].join('\n')+'\n';
  let result:ProcessRunResult;
  try{
    result=await run(['curl','--disable','--silent','--show-error','--globoff','--proto','=https','--proto-redir','=https',
      '--max-redirs','0','--retry','0','--connect-timeout',String(TRANSPORT_LIMITS.connectSeconds),'--max-time',String(TRANSPORT_LIMITS.transferSeconds),
      '--max-filesize',String(TRANSPORT_LIMITS.responseBytes),'--write-out','\n%{http_code}','--config','-'],
      {stdin:config,timeoutMs:TRANSPORT_LIMITS.processMs,env:{OPENROUTER_API_KEY:''}});
  }catch{throw new TransportError('transport_unavailable')}
  // Never pass stderr or partial response bodies into diagnostics.
  if(result.exitCode===28)throw new TransportError('transport_timeout');
  if(result.exitCode===63||bytes(result.stdout)>TRANSPORT_LIMITS.responseBytes+4)throw new TransportError('response_too_large');
  if(result.exitCode!==0)throw new TransportError('transport_unavailable');
  const match=/\n([1-5]\d\d)$/.exec(result.stdout);
  if(!match)throw new TransportError('invalid_transport');
  const status=Number(match[1]);
  return {status,ok:status>=200&&status<300,text:result.stdout.slice(0,-4)};
}
