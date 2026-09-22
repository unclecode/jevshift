import type {Register} from 'claude-code';
import {SessionControls} from './controls.ts';
import {registerContextHooks} from './context-hooks.ts';
import {CATALOG_ARGS,CATALOG_INPUT,parseCatalog} from './catalog.ts';
import type {Catalog,RoutingEvent} from './auto.ts';
import type {Observation} from './observe.ts';

export function registerControlHooks(on:Parameters<Register>[0],options:Parameters<Register>[1],
  record:(event:Observation|RoutingEvent)=>void=()=>{}):void {
  let diagnostic:(event:Observation|RoutingEvent)=>void=()=>{};
  const controls=new SessionControls(options.experimental_auto===true,event=>{record(event);diagnostic(event)});
  let discover:(()=>Promise<Catalog>)|undefined;
  // No prompt is submitted. Safe mode prevents this helper loading this plugin again.
  on('session.start',async($,e,next)=>{
    discover=async()=>{
      const result=await $.process.run([typeof options.claude_executable==='string'&&options.claude_executable.trim()?options.claude_executable:'claude',...CATALOG_ARGS],{
        stdin:CATALOG_INPUT,timeoutMs:8000,
        env:{CLAUDECODE:'',CLAUDE_CODE_ENABLE_FUNCTION_HOOKS:'0',CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC:'1'},
      });
      if(result.exitCode!==0)throw Error('Catalog process failed');
      return parseCatalog(result.stdout);
    };
    await controls.bind(await $.session.id(),'startup',{get:key=>$.store.get(key),set:(key,value)=>$.store.set(key,value),discover:()=>discover!()});
    await $.command.register({name:'jevshift',description:'Control Jev model selection for this session',argumentHint:'status|setup|observe|auto|off|pin <model>',immediate:true});
    return next(e);
  });
  on('command.run',{command:'jevshift'},async($,e)=>{
    await controls.bind(await $.session.id(),'command',{get:key=>$.store.get(key),set:(key,value)=>$.store.set(key,value),discover:()=>discover!()});
    const text=await controls.command(e.args,await $.session.model());
    $.ui.status(`JevShift · ${controls.mode}${controls.pin?` ${controls.pin}`:''}${controls.blocked?' (blocked)':''}`);
    return {text};
  });
  registerContextHooks(on,async(snapshot,id,host)=>{
    diagnostic=event=>host.ui.log(JSON.stringify(event),{to:'debug'});
    return controls.select(snapshot,id,{
      now:()=>host.clock.now(),after:(ms,fn)=>host.clock.after(ms,fn),fetch:(url,init)=>host.http.fetch(url,init),
      key:async()=>typeof options.openrouter_api_key==='string'&&options.openrouter_api_key.trim()
        ?options.openrouter_api_key:options.use_environment_key===true?await host.environmentKey():undefined,
      show:text=>{host.ui.status(text);host.ui.log(text)},
    });
  },()=>controls.invalidate(),{
    lifecycle:async(id,source,store)=>{await controls.bind(id,source,{...store,discover:()=>discover!()})},
    guard:id=>controls.guard(id),
    finalize:(selection,id)=>controls.finalize(selection||undefined,id),
  });
  on('classic.PostModelSwitch',async($,e,next)=>{
    await controls.nativeSwitch(e.source,e.to_model);
    $.ui.status(`JevShift · ${controls.mode}${controls.blocked?' (blocked)':''}`);
    return next(e);
  });
}
