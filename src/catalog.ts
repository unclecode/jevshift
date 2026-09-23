import type {Catalog,Target} from './auto.ts';
import type {Tier} from './jev.ts';
import {EFFORTS} from './effort.ts';
export const TIERS:readonly Tier[]=['sonnet','opus','fable'];
export const modelId=(x:unknown):x is string=>typeof x==='string'&&/^claude-[a-z0-9-]{1,100}(?:\[1m\])?$/.test(x);
export function parseCatalog(stdout:string):Catalog {
  if(stdout.length>1_000_000)throw Error('Catalog response too large');
  const responses=stdout.split('\n').filter(Boolean).map(line=>{try{return JSON.parse(line)}catch{return null}});
  const reply=responses.find(x=>x?.type==='control_response'&&x.response?.request_id==='jevshift-catalog');
  if(reply?.response?.subtype!=='success')throw Error('Catalog discovery failed');
  const models=reply.response.response?.models;
  if(!Array.isArray(models)||models.length>100)throw Error('Invalid model list');
  const catalog:Catalog={};
  for(const tier of TIERS){
    const entries=models.filter(x=>modelId(x?.resolvedModel)&&new RegExp(`^claude-${tier}-`).test(x.resolvedModel));
    // Prefer the plain context variant where the native menu offers it.
    const chosen=entries.find(x=>!x.resolvedModel.includes('[1m]'))??entries[0];
    if(!chosen)continue;
    if(!Array.isArray(chosen.supportedEffortLevels))continue;
    const efforts=EFFORTS.filter(e=>chosen.supportedEffortLevels.includes(e));
    if(!efforts.length)continue;
    catalog[tier]={model:chosen.resolvedModel,efforts};
  }
  if(!Object.keys(catalog).length)throw Error('No supported model tiers');
  return catalog;
}
export function resolveTarget(catalog:Catalog,input:string):{tier:Tier;target:Target}|undefined {
  for(const tier of TIERS){const target=catalog[tier];if(target&&(input===tier||input===target.model))return{tier,target};}
}
export function compatible(target:Target,native:string,effort:unknown):boolean {
  return modelId(target.model) && (effort===undefined||(typeof effort==='string'&&target.efforts.includes(effort)))
    &&(!native.includes('[1m]')||target.model.includes('[1m]'));
}
export const CATALOG_ARGS=['--safe-mode','--strict-mcp-config','--mcp-config','{"mcpServers":{}}',
  '--no-session-persistence','--input-format','stream-json','--output-format','stream-json','--verbose','-p'];
export const CATALOG_INPUT=JSON.stringify({type:'control_request',request_id:'jevshift-catalog',request:{subtype:'initialize'}})+'\n';
