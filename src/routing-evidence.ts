import { LIMITS, type Message } from './context.ts';
export type ToolOutcome = {id:string;tool:string;error:boolean};
/** Local scheduling evidence only; never sent as another evaluator question. */
export function routingEvidence(messages: readonly Message[]): ToolOutcome[] {
  const names=new Map<string,string>(), outcomes=new Map<string,ToolOutcome>();
  for (const message of messages.slice(-LIMITS.scanMessages)) {
    for (const tool of (message.toolUses ?? []).slice(-LIMITS.scanToolsPerMessage)) {
      names.set(tool.tool_use_id,tool.tool);
      if (tool.text !== undefined) outcomes.set(tool.tool_use_id,{id:tool.tool_use_id,tool:tool.tool,error:!!tool.isError});
    }
    for (const result of (message.toolResults ?? []).slice(-LIMITS.scanToolsPerMessage))
      outcomes.set(result.tool_use_id,{id:result.tool_use_id,tool:names.get(result.tool_use_id) ?? 'Tool',error:result.isError});
  }
  return [...outcomes.values()].slice(-64);
}
