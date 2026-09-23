import {CATALOG_ARGS,CATALOG_INPUT,parseCatalog,TIERS} from './catalog.ts';
import type {Catalog} from './auto.ts';

type Runner=(argv:string[],init:{stdin:string;timeoutMs:number;env:Record<string,string>})=>Promise<{exitCode:number;stdout:string}>;
/** Isolated no-inference helpers inherit the user's provider configuration and model overrides. */
export async function discoverCatalog(run:Runner,executable:string):Promise<Catalog>{
  const results=await Promise.allSettled(TIERS.map(async tier=>{
    const result=await run([executable,...CATALOG_ARGS,'--model',tier],{
      stdin:CATALOG_INPUT,timeoutMs:8000,
      env:{CLAUDECODE:'',CLAUDE_CODE_ENABLE_FUNCTION_HOOKS:'0',CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC:'1'},
    });
    if(result.exitCode!==0)throw Error('Catalog process failed');
    return parseCatalog(result.stdout,tier);
  }));
  const catalog:Catalog={};
  results.forEach((r,i)=>{if(r.status==='fulfilled')catalog[TIERS[i]]=r.value});
  if(!Object.keys(catalog).length)throw Error('No supported model aliases');
  return catalog;
}
