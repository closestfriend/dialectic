import test from 'node:test';
import assert from 'node:assert/strict';
import { createQlooClient } from './qloo.mjs';

test('canonical cache and in-flight deduplication share a single response', async () => {
  let calls=0;
  const client=createQlooClient({apiKey:'test',fetchImpl:async()=>{calls++; return Response.json({results:[]});}});
  const [a,b]=await Promise.all([client.get('/search',{query:'x',take:1}),client.get('/search',{take:1,query:'x'})]);
  await client.get('/search',{query:'x',take:1});
  assert.equal(calls,1); assert.deepEqual(a.body,b.body);
});
test('parallel work starts at least 250ms apart and failures do not poison queue', async () => {
  const starts=[];
  const client=createQlooClient({apiKey:'test',fetchImpl:async()=>{
    starts.push(performance.now());
    return starts.length===1 ? Response.json({errors:[]},{status:429}) : Response.json({results:[]});
  }});
  const result=await Promise.allSettled([client.get('/search',{query:'a'}),client.get('/search',{query:'b'}),client.get('/search',{query:'c'})]);
  assert.equal(result[0].status,'rejected'); assert.equal(result[2].status,'fulfilled');
  assert.ok(starts[1]-starts[0]>=250); assert.ok(starts[2]-starts[1]>=250);
});
test('unsupported parameters are rejected before any network request', async () => {
  const client=createQlooClient({apiKey:'test',fetchImpl:()=>{throw Error('network must not be used');}});
  await assert.rejects(client.get('/v2/insights',{'filter.typo':'x'}),/Unsupported/);
  await assert.rejects(client.get('/elsewhere',{}),/Unsupported/);
});
