import {resetBrief,briefLoading,briefError,renderBrief,invalidateBrief} from './brief.js';
const $=id=>document.getElementById(id);
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const domainNames={all:'All worlds',movie:'Film',artist:'Music',book:'Books',place:'Places',brand:'Brands'};
const state={a:null,b:null,matches:{a:[],b:[]},versions:{a:0,b:0},data:null,domain:'all',busy:false,epoch:0};
const pairs=[['Aphex Twin','Martha Stewart'],['Andrei Tarkovsky','Guy Fieri'],['Succession','WWE']];
const percent=value=>`${(value*100).toFixed(1)}%`;
function status(message,type=''){$('status').textContent=message;$('status').className=`status ${type}`;}
async function api(path,options={}) {
  const response=await fetch(path,{...options,signal:AbortSignal.timeout(150_000)});
  const data=await response.json();
  if(!response.ok) throw Error(data.error??'The request could not complete.');
  return data;
}
function clearResults(){state.data=null;state.epoch++;$('results').hidden=true;$('idle').hidden=false;resetBrief();}
function drawMatches(side) {
  const selected=state[side];
  const entries=selected?[selected]:state.matches[side];
  $(`matches-${side}`).innerHTML=entries.map((x,i)=>`<button type="button" class="match ${selected?'selected':''}" data-side="${side}" data-match="${i}" aria-pressed="${Boolean(selected)}"><span><strong>${escape(x.name)}</strong><small>${escape(x.types.map(t=>t.split(':').at(-1).replaceAll('_',' ')).join(', '))}${x.disambiguation?' / '+escape(x.disambiguation):''}</small></span><span class="confirmed-icon">${selected?'✓ Selected':'Select'}</span></button>`).join('');
  if(!entries.length) $(`matches-${side}`).innerHTML='<p class="seed-hint">No matches. Try a more specific name.</p>';
}
function updateButton(){$('collide').disabled=state.busy;$('collide').firstChild.textContent=state.busy?'Investigating… ':state.a&&state.b?'Build commissioning brief ':'Find the collision ';}
async function search(side) {
  const query=$(`seed-${side}`).value.trim();
  const version=++state.versions[side];
  state[side]=null;state.matches[side]=[];clearResults();updateButton();
  if(query.length<2){$(`matches-${side}`).innerHTML='<p class="seed-hint">Enter at least two characters.</p>';return;}
  $(`matches-${side}`).innerHTML='<p class="seed-hint">Searching Qloo…</p>';
  try {
    const data=await api('/api/search?q='+encodeURIComponent(query));
    if(version!==state.versions[side])return;
    state.matches[side]=data.entities;drawMatches(side);
  } catch(error) {
    if(version!==state.versions[side])return;
    $(`matches-${side}`).innerHTML=`<p class="seed-hint">${escape(error.message)}</p>`;
  }
}
for(const side of ['a','b']) {
  $(`form-${side}`).addEventListener('submit',event=>{event.preventDefault();if(!state.busy)search(side);});
  $(`seed-${side}`).addEventListener('input',()=>{
    state.versions[side]++;state[side]=null;state.matches[side]=[];clearResults();updateButton();
    $(`matches-${side}`).innerHTML='<p class="seed-hint">Search, then choose the entity you mean.</p>';status('');
  });
  $(`matches-${side}`).addEventListener('click',event=>{
    const button=event.target.closest('[data-match]');if(!button||state.busy)return;
    if(state[side]) {state[side]=null;drawMatches(side);clearResults();updateButton();return;}
    state[side]=state.matches[side][Number(button.dataset.match)];
    if(!state[side])return;
    drawMatches(side);clearResults();updateButton();
    status(state.a&&state.b?'Both worlds selected. Start the collision when you’re ready.':'Select a match for the other world.');
  });
}
document.querySelectorAll('[data-pair]').forEach(button=>button.addEventListener('click',async()=>{
  if(state.busy)return;
  const pair=pairs[Number(button.dataset.pair)];
  for(const [i,side] of ['a','b'].entries())$(`seed-${side}`).value=pair[i];
  status('Choose the exact entity on each side.');
  await Promise.all(['a','b'].map(search));
}));
function lock(locked){
  state.busy=locked;
  document.querySelectorAll('.seed-panel input,.seed-panel button,[data-pair],#project-goal,#tolerance,#refresh-brief').forEach(el=>el.disabled=locked);
  updateButton();
}
$('collide').addEventListener('click',async()=>{
  if(state.busy)return;
  if(!state.a||!state.b){
    status('First, search and select an exact entity on both sides.');
    await Promise.all(['a','b'].filter(side=>!state[side]).map(search));return;
  }
  if(state.a.entity_id===state.b.entity_id){status('Choose two different entities to find a collision.','error');return;}
  const epoch=state.epoch;
  lock(true);resetBrief();$('results').hidden=true;$('idle').hidden=true;
  status('Following both worlds through film, music, books, places, and brands…','busy');
  const started=performance.now();
  try {
    const data=await api('/api/collide',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({a:state.a.entity_id,b:state.b.entity_id,selectionTokens:[state.a.selectionToken,state.b.selectionToken]})});
    if(epoch!==state.epoch)return;
    state.data=data;state.domain='all';$('results').hidden=false;
    const successes=data.domains.filter(d=>d.status==='ok').length;
    status(`${successes} of 5 domains explored in ${((performance.now()-started)/1000).toFixed(1)} seconds. ${data.candidates.length} candidates examined.${data.evidence.every(e=>e.cached)?' Results served from the local cache.':''}`,successes?'':'error');
    renderResults();
    await buildBrief();
  } catch(error){status(error.message,'error');$('idle').hidden=false;}
  finally{lock(false);}
});
async function buildBrief(){
  if(!state.data)return;
  const epoch=state.epoch;lock(true);briefLoading();
  status('Testing reference candidates against each seed separately and preparing three directions…','busy');
  try{
    const brief=await api('/api/brief',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:state.data.runId,reportToken:state.data.reportToken,goal:$('project-goal').value,tolerance:Number($('tolerance').value)/100})});
    if(epoch!==state.epoch)return;
    state.data.evidence=brief.evidence;
    renderBrief(brief);renderResults();
    status(`${state.data.domains.filter(d=>d.status==='ok').length} domains explored. ${state.data.candidates.length} candidates examined. ${brief.directions.length} proposed directions; ${brief.directions.filter(d=>d.check.status==='seen_in_both').length} references seen in both independent shortlists.`);
  }catch(error){briefError(error.message);status('Candidate results are available. The commissioning brief needs another attempt.','error');}
  finally{lock(false);}
}
$('refresh-brief').addEventListener('click',()=>{if(!state.busy)buildBrief();});
$('project-goal').addEventListener('change',()=>invalidateBrief($('project-goal').value,Number($('tolerance').value)/100));
function qualifies(candidate) {
  return candidate.balance!==null && candidate.balance.distance<=Number($('tolerance').value)/100+1e-10;
}
function renderResults() {
  if(!state.data)return;
  const data=state.data,tolerance=Number($('tolerance').value),showExcluded=$('show-excluded').checked;
  $('window-label').textContent=`${50-tolerance}–${50+tolerance}%`;
  $('result-title').textContent=`${data.seeds[0].name} × ${data.seeds[1].name}`;
  const balanced=data.candidates.filter(qualifies),unverified=data.candidates.filter(c=>!c.balance).length;
  $('count-summary').textContent=`${balanced.length} of ${data.candidates.length} candidates within your balance window.${unverified?' '+unverified+' without usable attribution.':''}`;
  $('domain-tabs').innerHTML=Object.entries(domainNames).map(([key,name])=>{
    const count=balanced.filter(c=>key==='all'||c.domain===key).length;
    return `<button data-domain="${key}" aria-pressed="${state.domain===key}">${name}<span>${count}</span></button>`;
  }).join('');
  $('domain-notices').textContent=data.domains.filter(d=>d.status==='error').map(d=>`${domainNames[d.domain]} unavailable: ${d.error}`).join(' ');
  const visible=data.candidates.filter(c=>(state.domain==='all'||c.domain===state.domain)&&(showExcluded||qualifies(c)));
  $('candidates').innerHTML=visible.length?visible.map(c=>{
    const b=c.balance,qualified=qualifies(c),originalIndex=data.candidates.indexOf(c);
    return `<article class="candidate"><div class="candidate-art">${c.image?`<img src="${escape(c.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:`<div class="art-type" aria-hidden="true">${escape(domainNames[c.domain].slice(0,1))}</div>`}</div><div class="candidate-body"><div class="candidate-domain"><span>${escape(domainNames[c.domain])}</span><span class="${qualified?'':'excluded-badge'}">${qualified?'Within balance window':b?'Outside balance window':'Attribution unavailable'}</span></div><h3>${escape(c.name)}</h3><p class="disambiguation">${escape(c.disambiguation)}</p>${c.description?`<p class="candidate-description">${escape(c.description)}</p>`:''}<div class="balance-block">${b?`<div class="balance-labels"><span>A ${percent(b.shareA)}</span><span>B ${percent(b.shareB)}</span></div><div class="balance-track" role="img" aria-label="Thesis contribution ${percent(b.shareA)}, antithesis ${percent(b.shareB)}"><span data-share="${originalIndex}"></span><span></span></div><p class="balance-note">Normalized seed attribution${typeof c.query.affinity==='number'?` / joint affinity ${c.query.affinity.toFixed(3)}`:''}</p>`:'<p class="balance-note">No balance score: both seed scores are required.</p>'}</div><details><summary>Why this result?</summary><p>Seed scores explain Qloo’s recommendation, not audience percentages. Pair normalization compares A and B; it does not prove causal influence.</p><pre>${escape(JSON.stringify({entity_id:c.entity_id,affinity:c.query.affinity,explainability:c.query.explainability,balance:c.balance},null,2))}</pre></details></div></article>`;
  }).join(''):`<div class="empty"><h3>${data.domains.every(d=>d.status==='error')?'The investigation could not reach Qloo.':'No measured bridge in this window.'}</h3><p>${data.domains.every(d=>d.status==='error')?'Review the domain errors above, then try the collision again.':'Widen the balance window, explore another domain, or show excluded candidates to see what fell outside the threshold. A missing bridge is a result too.'}</p></div>`;
  document.querySelectorAll('[data-share]').forEach(span=>{
    const b=data.candidates[Number(span.dataset.share)].balance;
    span.style.flexBasis=percent(b.shareA);span.nextElementSibling.style.flexBasis=percent(b.shareB);
  });
  document.querySelectorAll('.candidate-art img').forEach(img=>img.addEventListener('error',()=>{
    const placeholder=document.createElement('div');placeholder.className='art-type';placeholder.textContent='∩';img.replaceWith(placeholder);
  },{once:true}));
  const tags=data.compare.sharedTags;
  $('shared-tags').innerHTML=tags.length?tags.slice(0,30).map(t=>`<span class="tag-pill">${escape(t.name??t.tag_id??t.id)}</span>`).join(''):`<p>${data.compare.status==='error'?'Catalog comparison unavailable. Recommendation attribution is still shown above.':'Qloo returned no shared catalog tags. The recommendation bridge can still exist across different domains.'}</p>`;
  $('investigation-summary').textContent=`${data.method} ${data.candidates.length} candidates across up to five domains; 20 requested per domain. Cache lifetime: 30 minutes in this server process. Generated ${new Date(data.generatedAt).toLocaleString()}.`;
  $('request-evidence').textContent=JSON.stringify({seeds:data.seeds.map(({entity_id,name,types})=>({entity_id,name,types})),requests:data.evidence,domains:data.domains,compare:data.compare,warnings:data.warnings},null,2);
}
$('domain-tabs').addEventListener('click',event=>{const button=event.target.closest('[data-domain]');if(button){state.domain=button.dataset.domain;renderResults();document.querySelector(`[data-domain="${state.domain}"]`).focus({preventScroll:true});}});
$('tolerance').addEventListener('input',()=>{renderResults();invalidateBrief($('project-goal').value,Number($('tolerance').value)/100);});
$('show-excluded').addEventListener('change',renderResults);
$('export').addEventListener('click',()=>{
  if(!state.data)return;
  const blob=new Blob([JSON.stringify({...state.data,balanceWindow:{min:(50-Number($('tolerance').value))/100,max:(50+Number($('tolerance').value))/100}},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='dialectic-evidence.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
$('method-button').addEventListener('click',()=>{$('method').hidden=!$('method').hidden;if(!$('method').hidden){$('method').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});$('method').focus({preventScroll:true});}});
