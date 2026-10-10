// Wallet finder (GitHub Actions, a few times a day). Read-only: public trades and balances, no wallet access.
// Method from the crbpite8 video (same as memecoin/tools/early.py): take recent pump.fun runners, list their first buyers,
// keep wallets that still trade and are not bots, and rank them by how many runners they were early in.
// usage: node paper/wallets.mjs <wallets.json>
import fs from "node:fs";

const OUT = process.argv[2];
const RPC = "https://solana-rpc.web.helium.io";
const FIRST = 25, MAX_RUNNERS = 6, ACTIVE_DAYS = 30, BOT_GAP_S = 5;
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function getJSON(url, body) {
  for (let a = 0; a < 4; a++) {
    const r = await fetch(url, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {}).catch(() => null);
    if (r && r.status === 429) { await sleep(2500 * (a + 1)); continue; }
    if (!r || !r.ok) throw new Error("HTTP " + (r ? r.status : "fail"));
    return r.json();
  }
  throw new Error("rate-limited");
}
const old = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : { wallets: [], runners: [] };

// 1) runners: pump.fun coins trending on GeckoTerminal, at least $1M market cap, under 30 days old
const runners = [];
for (const d of ["24h", "6h"]) {
  for (const page of [1, 2]) {
    try {
      const j = await getJSON(`https://api.geckoterminal.com/api/v2/networks/solana/trending_pools?duration=${d}&page=${page}`);
      for (const p of j.data) {
        const mint = p.relationships.base_token.data.id.slice(7), a = p.attributes;
        const mc = Number(a.market_cap_usd || a.fdv_usd || 0), ageD = (Date.now() - Date.parse(a.pool_created_at)) / 864e5;
        if (mint.endsWith("pump") && mc >= 1e6 && ageD <= 30 && !runners.some(r => r.mint === mint))
          runners.push({ mint, sym: (a.name || "").split(" / ")[0], mc: Math.round(mc) });
      }
    } catch {}
    await sleep(2500);
  }
}
runners.sort((x, y) => y.mc - x.mc);
const picked = runners.slice(0, MAX_RUNNERS);

// 2) first buyers of each runner (pump.fun trade history; the cursor is "<slot>-<ms>" and only the ms part matters)
async function firstBuyers(mint) {
  const coin = await getJSON(`https://frontend-api-v3.pump.fun/coins-v2/${mint}`);
  const created = coin.created_timestamp;
  if (!created) return [];
  let trades = [];
  for (let win = 5 * 60e3; win <= 6 * 3600e3; win *= 3) {
    let cur = `0-${Math.round(created + win)}`, page = [];
    for (let i = 0; i < 30; i++) {
      const d = await getJSON(`https://swap-api.pump.fun/v2/coins/${mint}/trades?limit=100&cursor=${cur}`);
      page.push(...(d.trades || []));
      if (!d.pagination || !d.pagination.hasMore || !d.pagination.nextCursor) break;
      cur = d.pagination.nextCursor;
    }
    trades = page;
    if (new Set(trades.filter(t => t.type === "buy").map(t => t.userAddress)).size >= FIRST) break;
  }
  const out = [];
  for (const t of trades.sort((a, b) => (a.slotIndexId < b.slotIndexId ? -1 : 1)))
    // buys in the launch's first 10 seconds are snipers or the dev's own bundle, not traders worth following
    if (t.type === "buy" && Date.parse(t.timestamp) - created >= 10e3 && !out.includes(t.userAddress) && t.userAddress !== coin.creator) out.push(t.userAddress);
  return out.slice(0, FIRST);
}
const early = new Map();   // wallet -> [runner symbols]
for (const r of picked) {
  try { for (const w of await firstBuyers(r.mint)) early.set(w, [...(early.get(w) || []), r.sym]); r.ok = true; }
  catch (e) { r.ok = false; r.err = e.message; }
}

// 3) keep wallets that traded in the last 30 days and are not bots (median gap between their last 50 txs ≥ 5 s)
async function activity(w) {
  const r = await getJSON(RPC, { jsonrpc: "2.0", id: 1, method: "getSignaturesForAddress", params: [w, { limit: 50 }] });
  const t = (r.result || []).map(s => s.blockTime).filter(Boolean);
  if (!t.length) return null;
  const gaps = t.slice(1).map((x, i) => t[i] - x).sort((a, b) => a - b);
  return { lastDays: (Date.now() / 1000 - t[0]) / 86400, gap: gaps.length ? gaps[gaps.length >> 1] : null };
}
const found = [];
for (const [w, syms] of early) {
  try {
    const a = await activity(w);
    await sleep(250);
    if (!a || a.lastDays > ACTIVE_DAYS || (a.gap != null && a.gap < BOT_GAP_S)) continue;
    found.push({ addr: w, runners: syms, hits: syms.length, lastActiveDays: +a.lastDays.toFixed(1), medianGapS: a.gap, seen: new Date().toISOString() });
  } catch {}
}

// 4) merge with earlier finds (a wallet early in several runners over time ranks higher), newest activity first
const byAddr = new Map(old.wallets.map(w => [w.addr, w]));
for (const w of found) {
  const prev = byAddr.get(w.addr);
  const runnersAll = [...new Set([...(prev ? prev.runners : []), ...w.runners])];
  byAddr.set(w.addr, { ...w, runners: runnersAll, hits: runnersAll.length, firstSeen: prev ? prev.firstSeen || prev.seen : w.seen });
}
const wallets = [...byAddr.values()]
  .filter(w => Date.now() - Date.parse(w.seen) < 14 * 864e5)
  .sort((x, y) => y.hits - x.hits || x.lastActiveDays - y.lastActiveDays)
  .slice(0, 40);
const out = { updated: new Date().toISOString(), method: "first 25 buyers of recent pump.fun runners (≥$1M, ≤30 days), still trading in the last 30 days, not bots",
  runners: picked, wallets };
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log(JSON.stringify({ runners: picked.map(r => `${r.sym}${r.ok ? "" : " (fail)"}`), checked: early.size, kept: found.length, total: wallets.length }));
