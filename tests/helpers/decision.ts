import {EFFORTS} from '../../src/effort.ts';
export const effortAnswer=(choice='low')=>({type:'choice',choice,confidence:1,
  probabilities:Object.fromEntries(EFFORTS.map(e=>[e,Number(e===choice)]))});
export const decisionReply=(model='opus',effort='high')=>({ok:true,status:200,text:JSON.stringify({
  model:'typesafe/jev-1.13',answers:{model_choice:{type:'choice',choice:model,confidence:1,
    probabilities:Object.fromEntries(['sonnet','opus','fable'].map(m=>[m,Number(m===model)]))},effort_choice:effortAnswer(effort)}})});
