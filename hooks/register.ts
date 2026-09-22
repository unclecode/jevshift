import type {Register} from 'claude-code';
import {registerControlHooks} from '../src/controls-hooks.ts';
export const register:Register=(on,options)=>registerControlHooks(on,options);
