export function measureBalance(entity, seeds) {
  if (seeds.length !== 2 || seeds[0] === seeds[1]) return null;
  const entries = entity.query?.explainability?.['signal.interests.entities'];
  if (!Array.isArray(entries)) return null;
  if (entries.some(x => !x || typeof x.entity_id !== 'string')) return null;
  const pair = seeds.map(id => entries.filter(x => x.entity_id?.toUpperCase() === id.toUpperCase()));
  if (pair.some(x => x.length !== 1)) return null;
  const [rawA, rawB] = pair.map(x => x[0].score);
  if (![rawA,rawB].every(x => typeof x === 'number' && Number.isFinite(x) && x >= 0)) return null;
  const sum = rawA + rawB;
  if (!Number.isFinite(sum) || sum <= 0) return null;
  const shareA = rawA / sum, shareB = rawB / sum;
  return { rawA, rawB, shareA, shareB, distance: Math.max(Math.abs(.5-shareA),Math.abs(.5-shareB)) };
}

export function rankCandidates(entities, seeds) {
  return entities.map(entity => ({...entity, balance: measureBalance(entity,seeds)}))
    .sort((a,b) => (a.balance?.distance ?? 1)-(b.balance?.distance ?? 1)
      || (b.query?.affinity ?? 0)-(a.query?.affinity ?? 0));
}
