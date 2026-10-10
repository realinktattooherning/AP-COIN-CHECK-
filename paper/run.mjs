// Live paper trader (GitHub Actions, every ~20 min). Simulated only: no wallet, no orders, no real money.
// Scores coins with the website's own scanner (checker.js, run in a headless browser), so the paper trades follow
// exactly what the site shows. Positions are tracked on the SAME pool and base token they were opened on (Codex' audit rule):
// a missing pool is UNKNOWN, never silently replaced by another pool.
//
// usage: node paper/run.mjs <site-dir> <state.json>
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const [SITE, STATE] = process.argv.slice(2);
const RULES = {
  stake: 100,            // paper USD per position
  cost: 0.02,            // assumed round-trip cost (fees + slippage) taken off every closed trade
  minScore: 6,           // same bar as the radar list
  takeProfit: 1.0,       // +100 %
  stopLoss: -0.5,        // -50 %
  maxHoldH: 24,          // close at market after 24 h
  rugLiquidity: 1000,    // liquidity under $1K = liquidity pulled, closed at -100 %
  maxOpen: 10,
  maxScansPerRun: 6,
  runBudgetMs: 11 * 60e3,
};
const t0 = Date.now();
const now = () => new Date().toISOString();

const empty = { rules: RULES, started: now(), updated: null, open: [], closed: [], seen: {}, runs: 0, log: [] };
let st = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, "utf8")) : empty;
st.rules = RULES;

async function getJSON(url) {
  for (let a = 0; a < 3; a++) {
    const r = await fetch(url, { headers: { accept: "application/json" } }).catch(() => null);
    if (r && r.status === 429) { await new Promise(res => setTimeout(res, 3000 * (a + 1))); continue; }
    if (!r || !r.ok) throw new Error("HTTP " + (r ? r.status : "fail"));
    return r.json();
  }
  throw new Error("rate-limited");
}

// 1) mark open positions to market on their own pool
for (const pos of st.open) {
  try {
    const d = await getJSON(`https://api.dexscreener.com/latest/dex/pairs/${pos.chain}/${pos.pool}`);
    const p = (d.pairs || []).find(x => x.pairAddress === pos.pool && x.baseToken && x.baseToken.address === pos.mint);
    if (!p) { pos.status = "UNKNOWN"; pos.note = "pool not returned; not replaced by another pool"; continue; }
    pos.status = "OPEN"; pos.note = "";
    pos.price = Number(p.priceUsd); pos.liq = (p.liquidity || {}).usd ?? null; pos.mc = p.marketCap || p.fdv || null; pos.at = now();
    pos.ret = pos.price / pos.entry - 1;
    pos.peak = Math.max(pos.peak ?? 0, pos.ret);
  } catch (e) { pos.status = "UNKNOWN"; pos.note = "price lookup failed: " + e.message; }
}
const close = (pos, why, ret) => {
  const net = ret - RULES.cost;
  st.closed.unshift({ ...pos, exitAt: now(), exitWhy: why, ret, net, pnl: +(RULES.stake * net).toFixed(2) });
  st.log.unshift(`${now()} CLOSE $${pos.sym} ${why} ${(net * 100).toFixed(1)}%`);
};
st.open = st.open.filter(pos => {
  const ageH = (Date.now() - Date.parse(pos.openedAt)) / 3600e3;
  if (pos.status === "OPEN" && pos.liq != null && pos.liq < RULES.rugLiquidity) { close(pos, "liquidity pulled", -1); return false; }
  if (pos.status === "OPEN" && pos.ret >= RULES.takeProfit) { close(pos, "take profit +100%", pos.ret); return false; }
  if (pos.status === "OPEN" && pos.ret <= RULES.stopLoss) { close(pos, "stop loss -50%", pos.ret); return false; }
  if (ageH >= RULES.maxHoldH && pos.status === "OPEN") { close(pos, "24 h time limit", pos.ret); return false; }
  // a pool that stays unknown for a full day is written off rather than shown as open forever
  if (ageH >= RULES.maxHoldH + 6 && pos.status === "UNKNOWN") { close(pos, "pool unknown for 30 h (written off)", -1); return false; }
  return true;
});

