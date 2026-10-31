const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pct=n=>(100*n).toFixed(1)+'%';
const checkLabels={seen_in_both:'Seen in both independent shortlists',needs_testing:'Independent support still needs testing',incomplete:'Independent check incomplete'};
let current=null;

function clearDraft(){
  current=null;$('brief-markdown').value='';$('markdown-wrap').hidden=true;$('markdown-wrap').open=false;
  $('brief-cards').innerHTML='';$('brief-ledger').innerHTML='';$('brief-feedback').textContent='';$('brief-basis').textContent='';
  setActions(false);
}
export function resetBrief(){clearDraft();$('brief-section').hidden=true;}
export function briefLoading(){
  clearDraft();$('brief-ledger-wrap').hidden=true;
  $('brief-section').hidden=false;$('brief-cards').innerHTML='';$('brief-ledger').innerHTML='';$('brief-title').textContent='Developing the commission';
  $('brief-notice').textContent='Checking each reference against the two seeds separately. A balanced recommendation is a starting point, not proof of demand.';
  $('refresh-brief').hidden=true;setActions(false);
}
export function briefError(message){
  clearDraft();$('brief-ledger-wrap').hidden=true;
  $('brief-section').hidden=false;$('brief-notice').textContent=message;$('refresh-brief').hidden=false;setActions(false);
}
function setActions(enabled){for(const id of ['copy-brief','download-brief','print-brief'])$(id).disabled=!enabled;}
export function invalidateBrief(goal,tolerance){
  if(!current)return;
  const stale=current.basis.goal!==goal||Math.abs(current.basis.tolerance-tolerance)>1e-10;
  $('brief-cards').hidden=stale;$('brief-ledger-wrap').hidden=stale;$('refresh-brief').hidden=!stale;setActions(!stale);
  $('markdown-wrap').hidden=stale;if(stale)$('markdown-wrap').open=false;
  $('brief-notice').textContent=stale?'Your settings changed. Update the brief to use this goal and balance window.':
    'Commission starting points for your team to develop. Qloo grounds the references; the proposed work still needs testing.';
}
export function renderBrief(brief){
  current=brief;$('brief-section').hidden=false;$('brief-cards').hidden=false;$('brief-ledger-wrap').hidden=false;$('markdown-wrap').hidden=false;
  $('brief-title').textContent=`${brief.seeds[0].name} × ${brief.seeds[1].name}`;
  $('brief-basis').textContent=`${brief.basis.label} / ${brief.basis.window} attribution window`;
  $('brief-notice').textContent=brief.directions.length?
    'Commission starting points for your team to develop. Qloo grounds the references; the proposed work still needs testing.':
    'No reference meets this balance window. Widen it or choose another pair; the tool will not invent evidence to fill three slots.';
  $('refresh-brief').hidden=true;setActions(true);
  $('brief-cards').innerHTML=brief.directions.map((d,i)=>`<article class="brief-card">
    <div class="direction-label"><span>Starting point ${i+1}</span><span>${esc(d.proposal.format)}</span></div>
    <h3>${esc(d.proposal.title)}</h3>
    <div class="proposal-copy"><h4>What to make</h4><p class="commission-deliverable">${esc(d.proposal.deliverable)}.</p><h4>First step</h4><p class="commission-start">${esc(d.proposal.nextStep)}</p></div>
    <div class="brief-observation brief-evidence-summary"><span class="section-label">Reference evidence</span><p><span class="thesis-color">${pct(d.observation.shareA)} ${esc(brief.seeds[0].name)}</span> / <span class="antithesis-color">${pct(d.observation.shareB)} ${esc(brief.seeds[1].name)}</span></p>
      <p class="corroboration ${d.check.status==='seen_in_both'?'corroborated':''}">${esc(checkLabels[d.check.status])}</p>
    </div>
    <details class="commission-details"><summary>Develop this direction & inspect evidence</summary>
      <p>${esc(d.proposal.premise)}</p>${d.proposal.catalogCues.length?`<p class="catalog-cues">Catalog references: ${esc(d.proposal.catalogCues.join(', '))}</p>`:''}
      <h4>Keep both worlds present</h4><ul>${d.proposal.creativeConstraints.map(c=>`<li>${esc(c)}</li>`).join('')}</ul>
      <div class="rejection"><h4>Reason to reject it</h4><p>${esc(d.proposal.rejectIf)}</p></div>
      <h4>What Qloo observed</h4><p>${esc(d.anchor.name)} was returned for the two seeds together. The percentages above normalize the two seeds' recommendation scores; they do not measure audience size or validate the commission.</p>
      <div class="shortlist-checks">${[d.check.a,d.check.b].map((c,side)=>`<span>${esc(brief.seeds[side].name)}: ${c.status==='present'?`rank ${c.rank}`:c.status==='not_observed'?'not in top 20':'unavailable'}</span>`).join('')}</div>
      <p>Joint affinity: ${typeof d.observation.affinity==='number'?d.observation.affinity.toFixed(3):'unavailable'}. Shortlist absence is inconclusive. Participation, rights, availability and demand remain untested.</p>
      <details><summary>Raw evidence</summary><pre>${esc(JSON.stringify({entity:d.anchor.entity_id,observation:d.observation,independentChecks:d.check},null,2))}</pre></details>
    </details>
  </article>`).join('');
  $('brief-ledger').innerHTML=brief.ledger.map(entry=>`<li><strong>${esc(entry.step)}</strong><span class="ledger-status">${entry.status==='error'?'Unresolved':'Recorded'}</span><p>${esc(entry.observation)}</p>${entry.evidenceId?`<code>${esc(entry.evidenceId)}</code>`:''}</li>`).join('');
  $('brief-markdown').value=brief.markdown;
}
$('copy-brief').addEventListener('click',async()=>{
  if(!current)return;
  try{await navigator.clipboard.writeText(current.markdown);$('brief-feedback').textContent='Brief copied.';}
  catch{$('markdown-wrap').open=true;$('brief-markdown').focus();$('brief-markdown').select();$('brief-feedback').textContent='Select and copy the Markdown below.';}
});
$('download-brief').addEventListener('click',()=>{
  if(!current)return;
  const url=URL.createObjectURL(new Blob([current.markdown],{type:'text/markdown;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download='dialectic-commissioning-brief.md';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  $('brief-feedback').textContent='Markdown export prepared.';
});
$('print-brief').addEventListener('click',()=>{if(current)window.print();});
