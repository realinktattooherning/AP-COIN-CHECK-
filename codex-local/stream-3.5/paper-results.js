(() => {
  const data = window.DKPaperResults;
  const tbody = document.getElementById('paper-trades');
  if (!data || !tbody) return;
  const money = value => (value < 0 ? '−' : '') + '$' + Math.abs(value).toFixed(2);
  const signed = value => (value > 0 ? '+' : '') + money(value);
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function render(filter) {
    const rows = data.trades.filter(t => filter === 'all' || (filter === 'wins' ? t.net_pnl_usd > 0 : t.net_pnl_usd < 0));
    tbody.innerHTML = rows.map(t => `<tr><td><a class="token-name" href="https://dexscreener.com/solana/${encodeURIComponent(t.mint)}" target="_blank" rel="noopener">${escape(t.name)} ↗</a><span class="token-time">${escape(t.closed_at.slice(11,19))} UTC</span></td><td>${t.entry_score}/10</td><td>${money(t.stake_usd)}</td><td>${money(t.proceeds_usd)}</td><td class="${t.net_pnl_usd > 0 ? 'pnl-positive' : 'pnl-negative'}"><b>${signed(t.net_pnl_usd)}</b><br><small>${t.net_pnl_usd > 0 ? '+' : '−'}${Math.abs(t.net_pnl_usd / t.stake_usd * 100).toFixed(2)}%</small></td></tr>`).join('');
    document.getElementById('results-filter-summary').textContent = `${rows.length} closed paper positions · net ${signed(rows.reduce((n,t) => n + t.net_pnl_usd,0))}`;
    document.querySelectorAll('[data-result-filter]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.resultFilter === filter)));
  }
  document.querySelectorAll('[data-result-filter]').forEach(b => b.addEventListener('click', () => render(b.dataset.resultFilter)));
  render('all');
  const values = [0];
  data.trades.forEach(t => values.push(values.at(-1) + t.net_pnl_usd));
  const min = Math.min(...values, -20), max = Math.max(...values, 60);
  const x = i => 50 + i * 380 / (values.length - 1), y = v => 165 - (v - min) / (max - min) * 130;
  const points = values.map((v,i) => `${x(i)},${y(v)}`).join(' ');
  const chart = `<svg viewBox="0 0 460 208" role="img" aria-labelledby="pnl-title pnl-desc"><title id="pnl-title">Cumulative net paper profit after recorded exits</title><desc id="pnl-desc">Starts at zero, finishes at ${signed(values.at(-1))} after nine closed positions. This is not an account-equity curve.</desc>${[-20,0,20,40,60].map(v => `<line x1="50" x2="430" y1="${y(v)}" y2="${y(v)}" stroke="${v===0?'#66778B':'#223142'}" stroke-dasharray="${v===0?'4 4':'0'}"/><text x="36" y="${y(v)+4}" text-anchor="end">${v}</text>`).join('')}<polyline class="chart-line" points="${points}"/>${values.map((v,i) => `<circle cx="${x(i)}" cy="${y(v)}" r="3.5" fill="${i && data.trades[i-1].net_pnl_usd<0?'#FF4A5E':'#8ABBE3'}"><title>${i ? escape(data.trades[i-1].name) : 'Start'}: ${signed(v)} cumulative</title></circle>`).join('')}<text x="50" y="194">START</text><text x="430" y="194" text-anchor="end">9 CLOSED</text></svg>`;
  document.getElementById('paper-chart').insertAdjacentHTML('afterbegin',chart);
  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('reveal-once'); observer.unobserve(entry.target); } }), {threshold:.12});
    document.querySelectorAll('.stats,.results-panel').forEach(el => observer.observe(el));
  }
})();
