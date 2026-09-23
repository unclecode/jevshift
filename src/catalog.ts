import type {Catalog,Target} from './auto.ts';
import type {Tier} from './jev.ts';
import {EFFORTS} from './effort.ts';
export const TIERS:readonly Tier[]=['sonnet','opus','fable'];
export const isTier=(x:unknown):x is Tier=>TIERS.includes(x as Tier);
export const modelId=(x:unknown):x is string=>typeof x==='string'&&/^claude-[a-z0-9-]{1,100}(?:\[1m\])?$/.test(x);
const base=(model:string)=>model.replace('[1m]','');
/** Resolve a family through Claude's own --model selection, never menu order or version sorting. */
export function parseCatalog(stdout:string,tier:Tier):Target {
  if(stdout.length>1_000_000)throw Error('Catalog response too large');
  const responses=stdout.split('\n').filter(Boolean).map(line=>{try{return JSON.parse(line)}catch{return null}});
  const response=(id:string)=>{
    const matches=responses.filter(x=>x?.type==='control_response'&&x.response?.request_id===id);
    if(matches.length!==1||matches[0].response.subtype!=='success')throw Error('Catalog discovery failed');
    return matches[0].response.response;
  };
  const models=response('jevshift-catalog')?.models;
  const resolved=response('jevshift-resolved')?.applied?.model;
  const family=new RegExp(`^claude-${tier}-`);
  if(!modelId(resolved)||!family.test(resolved))throw Error('Alias did not resolve to the requested family');
  if(!Array.isArray(models)||models.length>100)throw Error('Invalid model list');
  const entries=models.filter(x=>modelId(x?.resolvedModel)&&family.test(x.resolvedModel));
  const versions:Target[]=[];
  for(const id of [...new Set<string>(entries.map(x=>x.resolvedModel))].sort()){
    const rows=entries.filter(x=>x.resolvedModel===id);
    // Conflicting/disabled rows are not evidence of permission or supported effort.
    if(rows.some(x=>x.disabled===true||x.supportsEffort===false||!Array.isArray(x.supportedEffortLevels)))continue;
    const efforts=EFFORTS.filter(e=>rows.every(x=>x.supportedEffortLevels.includes(e)));
    if(efforts.length)versions.push({model:id,efforts});
  }
  if(entries.some(x=>x.resolvedModel===resolved)&&!versions.some(x=>x.model===resolved))
    throw Error('Resolved alias entry is disabled or unsupported');
  const matches=versions.filter(x=>base(x.model)===base(resolved));
  const chosen=matches.find(x=>x.model===resolved)??matches.find(x=>!x.model.includes('[1m]'))??matches[0];
  if(!chosen)throw Error('Resolved alias has no supported catalog entry');
  // The resolver also verifies the plain ID when the menu exposes only its 1M variant.
  if(!versions.some(x=>x.model===resolved)&&!entries.some(x=>x.resolvedModel===resolved))
    versions.push({model:resolved,efforts:chosen.efforts});
  return {...chosen,...(versions.length>1?{versions:versions.filter(x=>x.model!==chosen.model)}:{})};
}
export function contextTarget(target:Target,native:string):Target|undefined {
  if(!native.includes('[1m]')||target.model.includes('[1m]'))return target;
  return target.versions?.find(x=>x.model===target.model+'[1m]');
}
export function resolveTarget(catalog:Catalog,input:string,native=''):{tier:Tier;target:Target}|undefined {
  for(const tier of TIERS){
    const target=catalog[tier];if(!target)continue;
    if(input===tier){const contextual=contextTarget(target,native);return contextual?{tier,target:contextual}:undefined;}
    if(input===target.model)return{tier,target};
    const exact=target.versions?.find(x=>x.model===input);if(exact)return{tier,target:exact};
  }
}
export function compatible(target:Target,native:string,effort:unknown):boolean {
  return modelId(target.model) && (effort===undefined||(typeof effort==='string'&&target.efforts.includes(effort)))
    &&(!native.includes('[1m]')||target.model.includes('[1m]'));
}
export const CATALOG_ARGS=['--safe-mode','--strict-mcp-config','--mcp-config','{"mcpServers":{}}',
  '--no-session-persistence','--input-format','stream-json','--output-format','stream-json','--verbose','-p'];
export const CATALOG_INPUT=[['jevshift-catalog','initialize'],['jevshift-resolved','get_settings']]
  .map(([request_id,subtype])=>JSON.stringify({type:'control_request',request_id,request:{subtype}})).join('\n')+'\n';
