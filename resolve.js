// Finds the coin a page is about: the scanner popup and the stream panel both use this.
// Ranks every address the page mentions (URL > links to coin sites > title > page text, e.g. livestream chat),
// keeps only real addresses (a Solana address must decode to 32 bytes), then resolves pools to tokens via DexScreener.
(function (root) {
  "use strict";
  const ADDR = /0x[0-9a-fA-F]{40}|[1-9A-HJ-NP-Za-km-z]{32,44}/g;
  const EVM = /^0x[0-9a-fA-F]{40}$/;
  const COIN_LINK = /dexscreener|pump\.fun|solscan|birdeye|gmgn|axiom|photon|bullx|jup\.ag|raydium|geckoterminal|dextools|etherscan|basescan|bscscan|rugcheck|four\.meme/i;
  const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

  // an OCR misread or a random word of base58 letters rarely decodes to exactly 32 bytes
  function solanaAddress(v) {
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v)) return false;
    let n = 0n, bytes = 0;
    for (const c of v) n = n * 58n + BigInt(B58.indexOf(c));
    while (n > 0n) { bytes++; n >>= 8n; }
    return bytes + (v.match(/^1*/) || [""])[0].length === 32;
  }
  const valid = v => EVM.test(v) || solanaAddress(v);

  async function getJSON(url) {
    for (let a = 0; a < 2; a++) {
      try {
        const r = await fetch(url, { credentials: "omit" });
        if (r.status === 429) { await new Promise(res => setTimeout(res, 2500)); continue; }
        if (!r.ok) throw new Error("HTTP " + r.status);
        return await r.json();
      } catch (e) { if (a) throw e; }
    }
    throw new Error("rate-limited");
  }

  function pageCandidates(pg) {
    const score = new Map();
    const bump = (str, pts) => { for (const id of new Set(String(str || "").match(ADDR) || [])) score.set(id, (score.get(id) || 0) + pts); };
    bump(pg.url, 100);
    for (const l of pg.links || []) bump(l, 12);
    bump(pg.title, 20);
    for (const id of String(pg.text || "").match(ADDR) || []) score.set(id, (score.get(id) || 0) + 1);
    return [...score.entries()].filter(([id]) => valid(id)).sort((x, y) => y[1] - x[1]).slice(0, 30).map(([id, pts]) => ({ id, pts }));
  }

  // an id can be the token itself or a pool (Axiom, Photon and DexScreener URLs show the pool); a wallet resolves to nothing
  async function resolveCandidates(cands) {
    const found = new Map();
    const keep = (p, pts) => {
      if (!p || !p.baseToken) return;
      const a = p.baseToken.address, liq = (p.liquidity || {}).usd || 0, old = found.get(a);
      if (!old || pts > old.pts || (pts === old.pts && liq > old.liq))
        found.set(a, { addr: a, symbol: p.baseToken.symbol, pts: Math.max(pts, old ? old.pts : 0), liq: Math.max(liq, old ? old.liq : 0),
          url: p.url, chain: p.chainId, pair: p });
    };
    const sol = cands.filter(c => !EVM.test(c.id)), evm = cands.filter(c => EVM.test(c.id)).slice(0, 4);
    const pts = id => (cands.find(c => c.id === id) || {}).pts || 0;
    if (sol.length) {
      const ids = sol.map(c => c.id).join(",");
      const [toks, pairs] = await Promise.all([
        getJSON(`https://api.dexscreener.com/tokens/v1/solana/${ids}`).catch(() => []),
        getJSON(`https://api.dexscreener.com/latest/dex/pairs/solana/${ids}`).catch(() => ({})),
      ]);
      for (const p of toks || []) keep(p, pts(p.baseToken.address));
      for (const p of (pairs && pairs.pairs) || []) keep(p, pts(p.pairAddress));
    }
    for (const c of evm) {
      try {
        const d = await getJSON(`https://api.dexscreener.com/latest/dex/search?q=${c.id}`);
        for (const p of d.pairs || []) if ([p.baseToken.address, p.pairAddress].some(x => x.toLowerCase() === c.id.toLowerCase())) keep(p, c.pts);
      } catch {}
    }
    return [...found.values()].sort((x, y) => y.pts - x.pts || y.liq - x.liq);
  }

  // read one tab the user pointed at (activeTab from the toolbar click); nothing on the page is changed
  async function readTab(tab) {
    const pg = { url: tab.url || "", title: tab.title || "", links: [], text: "" };
    try {
      const [r] = await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: false }, func: re => ({
        links: [...document.querySelectorAll("a[href]")].map(a => a.href).filter(h => new RegExp(re, "i").test(h)).slice(0, 300),
        text: (document.body ? document.body.innerText : "").slice(0, 300000), title: document.title,
      }), args: [COIN_LINK.source] });
      Object.assign(pg, r.result || {});
      pg.read = true;
    } catch { pg.read = false; }
    return pg;
  }

  async function fromActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab) return { list: [], read: false };
    const pg = await readTab(tab);
    return { list: await resolveCandidates(pageCandidates(pg)), read: pg.read, tab };
  }

  root.CoinFinder = { solanaAddress, valid, pageCandidates, resolveCandidates, readTab, fromActiveTab };
})(typeof window === "object" ? window : this);
