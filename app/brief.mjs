import { rankCandidates } from './balance.mjs';

export const goals={collaboration:'Commission a collaboration',introduction:'Introduce a work to a new context',programming:'Build a cultural program'};
const formats={
  place:{label:'An experience',title:'Build a room around',deliverable:'A spatial treatment and a small invitation-only prototype',
    action:'Ask an experience designer to turn this reference into a floor plan, running order, and one participatory moment.',
    reject:'a small prototype cannot communicate a clear role for each seed without an explanatory pitch'},
  artist:{label:'A listening commission',title:'Develop a listening work around',deliverable:'An original sound treatment and a short listening-session pilot',
    action:'Ask a music supervisor to assemble a reference sequence, then commission a short original sketch with two distinct creative constraints.',
    reject:'listeners recognize only one seed in the sketch, or it depends on unlicensed recordings'},
  brand:{label:'A partnership proposal',title:'Test an activation with',deliverable:'A partner pitch with one tangible activation and a small concept test',
    action:'Prepare two activation storyboards using this brand as a prospect, then test which communicates a role for both seeds before making contact.',
    reject:'the concept works equally well with any unrelated sponsor, or a small test finds no clear reason for this pairing'},
  movie:{label:'A moving-image commission',title:'Develop a film treatment around',deliverable:'An original short-film treatment and a table-read or animatic',
    action:'Use this film as a reference in a director brief; write one scene governed by a creative constraint from each seed.',
    reject:'the scene becomes a recognizable imitation of the reference, or test viewers cannot identify both creative constraints'},
  book:{label:'An editorial commission',title:'Develop an editorial project around',deliverable:'A short publication outline and one sample spread or reading',
    action:'Use this book as an editorial reference; commission one sample that connects a concrete subject from each seed.',
    reject:'the sample relies on a clever title rather than a clear subject connecting the two seeds'},
};

function proposalFor(anchor,seeds,goal) {
  const format=formats[anchor.domain];
  const [a,b]=seeds.map(x=>x.name);
  const goalLine=goal==='introduction'?`Use ${anchor.name} as an entry point for introducing a project connected to ${a} in the context of ${b}.`:
    goal==='programming'?`Develop a program segment connecting ${a} and ${b}, with ${anchor.name} as its organizing reference.`:
    `Commission a new piece connecting ${a} and ${b}, using ${anchor.name} as a reference to investigate rather than a finished concept.`;
  return {kind:'editorial_proposal',title:`${format.title} ${anchor.name}`,format:format.label,
    premise:goalLine,deliverable:format.deliverable,nextStep:format.action,
    rejectIf:`Reject or revise if ${format.reject}. Test interest, feasibility, rights, and availability separately.`,
    creativeConstraints:[`Name one specific quality of ${a} that the work must preserve.`,`Name one specific quality of ${b} that must also shape the work.`],
    catalogCues:(anchor.catalogTags??[]).slice(0,3).map(x=>x.name),
    boundary:'This is an editorial starting point. Qloo supports the reference selection; it does not validate the proposed commission or partner interest.'};
}

