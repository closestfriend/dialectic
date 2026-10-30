// Synthetic offline fixtures for native MLflow evaluation. Never calls Qloo.
import { investigateBrief } from '../app/brief.mjs';
let input='';for await(const chunk of process.stdin)input+=chunk;
const {scenario}=JSON.parse(input);
if(!['balanced','lopsided','malformed','missing-provenance','check-failure','not-observed'].includes(scenario))throw Error('Unknown evaluation fixture');
const seeds=[{entity_id:'seed-a',name:'Fixture ensemble'},{entity_id:'seed-b',name:'Fixture studio'}];
const candidates=['place','artist','brand'].map(domain=>({entity_id:'ref-'+domain,name:'Fixture '+domain,domain,
  query:{affinity:.8,explainability:{'signal.interests.entities':scenario==='malformed'?[null]:
    [{entity_id:'seed-a',score:scenario==='lopsided'?.99:.5},{entity_id:'seed-b',score:scenario==='lopsided'?.01:.5}]}}}));
const evidence=scenario==='missing-provenance'?[]:['place','artist','brand'].map(domain=>({path:'/v2/insights',parameterHash:'fixture-joint-'+domain,
  params:{'filter.type':'urn:entity:'+domain,'signal.interests.entities':'seed-a,seed-b'}}));
let requests=0;
const client={get:async(path,params)=>{
  requests++;
  if(scenario==='check-failure')throw Error('Simulated failure');
  const domain=params['filter.type'].split(':').at(-1);
  return {body:{results:{entities:scenario==='not-observed'?[]:[{entity_id:'ref-'+domain}]}},
    evidence:{path,params,parameterHash:'fixture-check-'+domain+'-'+params['signal.interests.entities']},cached:false};
}};
const result=await investigateBrief({seeds,candidates,evidence},client);
process.stdout.write(JSON.stringify({...result,fixtureRequests:requests}));
