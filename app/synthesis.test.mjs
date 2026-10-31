import test from 'node:test';
import assert from 'node:assert/strict';
import { synthesizeBrief } from './synthesis.mjs';

const fixture=()=>({seeds:[{name:'Aphex Twin'},{name:'Martha Stewart'}],basis:{goal:'collaboration',tolerance:.1},evidence:[{parameterHash:'evidence'}],ledger:[{step:'check'}],directions:[{id:'direction-1',anchor:{name:'Sleep No More',domain:'place'},observation:{shareA:.5,shareB:.5,evidenceIds:['evidence']},check:{status:'needs_testing'},proposal:{kind:'editorial_proposal',format:'An experience',catalogCues:['immersive'],boundary:'Original boundary',title:'Template'}}]});
const generated={id:'direction-1',title:'A room that teaches itself',premise:'A speculative domestic performance.',deliverable:'A ten-minute room prototype.',nextStep:'Build one table and test the sequence.',creativeConstraints:['Use fractured rhythms to set the timing.','Make the hosting ritual legible.'],rejectIf:'Reject if either world disappears.'};

test('synthesis replaces only editorial proposal fields and preserves measured evidence',async()=>{
  const brief=fixture();let options;
  const result=await synthesizeBrief(brief,{generate:async input=>{options=input;return {output:{directions:[generated]}};}});
  assert.equal(result.synthesis.status,'generated');
  assert.equal(result.directions[0].proposal.title,generated.title);
  assert.deepEqual(result.directions[0].anchor,brief.directions[0].anchor);
  assert.deepEqual(result.directions[0].observation,brief.directions[0].observation);
  assert.deepEqual(result.directions[0].check,brief.directions[0].check);
  assert.deepEqual(result.evidence,brief.evidence);assert.deepEqual(result.ledger,brief.ledger);
  assert.equal(brief.directions[0].proposal.title,'Template');
  assert.equal(options.maxRetries,0);assert.equal(options.maxOutputTokens,6500);assert.ok(options.abortSignal);
  assert.equal(result.directions[0].proposal.kind,'ai_proposal');
  assert.match(options.system,/untrusted data/);assert.match(options.prompt,/Sleep No More/);
});

test('mismatched or duplicate generated direction IDs reject synthesis as a whole',async()=>{
  const brief=fixture();
  for(const directions of [[{...generated,id:'invented'}],[generated,generated]]){
    const result=await synthesizeBrief(brief,{generate:async()=>({output:{directions}})});
    assert.equal(result.synthesis.status,'unavailable');assert.deepEqual(result.directions,brief.directions);
  }
});

test('generation failure returns clearly labeled template fallback without exposing error details',async()=>{
  const brief=fixture();
  const result=await synthesizeBrief(brief,{generate:async()=>{throw Error('sensitive provider response');}});
  assert.equal(result.synthesis.status,'unavailable');assert.match(result.synthesis.message,/template/i);
  assert.deepEqual(result.directions,brief.directions);assert.doesNotMatch(JSON.stringify(result),/sensitive provider/);
});

test('empty evidence directions do not call the model',async()=>{
  const brief={...fixture(),directions:[]};let calls=0;
  const result=await synthesizeBrief(brief,{generate:async()=>{calls++;}});
  assert.equal(calls,0);assert.deepEqual(result.directions,[]);
});
