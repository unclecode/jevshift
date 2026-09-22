import type { Register } from 'claude-code';
import { registerContextHooks } from './context-hooks.ts';
import { ObserveSession, type Observation } from './observe.ts';

export function registerObserveHooks(on: Parameters<Register>[0], options: Parameters<Register>[1],
  record: (event: Observation) => void = () => {}): void {
  let diagnostic: (event: Observation) => void = () => {};
  const observer = new ObserveSession(event => { record(event); diagnostic(event); });
  registerContextHooks(on, async (snapshot,id,host) => {
    diagnostic = event => host.ui.log(JSON.stringify(event),{to:'debug'});
    await observer.consume(snapshot,id,{
      now:() => host.clock.now(), after:(ms,fn) => host.clock.after(ms,fn),
      fetch:(url,init) => host.http.fetch(url,init),
      key:async () => typeof options.openrouter_api_key==='string' && options.openrouter_api_key.trim()
        ? options.openrouter_api_key : options.use_environment_key===true ? await host.environmentKey() : undefined,
      show:text => { host.ui.status(text); host.ui.log(text); },
    });
  },() => observer.invalidate());
  on('classic.PostModelSwitch', async ($,e,next) => {
    observer.invalidate();
    $.ui.status(undefined);
    return next(e);
  });
}
