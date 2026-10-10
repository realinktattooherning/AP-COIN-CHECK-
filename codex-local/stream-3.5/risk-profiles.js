/* Profile policy is separate from the original checks and historical results. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DKRisk = api;
})(typeof window === 'object' ? window : this, function () {
  const profiles = {
    1: { name: 'Explore upside', short: 'Level 1 · Explore', mode: 'High risk',
      note: 'Market cap and socials are advisory. Liquidity, authorities, holder and other security checks still apply. This profile has not been performance-tested.' },
    2: { name: 'Take your time', short: 'Level 2 · Patient', mode: 'Full checks',
      note: 'All checks apply. A +20% trade is a personal target, not a steady return or an automatic exit. Losses can exceed any planned stop.' },
    3: { name: 'Protect essentials', short: 'Level 3 · Paper only', mode: 'Learning only',
      note: 'If this money pays rent or bills, keep it out of memecoins. Explore the checks on paper; this profile never labels a coin a buy candidate.' }
  };
  let current = 2;
  let chosen = false;
  function advisory(rule, level = current) {
    return Number(level) === 1 && /^(V4 Market cap|V15 Market cap|V17 )/.test(rule);
  }
  function assess(rows, score, pending = [], level = current) {
    const active = rows.filter(r => !advisory(r.rule, level));
    const missing = pending.length ? [] : active.filter(r => r.s === 'NA' && !r.rule.startsWith('V9'));
    const raw = score(rows);
    const rawMissing = rows.filter(r => r.s === 'NA' && !r.rule.startsWith('V9'));
    const result = score(active);
    const buy = missing.length || pending.length ? Math.min(result.buy, 3) : result.buy;
    const label = pending.length ? 'SCANNING' : Number(level) === 3 ? 'PAPER ONLY' : missing.length ? 'INCOMPLETE' : buy <= 3 ? "DON’T BUY" : buy <= 6 ? 'WAIT / CAUTION' : 'RESEARCH CANDIDATE';
    return { ...result, buy, label, missing, active, advisory: rows.filter(r => advisory(r.rule, level)),
      baseline: rawMissing.length || pending.length ? Math.min(raw.buy, 3) : raw.buy,
      paperOnly: Number(level) === 3 };
  }
  return { profiles, advisory, assess, get: () => current, chosen: () => chosen,
    select(value) { if (!Object.hasOwn(profiles, value)) throw new Error('Unknown risk profile'); current = Number(value); chosen = true; } };
});
