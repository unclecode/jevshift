import type {Register} from 'claude-code';
import {registerContextHooks} from './context-hooks.ts';
import {AutoSession,type Catalog,type RoutingEvent} from './auto.ts';
import type {Observation} from './observe.ts';

/** Isolated auto entry point. Root plugin remains observe until release gates pass. */
export function registerAutoHooks(on:Parameters<Register>[0],options:Parameters<Register>[1],catalog:Catalog,
  record:(event:Observation|RoutingEvent)=>void=()=>{}):void {
  let diagnostic:(event:Observation|RoutingEvent)=>void=()=>{};
  const auto=new AutoSession(catalog,event=>{record(event);diagnostic(event)});
  registerContextHooks(on,async(snapshot,id,host)=>{
    diagnostic=event=>host.ui.log(JSON.stringify(event),{to:'debug'});
    return auto.select(snapshot,id,{
      now:()=>host.clock.now(),after:(ms,fn)=>host.clock.after(ms,fn),fetch:(url,init)=>host.http.fetch(url,init),
      key:async()=>typeof options.openrouter_api_key==='string'&&options.openrouter_api_key.trim()
        ?options.openrouter_api_key:options.use_environment_key===true?await host.environmentKey():undefined,
      show:text=>{host.ui.status(text);host.ui.log(text)},
    });
  },reason=>{if(reason==='session')auto.stop();else auto.invalidate()});
  on('classic.PostModelSwitch',async($,e,next)=>{
    if(['command','picker','sdk','auto'].includes(e.source))auto.stop();
    $.ui.status(undefined);
    return next(e);
  });
}
