import test from 'node:test';
import assert from 'node:assert/strict';
import { investigateBrief, briefMarkdown } from './brief.mjs';
const seeds=[{entity_id:'A',name:'First world'},{entity_id:'B',name:'Second world'}];
const candidate=(entity_id,domain,a=.5,b=.5)=>({entity_id,domain,name:entity_id,
  query:{affinity:.8,explainability:{'signal.interests.entities':[{entity_id:'A',score:a},{entity_id:'B',score:b}]}}});
const report=(candidates)=>({seeds,candidates,evidence:['place','artist','brand','movie','book'].map(domain=>({path:'/v2/insights',parameterHash:'joint-'+domain,params:{'filter.type':`urn:entity:${domain}`,'signal.interests.entities':'A,B'}}))});
test('brief diversifies balanced references, checks both seed shortlists, and links every observation',async()=>{
  const input=report([candidate('Venue','place'),candidate('Record','artist'),candidate('Partner','brand'),candidate('Lopsided','book',.99,.01)]);
  const requests=[];
  const result=await investigateBrief(input,{get:async(path,params)=>{
    requests.push({path,params});
    const domain=params['filter.type'].split(':').at(-1);
    const name={place:'Venue',artist:'Record',brand:'Partner'}[domain];
    return {body:{results:{entities:[{entity_id:name}]}},evidence:{path,params,parameterHash:domain+params['signal.interests.entities']}};
  }});
  assert.equal(requests.length,6);assert.ok(requests.every(r=>['A','B'].includes(r.params['signal.interests.entities'])));
  assert.deepEqual(result.directions.map(x=>x.anchor.entity_id),['Venue','Record','Partner']);
  assert.ok(result.directions.every(x=>x.check.status==='seen_in_both'&&x.observation.evidenceIds.length>0));
  assert.ok(result.directions.every(x=>x.proposal.deliverable&&x.proposal.nextStep&&x.proposal.rejectIf));
  assert.equal(result.rejections.lopsided,1);
  assert.match(briefMarkdown(result),/First world/);assert.match(briefMarkdown(result),/Proposed direction/);
});
test('absent shortlist membership and a failed domain remain uncertainty, not disproof',async()=>{
  const result=await investigateBrief(report([candidate('Venue','place')]),{get:async(path,params)=>{
    if(params['signal.interests.entities']==='B')throw Error('unavailable');
    return {body:{results:{entities:[]}},evidence:{parameterHash:'empty',path,params}};
  }});
  assert.equal(result.directions[0].check.status,'incomplete');
  assert.equal(result.directions[0].check.a.status,'not_observed');
  assert.equal(result.directions[0].check.b.status,'unavailable');
  assert.equal(result.ledger.filter(x=>x.status==='error').length,1);
  assert.match(result.directions[0].proposal.rejectIf,/test/i);
});
test('unverified and out-of-window candidates cannot become creative evidence',async()=>{
  const input=report([candidate('Bad','movie',.9,.1),{entity_id:'Missing',domain:'brand',query:{}}]);
  const result=await investigateBrief(input,{get:()=>{throw Error('No requests allowed');}});
  assert.equal(result.status,'insufficient_evidence');assert.equal(result.directions.length,0);
  assert.equal(result.rejections.unverified,1);assert.equal(result.rejections.lopsided,1);
});
test('goal and tolerance are validated; a strict window does not silently widen',async()=>{
  const client={get:()=>{throw Error('No requests allowed');}};
  await assert.rejects(investigateBrief(report([]),client,{goal:'invented'}),/goal/i);
  await assert.rejects(investigateBrief(report([]),client,{tolerance:NaN}),/window/i);
  const result=await investigateBrief(report([candidate('Near','place',.51,.49)]),client,{tolerance:0});
  assert.equal(result.directions.length,0);assert.equal(result.basis.tolerance,0);
});
test('an anchor without matching joint-request provenance is not presented as evidence',async()=>{
  const input=report([candidate('Venue','place')]);input.evidence=[];
  const result=await investigateBrief(input,{get:()=>{throw Error('No requests allowed');}});
  assert.equal(result.directions.length,0);assert.equal(result.rejections.ungrounded,1);
});
