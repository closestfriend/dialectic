import { createHash } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { traceOperation } from './tracing.mjs';

const allowed = {
  '/search': ['query','take'],
  '/v2/analysis/compare': ['a.signal.interests.entities','b.signal.interests.entities'],
  '/v2/insights': ['filter.type','signal.interests.entities','feature.explainability','take'],
};

export function createQlooClient({ apiKey, baseUrl='https://hackathon.api.qloo.com', fetchImpl=fetch,
  ttl=30*60*1000 }={}) {
  const origin=new URL(baseUrl);
  if(origin.protocol!=='https:' || !['hackathon.api.qloo.com','api.qloo.com'].includes(origin.hostname)
    || origin.username || origin.password || origin.port) throw Error('Use an official Qloo HTTPS endpoint');
  const cache=new Map(), pending=new Map();
  let queue=Promise.resolve(), lastStart=0, cooldown=0;
  async function get(path, params) {
    if(!allowed[path] || Object.keys(params).some(k=>!allowed[path].includes(k))) throw Error('Unsupported Qloo endpoint or parameter');
    if(!apiKey) throw Object.assign(Error('Qloo key is missing. Configure .env and restart.'),{status:503});
    const query=new URLSearchParams(Object.entries(params).sort(([a],[b])=>a.localeCompare(b)));
    const hash=createHash('sha256').update(path+'?'+query).digest('hex');
    const hit=cache.get(hash);
    if(hit && Date.now()-hit.time<ttl) return {...hit.value,cached:true};
    if(pending.has(hash)) return pending.get(hash);
    const task=queue.then(async()=>{
      // Serialize the HTTP boundary, including failures; workflow fan-out cannot bypass pacing.
      let remaining;
      while((remaining=Math.max(lastStart+250-performance.now(),cooldown-Date.now()))>0) {
        await sleep(Math.ceil(remaining));
      }
      lastStart=performance.now();
      let response;
      try {
        response=await fetchImpl(new URL(path+'?'+query,origin),{
          headers:{'X-Api-Key':apiKey,Accept:'application/json'},
          signal:AbortSignal.timeout(20_000),redirect:'error',
        });
      } catch { throw Object.assign(Error('Qloo request timed out or could not connect. Try again.'),{status:502}); }
      if(!response.ok) {
        if(response.status===429) {
          const raw=response.headers.get('retry-after');
          const delay=raw===null?1000:Number.isFinite(Number(raw))?Number(raw)*1000:Date.parse(raw)-Date.now();
          cooldown=Date.now()+Math.min(60_000,Math.max(1000,Number.isFinite(delay)?delay:1000));
        }
        const hint=response.status===429?'Rate limit reached; wait before trying again.':
          [401,403].includes(response.status)?'Qloo rejected the credential. Check access and expiration.':'Qloo could not complete this query.';
        await response.body?.cancel();
        throw Object.assign(Error(`Qloo HTTP ${response.status}. ${hint}`),{status:502,qlooStatus:response.status});
      }
      let body;
      try { body=await response.json(); } catch { throw Object.assign(Error('Qloo returned an invalid JSON response.'),{status:502}); }
      if(body.success===false || body.errors?.length) throw Object.assign(Error('Qloo rejected the query.'),{status:502});
      const value={body,cached:false,evidence:{path,params,parameterHash:hash,receivedAt:new Date().toISOString(),httpStatus:response.status}};
      if(cache.size>=250) cache.delete(cache.keys().next().value);
      cache.set(hash,{time:Date.now(),value});
      return value;
    });
    queue=task.catch(()=>{});
    pending.set(hash,task);
    try { return await task; } finally { pending.delete(hash); }
  }
  return {get:(path,params)=>traceOperation(`Qloo ${path}`,{path,params},()=>get(path,params),{tool:true,
    summarize:r=>({cached:r.cached,evidence:r.evidence,resultCount:r.body.results?.entities?.length??(Array.isArray(r.body.results)?r.body.results.length:null)})})};
}
