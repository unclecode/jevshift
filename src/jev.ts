import { bytes } from './context.ts';
import { JEV_PROMPT } from './jev-prompt.ts';
import {isEffort,type Effort} from './effort.ts';
import type {Catalog} from './auto.ts';

export const ENDPOINT = 'https://openrouter.ai/api/alpha/decisions';
export type Tier = 'sonnet' | 'opus' | 'fable';
export type Usage = {inputTokens: number; outputTokens: number; costUsd: number};
export type Reply = {status: number; ok: boolean; text: string};
export type Decision = {choice: Tier; effort?:Effort; confidence?: number; probabilities?: Record<Tier,number>; model: string};
export type DecisionScope = {catalog?:Catalog; pinnedModel?:Tier; fixedEffort?:Effort|'native'; nativeEffort?:unknown};
export type Parsed = {outcome: 'recommended' | 'http_error' | 'invalid_response'; decision?: Decision; usage?: Usage; httpStatus: number};
const object = (x: unknown): x is Record<string,any> => !!x && typeof x === 'object' && !Array.isArray(x);
const probability = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= 1;
const count = (x: unknown): x is number => Number.isSafeInteger(x) && (x as number) >= 0;
export function requestBody(state: string,scope:DecisionScope={}): string | null {
  if(scope.pinnedModel&&scope.fixedEffort)return null;
  const questions={...(!scope.pinnedModel?{model_choice:JEV_PROMPT.questions.model_choice}:{}),
    ...(!scope.fixedEffort?{effort_choice:JEV_PROMPT.questions.effort_choice}:{})};
  const available=scope.catalog?Object.entries(scope.catalog).map(([tier,target])=>
    `${tier}: ${target!.model}; allowed effort: ${target!.efforts.join(', ')}`).join('\n'):'';
  const constraints=[available,scope.pinnedModel?`Model pinned to ${scope.pinnedModel}; choose only its effort.`:'',
    scope.fixedEffort?`Effort fixed to ${scope.fixedEffort==='native'?String(scope.nativeEffort??'model default'):scope.fixedEffort}; choose only a compatible model.`:''].filter(Boolean).join('\n');
  const make=()=>JSON.stringify({model:JEV_PROMPT.model,questions,state:constraints?`<available_models>\n${constraints}\n</available_models>\n\n${state}`:state});
  let body=make();
  // Retain the verified current request. Remove older evidence before exceeding the total cap.
  for(const section of ['recent_messages','work_summary','recent_tool_results']){
    if(bytes(body)<=9000)break;
    state=state.replace(new RegExp(`<${section}>[\\s\\S]*?</${section}>`),`<${section}>\n[omitted to fit request limit]\n</${section}>`);
    body=make();
  }
  return bytes(body)<=9000?body:null;
}
/** Never return raw response bodies or server error text to diagnostics. */
export function parseReply(reply: Reply,scope:DecisionScope={}): Parsed {
  const base: Parsed = {outcome: reply.ok ? 'invalid_response' : 'http_error', httpStatus:reply.status};
  if (reply.text.length > 65536) return base;
  let x: any;
  try { x = JSON.parse(reply.text); } catch { return base; }
  if (!object(x)) return base;
  const u = x.usage;
  if (object(u) && count(u.input_tokens) && count(u.output_tokens) && typeof u.cost === 'number' && Number.isFinite(u.cost) && u.cost >= 0)
    base.usage = {inputTokens:u.input_tokens, outputTokens:u.output_tokens, costUsd:u.cost};
  if (!reply.ok) return base;
  const validChoice=(a:any,labels:string[])=>object(a)&&a.type==='choice'&&labels.includes(a.choice)&&probability(a.confidence)&&
    object(a.probabilities)&&Object.keys(a.probabilities).sort().join(',')===labels.slice().sort().join(',')&&
    Object.values(a.probabilities).every(probability)&&Math.abs(Object.values(a.probabilities).reduce((sum:number,p:any)=>sum+p,0)-1)<.02;
  const a=x.answers?.model_choice,e=x.answers?.effort_choice;
  if((!scope.pinnedModel&&!validChoice(a,['sonnet','opus','fable'])) ||
    (!scope.fixedEffort&&!validChoice(e,['low','medium','high','xhigh','max'])) ||
    typeof x.model!=='string'||!/^typesafe\/jev-1\.13(?:-\d{8})?$/.test(x.model))return base;
  const effort=scope.fixedEffort==='native'?(isEffort(scope.nativeEffort)?scope.nativeEffort:undefined):scope.fixedEffort??e.choice;
  return {...base,outcome:'recommended',decision:{choice:scope.pinnedModel??a.choice,effort,
    ...(!scope.pinnedModel?{confidence:a.confidence,probabilities:a.probabilities}:{}),model:x.model}};
}