// 2) find and score new coins with the website's scanner
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const page = await browser.newPage();
await page.route("https://site.local/**", r => {
  const f = path.join(SITE, new URL(r.request().url()).pathname);
  return fs.existsSync(f) ? r.fulfill({ path: f }) : r.fulfill({ status: 404, body: "" });
});
await page.addInitScript(() => { try { localStorage.setItem("radar-paused", "1"); } catch {} });
await page.goto("https://site.local/index.html");
await page.waitForFunction(() => typeof analyze === "function" && typeof radarPrefilter === "function");

// discovery: the radar's own feeds and screener
const fresh = await page.evaluate(async seen => {
  const found = new Set();
  for (const [, url, pick] of RADAR_FEEDS) { try { pick(await reqRaw(url, null, 2)).forEach(a => a && found.add(a)); } catch {} }
  const list = [...found].filter(a => !seen[a]);
  const out = [];
  for (let i = 0; i < list.length; i += 30) {
    let pairs = [];
    try { pairs = await reqRaw(`https://api.dexscreener.com/tokens/v1/solana/${list.slice(i, i + 30).join(",")}`, null, 2); } catch { continue; }
    for (const a of list.slice(i, i + 30)) {
      const own = pairs.filter(p => p.baseToken && p.baseToken.address === a);
      if (!own.length) { out.push({ a, skip: "no pool" }); continue; }
      const best = own.reduce((x, y) => (((y.liquidity || {}).usd || 0) > ((x.liquidity || {}).usd || 0) ? y : x));
      out.push({ a, skip: radarPrefilter(best) });
    }
  }
  return out;
}, st.seen);
for (const c of fresh) st.seen[c.a] = Date.now();
const queue = fresh.filter(c => !c.skip).map(c => c.a);
st.lastRun = { at: now(), found: fresh.length, passedScreener: queue.length, scanned: 0, entered: 0 };

for (const a of queue.slice(0, RULES.maxScansPerRun)) {
  if (Date.now() - t0 > RULES.runBudgetMs || st.open.length >= RULES.maxOpen) break;
  const r = await page.evaluate(async addr => {
    const res = await exclusive(() => analyze(addr, () => {}, () => {}));
    const { buy, reasons } = finalScore(res.rows);
    const p = res.pair || {};
    return { buy, reasons, sym: (p.baseToken || {}).symbol, chain: p.chainId, pool: p.pairAddress, price: Number(p.priceUsd),
      liq: (p.liquidity || {}).usd ?? null, mc: p.marketCap || p.fdv || null, url: p.url };
  }, a).catch(e => ({ error: e.message }));
  st.lastRun.scanned++;
  if (r.error || !r.pool || !(r.price > 0)) continue;
  st.log.unshift(`${now()} SCAN $${r.sym} ${r.buy}/10`);
  if (r.buy >= RULES.minScore && !st.open.some(p => p.mint === a)) {
    st.open.push({ mint: a, sym: r.sym, chain: r.chain, pool: r.pool, url: r.url, score: r.buy, why: r.reasons.slice(0, 3),
      entry: r.price, price: r.price, ret: 0, peak: 0, liq: r.liq, mc: r.mc, entryMc: r.mc, openedAt: now(), at: now(), status: "OPEN" });
    st.lastRun.entered++;
    st.log.unshift(`${now()} OPEN $${r.sym} at ${r.mc ? "$" + Math.round(r.mc / 1e3) + "K MC" : r.price} (score ${r.buy})`);
  }
}
await browser.close();

// 3) summary and housekeeping
const wins = st.closed.filter(c => c.net > 0).length;
const realized = st.closed.reduce((s, c) => s + c.pnl, 0);
const unreal = st.open.filter(p => p.status === "OPEN").reduce((s, p) => s + RULES.stake * p.ret, 0);
st.summary = { closed: st.closed.length, wins, losses: st.closed.length - wins, realized: +realized.toFixed(2), unrealized: +unreal.toFixed(2),
  open: st.open.length, invested: st.closed.length * RULES.stake + st.open.length * RULES.stake };
st.runs++; st.updated = now();
const weekAgo = Date.now() - 7 * 864e5;
for (const [k, v] of Object.entries(st.seen)) if (v < weekAgo) delete st.seen[k];
st.closed = st.closed.slice(0, 500);
st.log = st.log.slice(0, 200);
fs.writeFileSync(STATE, JSON.stringify(st, null, 1));
console.log(JSON.stringify({ ...st.lastRun, summary: st.summary }));