export async function investigateBrief(report,client,{tolerance=.1,goal='collaboration'}={}) {
  if(!Object.hasOwn(goals,goal))throw Error('Choose a supported project goal.');
  if(typeof tolerance!=='number'||!Number.isFinite(tolerance)||tolerance<0||tolerance>.5)throw Error('Choose a valid balance window.');
  const seedIds=report.seeds.map(x=>x.entity_id);
  const ranked=rankCandidates(report.candidates,seedIds);
  const jointEvidence=domain=>report.evidence.filter(e=>e.path==='/v2/insights'&&e.parameterHash&&
    e.params?.['filter.type']===`urn:entity:${domain}`&&
    String(e.params?.['signal.interests.entities']??'').toUpperCase().split(',').sort().join(',')===seedIds.map(x=>x.toUpperCase()).sort().join(','));
  const balanced=ranked.filter(x=>formats[x.domain]&&x.balance&&x.balance.distance<=tolerance+1e-10);
  const supported=balanced.filter(x=>jointEvidence(x.domain).length>0);
  const selected=[],used=new Set();
  for(const domain of ['place','artist','brand','movie','book']) {
    const c=supported.find(x=>x.domain===domain&&!used.has(x.entity_id));
    if(c){selected.push(c);used.add(c.entity_id);}if(selected.length===3)break;
  }
  for(const c of supported){if(selected.length===3)break;if(!used.has(c.entity_id)){selected.push(c);used.add(c.entity_id);}}
  const ledger=[],evidence=[...report.evidence];
  const rejections={unverified:ranked.filter(x=>!x.balance).length,lopsided:ranked.filter(x=>x.balance&&x.balance.distance>tolerance+1e-10).length,
    ungrounded:balanced.length-supported.length};
  ledger.push({step:'Select references',status:'ok',observation:`${supported.length} candidates meet the balance window. ${rejections.unverified} lack usable attribution; ${rejections.lopsided} fall outside the window.`});
  const directions=[];
  for(const anchor of selected) {
    const checks=[];
    for(const [side,seed] of report.seeds.entries()) {
      const params={'filter.type':`urn:entity:${anchor.domain}`,'signal.interests.entities':seed.entity_id,'feature.explainability':'true',take:20};
      try {
        const r=await client.get('/v2/insights',params);
        const entities=r.body.results?.entities;
        if(!Array.isArray(entities))throw Error('Unexpected shortlist response.');
        const index=entities.findIndex(x=>typeof x?.entity_id==='string'&&x.entity_id.toUpperCase()===anchor.entity_id.toUpperCase());
        const check={seedId:seed.entity_id,status:index>=0?'present':'not_observed',rank:index>=0?index+1:null,evidenceId:r.evidence.parameterHash};
        checks.push(check);evidence.push({...r.evidence,cached:r.cached});
        ledger.push({step:`Check ${anchor.name} against ${seed.name}`,status:'ok',observation:index>=0?`Returned at rank ${index+1} in this seed's top-20 ${anchor.domain} shortlist.`:'Not returned in this seed’s top-20 shortlist. This does not establish absence of affinity.',evidenceId:check.evidenceId,side});
      }catch {
        checks.push({seedId:seed.entity_id,status:'unavailable',rank:null});
        ledger.push({step:`Check ${anchor.name} against ${seed.name}`,status:'error',observation:'Independent shortlist check unavailable. This direction remains uncorroborated.',side});
      }
    }
    const checkStatus=checks.some(x=>x.status==='unavailable')?'incomplete':checks.every(x=>x.status==='present')?'seen_in_both':'needs_testing';
    const jointIds=jointEvidence(anchor.domain).map(e=>e.parameterHash);
    directions.push({id:`direction-${directions.length+1}`,anchor:{entity_id:anchor.entity_id,name:anchor.name,domain:anchor.domain,image:anchor.image},
      observation:{kind:'qloo_observation',shareA:anchor.balance.shareA,shareB:anchor.balance.shareB,rawA:anchor.balance.rawA,rawB:anchor.balance.rawB,
        affinity:anchor.query?.affinity??null,popularity:anchor.popularity??null,evidenceIds:jointIds},
      check:{status:checkStatus,a:checks[0],b:checks[1]},proposal:proposalFor(anchor,report.seeds,goal)});
  }
  return {status:directions.length?'draft':'insufficient_evidence',seeds:report.seeds.map(({entity_id,name})=>({entity_id,name})),
    basis:{goal,tolerance,label:goals[goal],window:`${Math.round((.5-tolerance)*100)}–${Math.round((.5+tolerance)*100)}%`},
    directions,rejections,ledger,evidence,generatedAt:new Date().toISOString(),
    limits:['Pair attribution is not audience size or proof of demand.','Independent checks observe top-20 shortlist membership, not directly comparable cross-query affinity scores.',
      'Creative directions are editorial templates, not Qloo findings or an LLM-generated strategy.','References do not imply participation, endorsement, availability, or licensing rights.']};
}

const clean=value=>String(value??'').replace(/[\r\n]+/g,' ').replace(/([\\`*_{}\[\]<>#|])/g,'\\$1');
export function briefMarkdown(brief) {
  const lines=[`# DIALECTIC: ${brief.seeds.map(x=>clean(x.name)).join(' × ')}`,'',`Project: ${brief.basis.label}`,`Balance window: ${brief.basis.window}`,'',
    'An evidence-led commissioning draft. Proposed directions require human development and testing.',''];
  if(brief.synthesis?.status==='generated')lines.push(`Concept synthesis: AI-generated via ${clean(brief.synthesis.model??'Vercel AI Gateway')}. Qloo grounds the references; AI proposes the creative concepts.`, '');
  else if(brief.synthesis?.status==='unavailable'&&brief.directions.length)lines.push('AI synthesis unavailable. Showing structured starting points from format templates.', '');
  if(!brief.directions.length)lines.push('No references met this balance window. Widen it or choose different entities.','');
  for(const [i,d] of brief.directions.entries())lines.push(`## ${i+1}. ${clean(d.proposal.title)}`,'','### Qloo observation',
    `Reference: ${clean(d.anchor.name)} (${d.anchor.domain}; ${d.anchor.entity_id}).`,
    `Normalized seed attribution: ${(100*d.observation.shareA).toFixed(1)}% / ${(100*d.observation.shareB).toFixed(1)}%. Joint affinity: ${d.observation.affinity??'unavailable'}.`,
    `Independent shortlist check: ${d.check.status.replaceAll('_',' ')}.`,
    `Evidence: ${d.observation.evidenceIds.join(', ')}.`,
    '', '### Proposed direction',`Source: ${d.proposal.kind==='ai_proposal'?'AI-synthesized commission concept':'Structured editorial template'}.`,clean(d.proposal.premise),'',`Deliverable: ${clean(d.proposal.deliverable)}`,
    `Next step: ${clean(d.proposal.nextStep)}`,`Rejection criterion: ${clean(d.proposal.rejectIf)}`,
    ...d.proposal.creativeConstraints.map(x=>`- ${clean(x)}`),'',clean(d.proposal.boundary),'');
  lines.push('## Evidence ledger','',...brief.ledger.map(x=>`- [${x.status}] ${clean(x.step)}: ${clean(x.observation)}${x.evidenceId?` (${x.evidenceId})`:''}`),'',
    '## Limits','',...brief.limits.map(x=>`- ${clean(x)}`),'',`Generated: ${brief.generatedAt}`);
  return lines.join('\n');
}
