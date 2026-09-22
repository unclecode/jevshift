import {ENDPOINT} from '../../src/jev.ts';
export function fakeCurl(fetch:Function){return async(argv:readonly string[],init:any)=>{
 const read=(name:string)=>JSON.parse(init.stdin.split('\n').find((x:string)=>x.startsWith(name+' = ')).slice(name.length+3));
 const auth=read('header').replace('Authorization: ','');
 const reply=await fetch(ENDPOINT,{method:'POST',headers:{Authorization:auth,'Content-Type':'application/json'},body:read('data-raw')});
 return {exitCode:0,stdout:reply.text+'\n'+reply.status,stderr:''};
}}
