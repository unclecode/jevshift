import {buildContext} from '../src/context.ts';
import {requestBody} from '../src/jev.ts';
import {readFileSync, writeFileSync} from 'node:fs';
const instruction = 'The plan is agreed. Implement the retry limit and add the boundary tests.';
const snapshot = buildContext([
  {role:'user', text:'Design a bounded retry helper for a small HTTP client.'},
  {role:'assistant', text:'Plan: retry at most twice for temporary server errors, honor cancellation, and test zero attempts and the final attempt. Do not retry authentication failures.'},
  {role:'user', text:instruction},
], {text:instruction,origin:'composer',generation:1,instructionId:1});
if (!snapshot.state) throw Error('Synthetic context did not fit');
const body=requestBody(snapshot.state);
if (!body) throw Error('Synthetic payload did not fit');
const output=JSON.stringify(JSON.parse(body),null,2)+'\n';
const path=new URL('../examples/jev-request.json',import.meta.url);
if(process.argv.includes('--check')) {
  if(readFileSync(path,'utf8')!==output) throw Error('Regenerate the synthetic request with bun scripts/example.ts');
  console.log('Synthetic example matches current collector and evaluator prompt. No network call.');
} else {
  writeFileSync(path,output);
  console.log('Saved synthetic evaluator request. No network call.');
}
