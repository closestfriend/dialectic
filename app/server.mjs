import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createQlooClient } from './qloo.mjs';
import { rankCandidates } from './balance.mjs';
import { randomUUID } from 'node:crypto';
import { investigateBrief, briefMarkdown, goals } from './brief.mjs';
import { traceOperation } from './tracing.mjs';
import { stateCodec } from './state.mjs';
import { synthesizeBrief } from './synthesis.mjs';

const domains=['movie','artist','book','place','brand'];
const publicFiles={'/':['index.html','text/html'],'/app.js':['app.js','text/javascript'],'/brief.js':['brief.js','text/javascript'],'/style.css':['style.css','text/css']};
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const fail=(message,status=400)=>Object.assign(Error(message),{status});
function trustedHost(host) {
  const hostname=host?.split(':')[0]?.toLowerCase();
  return hostname==='127.0.0.1'||hostname==='localhost'||hostname?.endsWith('.vercel.app');
}
function requestOrigin(req,host) {
  return `${req.headers['x-forwarded-proto']??'http'}://${host}`;
}
function imageUrl(value) {
  try { const u=new URL(value); return u.protocol==='https:'&&u.hostname==='images.qloo.com'?u.href:null; } catch {return null;}
}
function entitySummary(x) {
  return {entity_id:x.entity_id,name:x.name,types:x.types??[x.subtype].filter(Boolean),
    disambiguation:x.disambiguation??'',image:imageUrl(x.properties?.image?.url),
    description:(x.properties?.description??'').slice(0,1200)};
}
async function jsonBody(req) {
  if(req.body!==undefined) {
    if(Buffer.byteLength(JSON.stringify(req.body))>1500000)throw fail('Request is too large.',413);
    return typeof req.body==='string'?JSON.parse(req.body):req.body;
  }
  let body='';
  for await(const chunk of req) {body+=chunk; if(Buffer.byteLength(body)>1500000) throw fail('Request is too large.',413);}
  try {return JSON.parse(body);} catch {throw fail('Send a valid JSON request.');}
}
export function createApp({client=createQlooClient({apiKey:process.env.QLOO_API_KEY,baseUrl:process.env.QLOO_BASE_URL}),stateSecret=process.env.STATE_SIGNING_SECRET??process.env.QLOO_API_KEY??randomUUID()}={}) {
  const codec=stateCodec(stateSecret);
  const synthesisCache=new Map();
  const confirmed=new Map(),reports=new Map(); let collisions=0, searches=0,briefs=0;
  const server=http.createServer(async(req,res)=>{
    const send=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(body));};
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' https://images.qloo.com; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    try {
      const host=req.headers.host;
      if(!host || !trustedHost(host)) throw fail('Untrusted host.',403);
      if(req.headers.origin && req.headers.origin!==requestOrigin(req,host)) throw fail('Cross-origin requests are not allowed.',403);
      if(req.headers['sec-fetch-site']==='cross-site') throw fail('Cross-site requests are not allowed.',403);
      const url=new URL(req.url,`http://${host}`);
      if(req.method==='GET' && publicFiles[url.pathname]) {
        const [file,type]=publicFiles[url.pathname];
        const content=await readFile(new URL('./public/'+file,import.meta.url));
        res.writeHead(200,{'Content-Type':type+'; charset=utf-8','Cache-Control':'no-cache'});return res.end(content);
      }
      if(url.pathname==='/api/search' && req.method==='GET') {
        const q=url.searchParams.get('q')?.trim();
        if(!q || q.length<2 || q.length>120) throw fail('Enter between 2 and 120 characters.');
        if(searches>=4) throw fail('Search is busy. Try again shortly.',429);
        searches++;
        try {
          const result=await client.get('/search',{query:q,take:6});
          if(!Array.isArray(result.body.results)) throw fail('Qloo search returned an unexpected response.',502);
          const entities=result.body.results.filter(x=>uuid.test(x.entity_id)&&x.name).map(entitySummary);
          for(const entity of entities) {
            if(confirmed.size>=500) confirmed.delete(confirmed.keys().next().value);
            confirmed.set(entity.entity_id.toUpperCase(),{entity,time:Date.now()});
          }
          return send(200,{entities:entities.map(entity=>({...entity,selectionToken:codec.encode('entity',entity)})),cached:result.cached});
        } finally {searches--;}
      }
      if(url.pathname==='/api/collide' && req.method==='POST') {
        if(!req.headers['content-type']?.startsWith('application/json')) throw fail('JSON content type required.',415);
        const body=await jsonBody(req);
        if(!body||typeof body.a!=='string'||typeof body.b!=='string'||!uuid.test(body.a)||!uuid.test(body.b)) throw fail('Select two search results.');
        const seeds=[body.a.toUpperCase(),body.b.toUpperCase()];
        if(seeds[0]===seeds[1]) throw fail('Choose two different entities to collide.');
        const selected=seeds.map((id,i)=>{
          const entity=codec.decode(body.selectionTokens?.[i],'entity');
          return entity?.entity_id?.toUpperCase()===id?{entity,time:Date.now()}:confirmed.get(id);
        });
        if(selected.some(x=>!x || Date.now()-x.time>60*60*1000)) throw fail('Search and confirm both entities again.');
        if(collisions||briefs) throw fail('An investigation is already running. Try again shortly.',429);
        collisions++;
        try {
          const evidence=[], warnings=[];
          const compareTask=client.get('/v2/analysis/compare',{'a.signal.interests.entities':seeds[0],'b.signal.interests.entities':seeds[1]})
            .then(r=>{evidence.push({...r.evidence,cached:r.cached});return {status:'ok',sharedTags:r.body.results?.tags??[],
              thesisTags:r.body.results?.a??[],antithesisTags:r.body.results?.b??[]};})
            .catch(error=>{warnings.push(error.message);return {status:'error',sharedTags:[],error:error.message};});
          const results=await Promise.all(domains.map(async domain=>{
            try {
              const r=await client.get('/v2/insights',{'filter.type':`urn:entity:${domain}`,
                'signal.interests.entities':seeds.join(','),'feature.explainability':'true',take:20});
              evidence.push({...r.evidence,cached:r.cached});
              const entities=r.body.results?.entities;
              if(!Array.isArray(entities)) throw Error('Qloo returned an unexpected result shape.');
              return {domain,status:'ok',candidates:entities.filter(x=>!seeds.includes(x.entity_id?.toUpperCase())).map(x=>({
                ...entitySummary(x),domain,popularity:x.popularity,query:x.query??{},
                catalogTags:(x.tags??[]).filter(t=>/^urn:tag:(style|theme|genre):/.test(t.id??t.tag_id)).slice(0,8).map(t=>({id:t.id??t.tag_id,name:t.name})),
              }))};
            } catch(error) {return {domain,status:'error',error:error.message,candidates:[]};}
          }));
          const compare=await compareTask;
          const report={runId:randomUUID(),seeds:selected.map(x=>x.entity),compare,
            domains:results.map(({candidates,...r})=>({...r,count:candidates.length})),
            candidates:rankCandidates(results.flatMap(r=>r.candidates),seeds),evidence,warnings,
            generatedAt:new Date().toISOString(),method:'Normalized pair attribution; minimax distance from 50/50, then joint affinity.'};
          if(reports.size>=20)reports.delete(reports.keys().next().value);
          reports.set(report.runId,{report,time:Date.now()});
          return send(200,{...report,reportToken:codec.encode('report',report)});
        } finally {collisions--;}
      }
      if(url.pathname==='/api/brief' && req.method==='POST') {
        if(!req.headers['content-type']?.startsWith('application/json'))throw fail('JSON content type required.',415);
        const body=await jsonBody(req);
        if(!body||typeof body.runId!=='string')throw fail('Start a collision first.');
        const signedReport=codec.decode(body.reportToken,'report');
        const stored=signedReport?.runId===body.runId?{report:signedReport,time:Date.now()}:reports.get(body.runId);
        if(!stored||Date.now()-stored.time>60*60*1000)throw fail('This investigation expired. Run the collision again.',404);
        const goal=body.goal??'collaboration',tolerance=body.tolerance??.1;
        if(!Object.hasOwn(goals,goal)||typeof tolerance!=='number'||!Number.isFinite(tolerance)||tolerance<0||tolerance>.5)throw fail('Choose a valid project goal and balance window.');
        if(briefs||collisions)throw fail('An investigation is already running. Try again shortly.',429);
        briefs++;
        try {
          const brief=await traceOperation('DIALECTIC commissioning investigation',{runId:body.runId,goal,tolerance,seeds:stored.report.seeds.map(x=>({entity_id:x.entity_id,name:x.name}))},
            async()=>{
              const cacheKey=body.runId+':'+goal+':'+tolerance;
              const cached=synthesisCache.get(cacheKey);
              if(cached&&Date.now()-cached.time<1800000)return cached.brief;
              const grounded=await investigateBrief(stored.report,client,{goal,tolerance});
              const result=await synthesizeBrief(grounded);
              if(result.synthesis.status==='generated'){
                if(synthesisCache.size>=20)synthesisCache.delete(synthesisCache.keys().next().value);
                synthesisCache.set(cacheKey,{brief:result,time:Date.now()});
              }
              return result;
            },{summarize:r=>({status:r.status,directions:r.directions,ledger:r.ledger,rejections:r.rejections,synthesis:r.synthesis})});
          send(200,{...brief,runId:body.runId,markdown:briefMarkdown(brief)});
        }finally{briefs--;}
        return;
      }
      send(404,{error:'Not found.'});
    } catch(error) {send(error.status??500,{error:error.status?error.message:'The local server could not complete this request.'});}
  });
  server.requestTimeout=30_000;
  return server;
}
if(process.argv[1] && fileURLToPath(import.meta.url)===process.argv[1]) {
  const port=Number(process.env.PORT??4317);
  const app=createApp();
  app.on('error',error=>{console.error(error.code==='EADDRINUSE'?`Port ${port} is busy. Choose another PORT.`:'Server failed to start.');process.exitCode=1;});
  app.listen(port,'127.0.0.1',()=>console.log(`DIALECTIC ready at http://127.0.0.1:${port}`));
}
