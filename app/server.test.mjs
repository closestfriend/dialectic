import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from './server.mjs';

test('server requires confirmed distinct entities and preserves partial domain results', async t=>{
  const ids=['4278382F-4991-4D63-B207-942D86A26ACB','0FDCD959-FE49-4298-BC1F-807589E295E9'];
  const client={get:async(path,params)=>{
    let body;
    if(path==='/search') body={results:ids.map((entity_id,i)=>({entity_id,name:['Aphex Twin','Martha Stewart'][i],types:['urn:entity:artist']}))};
    else if(path.includes('compare')) body={results:{tags:[]}};
    else {
      if(params['filter.type']==='urn:entity:book') throw Error('Domain unavailable');
      body={results:{entities:[{entity_id:'candidate',name:'Bridge',query:{affinity:.8,explainability:{'signal.interests.entities':ids.map(entity_id=>({entity_id,score:.5}))}}}]}};
    }
    return {body,evidence:{path,params,parameterHash:'fixture-'+(params['filter.type']??'search')+'-'+(params['signal.interests.entities']??'')},cached:false};
  }};
  const app=createApp({client,stateSecret:'test-secret'});
  await new Promise(r=>app.listen(0,'127.0.0.1',r)); t.after(()=>new Promise(r=>app.close(r)));
  const base=`http://127.0.0.1:${app.address().port}`;
  const post=async body=>fetch(base+'/api/collide',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  assert.equal((await post({a:ids[0],b:ids[1]})).status,400);
  const search=await fetch(base+'/api/search?q=Aphex'); assert.equal(search.status,200);
  assert.equal((await post({a:ids[0],b:ids[0]})).status,400);
  const result=await post({a:ids[0],b:ids[1]}); assert.equal(result.status,200);
  const data=await result.json(); assert.equal(data.domains.length,5);
  assert.equal(data.domains.find(x=>x.domain==='book').status,'error');
  assert.equal(data.candidates.length,4); assert.equal(data.candidates[0].balance.shareA,.5);
  const briefPost=body=>fetch(base+'/api/brief',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  assert.equal((await briefPost({runId:'missing'})).status,404);
  assert.equal((await briefPost({runId:data.runId,goal:'unsupported'})).status,400);
  const briefResponse=await briefPost({runId:data.runId,goal:'collaboration',tolerance:.1});
  assert.equal(briefResponse.status,200);
  const brief=await briefResponse.json();assert.ok(brief.directions.length>0);assert.match(brief.markdown,/Proposed direction/);
  assert.ok(brief.directions.every(d=>d.check.status==='seen_in_both'));
  assert.equal((await fetch(base+'/.env')).status,404);
  assert.equal((await fetch(base+'/api/search?q=x',{headers:{Origin:'https://evil.example'}})).status,403);
  const publicSearch=await new Promise((resolve,reject)=>http.get(base+'/api/search?q=Aphex',{headers:{Host:'dialectic.vercel.app',Origin:'https://dialectic.vercel.app','X-Forwarded-Proto':'https'}},res=>{let body='';res.on('data',x=>body+=x);res.on('end',()=>resolve({status:res.statusCode,body:JSON.parse(body)}));}).on('error',reject));
  assert.equal(publicSearch.status,200);
  const entities=publicSearch.body.entities;
  const cold=createApp({client,stateSecret:'test-secret'});
  await new Promise(r=>cold.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>cold.close(r)));
  const coldBase=`http://127.0.0.1:${cold.address().port}`;
  const coldCollision=await fetch(coldBase+'/api/collide',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({a:ids[0],b:ids[1],selectionTokens:entities.map(x=>x.selectionToken)})});
  assert.equal(coldCollision.status,200);
  const coldReport=await coldCollision.json();
  const recovered=await briefPost({runId:coldReport.runId,reportToken:coldReport.reportToken});
  assert.equal(recovered.status,200);
  const tampered=coldReport.reportToken.slice(0,-5)+'xxxxx';
  assert.equal((await briefPost({runId:coldReport.runId,reportToken:tampered})).status,404);
});
