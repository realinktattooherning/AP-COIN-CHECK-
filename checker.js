const RED = "RED", YEL = "YEL", GRN = "GRN", NA = "NA", SKIP = "SKIP";
// SKIP = rule does not apply to this coin (e.g. launch data too old); never counted as ok or as missing
const ICON = { RED: "🟥", YEL: "🟨", GRN: "🟩", NA: "⬜", SKIP: "➖" };
const gtPools = net => `https://api.geckoterminal.com/api/v2/networks/${net}/pools/`;
const GT = gtPools("solana");
// DexScreener chainId → GeckoTerminal network + GoPlus / honeypot.is chain id
const EVM = {
  ethereum: { gt: "eth", id: 1, name: "Ethereum" }, base: { gt: "base", id: 8453, name: "Base" }, bsc: { gt: "bsc", id: 56, name: "BSC" },
  arbitrum: { gt: "arbitrum", id: 42161, name: "Arbitrum" }, polygon: { gt: "polygon_pos", id: 137, name: "Polygon" },
  avalanche: { gt: "avax", id: 43114, name: "Avalanche" }, optimism: { gt: "optimism", id: 10, name: "Optimism" },
  linea: { gt: "linea", id: 59144, name: "Linea" }, sonic: { gt: "sonic", id: 146, name: "Sonic" },
  unichain: { gt: "unichain", id: 130, name: "Unichain" }, abstract: { gt: "abstract", id: 2741, name: "Abstract" },
  blast: { gt: "blast", id: 81457, name: "Blast" },
};
const HONEYPOT_IS = [1, 56, 8453];
const EVM_ADDR = /^0x[0-9a-fA-F]{40}$/;
const DEAD = /^0x(0{40}|0{36}dead)$/i;
const CTRL_LABEL = {
  owner_change_balance: "ejer kan ændre saldi", hidden_owner: "skjult ejer", transfer_pausable: "handel kan pauses",
  can_take_back_ownership: "ejerskab kan tages tilbage", is_blacklisted: "blacklist", slippage_modifiable: "skat kan ændres",
  personal_slippage_modifiable: "skat pr. wallet", trading_cooldown: "handels-cooldown", anti_whale_modifiable: "anti-whale kan ændres",
};
const JITO = new Set([
  "96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5", "HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe",
  "Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY", "ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49",
  "DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh", "ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt",
  "DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL", "3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT",
]);
const FEE_SAMPLE = 60;
const PUBLIC_RPCS = ["https://solana-rpc.publicnode.com", "https://api.mainnet-beta.solana.com"];
const MANUAL = [
  "V7/V13 hype + sentiment fra holders på X (link ovenfor)",
  "V11 forstår du memet",
  "V12 dev/team kan findes",
];
const HARD_NO = ["V4", "V5", "V14", "V15", "V16", "V17", "Mint", "Freeze", "Rugcheck: rugged", "Honeypot", "Salgs-skat"];

const $ = id => document.getElementById(id);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = s => { $("log").textContent += s + "\n"; };
const store = {
  get(k) { try { return localStorage.getItem(k) || ""; } catch { return ""; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};

let gtNext = 0;
const getCache = new Map();
// identical GETs within one check share one request (ATH and V5 both read the day candles)
function req(url, body, tries = 6) {
  if (body) return reqRaw(url, body, tries);
  if (!getCache.has(url)) getCache.set(url, reqRaw(url, null, tries).catch(e => { getCache.delete(url); throw e; }));
  return getCache.get(url);
}
async function reqRaw(url, body, tries = 6) {
  for (let a = 0; a < tries; a++) {
    if (url.startsWith("https://api.geckoterminal.com")) {
      // space GeckoTerminal calls out; bursts trip its rate limit
      const wait = gtNext - Date.now();
      gtNext = Math.max(Date.now(), gtNext) + 400;
      if (wait > 0) await sleep(wait);
    }
    let r;
    try {
      r = await fetch(url, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {});
    } catch (e) {
      // GeckoTerminal sends its 429 without CORS headers, so the browser reports a network error instead
      if (a < tries - 1) { await sleep(3000 * (a + 1)); continue; }
      throw new Error("blokeret/rate-limit");
    }
    // GeckoTerminal free tier ≈30 calls/min, public RPC is also throttled
    if (r.status === 429 && a < tries - 1) { await sleep(3000 * (a + 1)); continue; }
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  }
}

function fmt(n) {
  if (n == null) return "?";
  n = Number(n);
  if (Math.abs(n) >= 1e6) return "$" + (n / 1e6).toFixed(1) + "M";
  if (Math.abs(n) >= 1e3) return "$" + (n / 1e3).toFixed(1) + "K";
  return "$" + n.toFixed(0);
}
const f1 = x => Number(x).toFixed(1);

function bestPair(dex, addr) {
  const all = (dex && dex.pairs) || [];
  // the tokens endpoint also lists pairs where the coin is the quote side
  const own = all.filter(p => ((p.baseToken || {}).address || "").toLowerCase() === addr.toLowerCase());
  const pairs = own.length ? own : all;
  const liq = p => (p.liquidity || {}).usd || 0, tx = p => { const t = (p.txns || {}).h24 || {}; return (t.buys || 0) + (t.sells || 0); };
  // a real pool has ≥ $1K liquidity; when none does (bonding curve, or a coin paired with a token DexScreener
  // cannot price), the pool with the most trades is the coin — never a $2 dust pool that happens to have a USD value
  const real = pairs.filter(p => liq(p) >= 1000);
  if (real.length) return real.reduce((b, p) => (liq(p) > liq(b) ? p : b));
  return pairs.reduce((b, p) => (tx(p) > tx(b) ? p : b), pairs[0] || {});
}

function holdersExPools(rc) {
  const known = rc.knownAccounts || {};
  return (rc.topHolders || []).filter(h => !(h.owner in known) && !(h.address in known));
}

function largestEqualCluster(pcts) {
  // bundles show near-identical balances (1.48/1.47/1.47/1.47); a smooth natural tail must not count
  pcts = [...pcts].sort((a, b) => b - a);
  let best = [];
  pcts.forEach((p, i) => {
    const tol = Math.max(0.005, 0.02 * p);
    const group = pcts.slice(i).filter(q => p - q <= tol);
    if (group.length > best.length) best = group;
  });
  return best;
}

// bundles buy big, near-identical bags (reel: 1.48/1.47/1.47/1.47 %); around 1 % a coin with thousands of holders
// naturally has several near-equal wallets, so small clusters only warn
function bundleLevel(cl) {
  const n = cl.length, p = n ? cl[0] : 0;
  return (n >= 4 && p >= 1.3) || n >= 6 ? RED : n >= 4 || (n === 3 && p >= 1.3) ? YEL : GRN;
}

// launch curves on every Solana launchpad (DexScreener and GeckoTerminal spellings): no LP, not graduated
const CURVE = /pump-?fun$|dbc|launchlab|moonshot|boop/i;
const isCurve = pair => CURVE.test(pair.dexId || "");

// GeckoTerminal pool → the DexScreener pair shape the checks read. Used when DexScreener does not know the coin yet
// (brand-new LaunchLab/Bonk coins) or has no USD figures for its main pool (coin paired with cbBTC, another memecoin …)
function gtPair(p) {
  const a = p.attributes, [base, quote] = (a.name || "").split(" / ");
  const t = k => ({ buys: ((a.transactions || {})[k] || {}).buys || 0, sells: ((a.transactions || {})[k] || {}).sells || 0 });
  const v = a.volume_usd || {}, pc = a.price_change_percentage || {};
  const dexId = { "pump-fun": "pumpfun", "meteora-dbc": "meteoradbc", "raydium-launchlab": "launchlab" }[p.relationships.dex.data.id] || p.relationships.dex.data.id;
  return {
    chainId: "solana", dexId, pairAddress: a.address, url: `https://www.geckoterminal.com/solana/pools/${a.address}`,
    baseToken: { symbol: base }, quoteToken: { symbol: (quote || "").split(" ")[0] },
    marketCap: Number(a.market_cap_usd || a.fdv_usd) || undefined, priceUsd: a.base_token_price_usd,
    liquidity: { usd: Number(a.reserve_in_usd) || 0 },
    volume: { h24: Number(v.h24) || 0, h6: Number(v.h6) || 0, h1: Number(v.h1) || 0, m5: Number(v.m5) || 0 },
    txns: { h24: t("h24"), h6: t("h6"), h1: t("h1"), m5: t("m5") },
    priceChange: { m5: pc.m5, h1: pc.h1, h6: pc.h6, h24: pc.h24 },
    pairCreatedAt: Date.parse(a.pool_created_at), source: "GeckoTerminal",
  };
}

async function gtFallback(addr, pair) {
  // DexScreener has no pair, or no USD figures for it: take GeckoTerminal's real pool (≥ $1K reserve, else most trades)
  if (pair.pairAddress && (pair.marketCap || pair.fdv)) return pair;
  let pools;
  try { pools = ownPools(await req(`https://api.geckoterminal.com/api/v2/networks/solana/tokens/${addr}/pools?page=1`), addr); } catch { return pair; }
  if (!pools.length) return pair;
  const res = p => Number(p.attributes.reserve_in_usd) || 0;
  const tx = p => { const t = (p.attributes.transactions || {}).h24 || {}; return (t.buys || 0) + (t.sells || 0); };
  const real = pools.filter(p => res(p) >= 1000);
  const best = real.length ? real.reduce((b, p) => (res(p) > res(b) ? p : b)) : pools.reduce((b, p) => (tx(p) > tx(b) ? p : b));
  if (pair.pairAddress && !real.length) return pair; // only dust on GeckoTerminal too: keep DexScreener's main pool (shown as unknown)
  const g = gtPair(best);
  // keep DexScreener's socials if it had the coin
  return pair.pairAddress ? { ...g, info: pair.info, url: pair.url } : g;
}

function baseChecks(rc, pair, add, chain = "solana") {
  const mc = pair.marketCap || pair.fdv;
  const vol = pair.volume || {}, txns = pair.txns || {};
  if (rc) {
    if (rc.rugged) add("Rugcheck: rugged", RED, "JA", "rugcheck markerer token som rugget");
    const top = holdersExPools(rc);
    const top10 = top.slice(0, 10).reduce((s, h) => s + (h.pct || 0), 0);
    add("V14 top 10 holders ≤ 30 %", top10 > 30 ? RED : GRN, f1(top10) + " %", "ekskl. pools/kendte konti");
    const cl = largestEqualCluster(top.slice(0, 20).map(h => h.pct || 0).filter(p => p >= 0.3));
    add("V2 ens holder-balancer (bundle)", bundleLevel(cl),
      cl.length >= 2 ? `${cl.length} wallets ~${cl[0].toFixed(2)} %` : "ingen", "rødt: ≥4 ens på ≥1,3 % eller ≥6 ens");
    // share of supply held by Rugcheck's linked-wallet networks; the raw wallet count grows with any big holder base
    const supply0 = (rc.token || {}).supply || 0, nets = rc.insiderNetworks || [];
    const insPct = supply0 ? nets.reduce((s, n) => s + (n.tokenAmount || 0), 0) / supply0 * 100 : 0;
    const flagged = top.filter(h => h.insider).length;
    add("V8 insider-wallets", insPct >= 20 || flagged >= 3 ? RED : insPct >= 8 || flagged ? YEL : GRN,
      `${f1(insPct)} % af supply i ${nets.length} netværk, ${flagged} top-holders flaget`, "rødt ≥20 % af supply, gult ≥8 %");
    add("Mint authority revoked", rc.mintAuthority ? RED : GRN, rc.mintAuthority ? "aktiv" : "revoked");
    add("Freeze authority revoked", rc.freezeAuthority ? RED : GRN, rc.freezeAuthority ? "aktiv" : "revoked");
    const locked = Math.max(0, ...(rc.markets || []).map(m => (m.lp || {}).lpLockedPct || 0));
    if (isCurve(pair)) add("LP låst/brændt", SKIP, "bonding curve, ingen LP endnu", "V4 graduated dækker det");
    else add("LP låst/brændt", locked >= 90 ? GRN : locked >= 50 ? YEL : RED, locked.toFixed(0) + " %",
      "pump.fun/pumpswap-pools kan vise lavt selv om LP er brændt — tjek manuelt hvis rødt");
    const cb = rc.creatorBalance || 0, supply = (rc.token || {}).supply || 0;
    if (supply) {
      const share = cb / supply * 100;
      // compare at the shown precision: a launchpad's fixed 5.0 % creator allocation is a warning, not over the line
      add("Dev/creator andel", share >= 5.05 ? RED : share > 1 ? YEL : GRN, f1(share) + " %");
    }
    const danger = (rc.risks || []).filter(r => r.level === "danger").map(r => r.name);
    const warn = (rc.risks || []).filter(r => r.level === "warn").map(r => r.name);
    add("Rugcheck risici", danger.length ? RED : warn.length ? YEL : GRN, [...danger, ...warn].join(", ") || "ingen",
      "score " + (rc.score_normalised ?? rc.score));
  } else if (chain === "solana") {
    add("Rugcheck-data", NA, "mangler", "V2, V8, V14, authorities, LP kunne ikke tjekkes");
  }
  if (pair.pairAddress) {
    const dexId = pair.dexId || "?";
    if (chain === "solana") add("V4 graduated", isCurve(pair) ? RED : GRN, dexId, "bonding curve (pump.fun, Meteora DBC, LaunchLab, Moonshot) = ikke graduated");
    // the main pool can trade against a token with no USD price (e.g. another memecoin): then MC/volume/liquidity are unknown
    const noUsd = mc == null ? `ingen dollarpris: hovedpoolen handler mod ${(pair.quoteToken || {}).symbol || "?"}` : "";
    add("V4 market cap ≥ $50-60K", mc == null ? NA : mc < 50000 ? RED : GRN, fmt(mc), noUsd || "sweet spot $50K-200K");
    // the reel's case was MC 18× volume; a few percent either way is noise in both numbers
    add("V15 market cap ≤ 24h-volumen", mc == null ? NA : mc > 1.5 * (vol.h24 || 0) ? RED : mc > (vol.h24 || 0) ? YEL : GRN,
      `MC ${fmt(mc)} / vol ${fmt(vol.h24)}`, noUsd || "rødt når MC er over 1,5× volumen");
    const h24 = txns.h24 || {};
    // judge the shortest window with ≥20 trades: "0 buys / 1 sell" in the last hour says nothing
    const win = ["h1", "h6", "h24"].find(k => ((txns[k] || {}).buys || 0) + ((txns[k] || {}).sells || 0) >= 20);
    if (win) {
      const b1 = txns[win].buys || 0, s1 = txns[win].sells || 0;
      // reel case: 20 buyers vs 35 sellers (1.75×); a few more sells than buys is normal profit-taking
      add("V16 købere ≥ sælgere (1h)", s1 > b1 * 1.5 ? RED : s1 > b1 ? YEL : GRN,
        `${win.slice(1)}t ${b1}/${s1}, 24h ${h24.buys ?? "?"}/${h24.sells ?? "?"} (køb/salg)`,
        "rødt ved >50 % flere salg; korteste vindue med ≥20 handler; antal handler, ikke unikke wallets");
    } else add("V16 købere ≥ sælgere (1h)", SKIP, "under 20 handler på 24h", "for lidt handel til at sige noget");
    add("V17 beskrivelse/socials/website", NA, "?", "");
    const age = pair.pairCreatedAt ? (Date.now() - pair.pairCreatedAt) / 3600000 : null;
    add("V10 alder ≤ 1 døgn", age == null ? NA : age > 24 ? YEL : GRN, age == null ? "?" : f1(age) + " t");
    const liq = (pair.liquidity || {}).usd, ratio = liq && mc ? liq / mc * 100 : null;
    if (ratio == null && isCurve(pair)) add("Likviditet ift. MC", SKIP, "bonding curve, ingen pool endnu", "V4 graduated dækker det");
    // DexScreener reporting exactly $0 is a finding (empty or fake pool), not missing data
    else if (liq === 0 && mc) add("Likviditet ift. MC", RED, "$0", "poolen har ingen likviditet");
    else add("Likviditet ift. MC", ratio == null ? NA : ratio < 5 ? RED : ratio < 10 ? YEL : GRN,
      ratio == null ? fmt(liq) : `${fmt(liq)} (${f1(ratio)} % af MC)`, ratio == null ? noUsd : "");
    const pc = pair.priceChange || {};
    add("V9 momentum (info)", NA, `pris 5m ${pc.m5 ?? "?"}% · 1h ${pc.h1 ?? "?"}% · 24h ${pc.h24 ?? "?"}% · vol 5m ${fmt(vol.m5)}`);
  } else {
    add("DexScreener-data", NA, "mangler", "V4, V9, V10, V15, V16, V17 kunne ikke tjekkes");
  }
}

const IPFS_GATEWAYS = ["https://gateway.pinata.cloud/ipfs/", "https://ipfs.filebase.io/ipfs/", "https://4everland.io/ipfs/"];

// the coin's own metadata JSON (pump.fun-style: description, twitter, website, telegram); ipfs.io refuses scripts,
// so IPFS links go through other public gateways that allow browsers
// metadata hosts the extension may read (manifest host_permissions); unknown hosts are skipped in the extension so
// Chrome does not log a CORS error, and the description still comes from Rugcheck
const META_HOSTS = ["metadata.j7tracker.io", "gateway.irys.xyz", "meta.uxento.io", "www.agencypad.fun", "launch.mosaicfi.xyz", "arweave.net"];

async function tokenMetadata(uri) {
  const m = String(uri || "").match(/\/ipfs\/([A-Za-z0-9]+)/);
  let host = "";
  try { host = new URL(uri).hostname; } catch {}
  if (!m && typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id && !META_HOSTS.includes(host)) return null;
  for (const url of m ? IPFS_GATEWAYS.map(g => g + m[1]) : uri ? [uri] : []) {
    try { const d = await req(url, null, 1); if (d && typeof d === "object") return d; } catch {}
  }
  return null;
}

async function links(mint, pair, rc) {
  // socials + description from DexScreener, pump.fun (blocked on the website, works in the extension),
  // the coin's own metadata and Rugcheck
  const info = pair.info || {};
  const L = { twitter: null, website: null, telegram: null, pump: null, description: "", sources: [] };
  for (const s of info.socials || []) if (s.type in L && !L[s.type]) L[s.type] = s.url;
  if ((info.websites || []).length) L.website = info.websites[0].url;
  if (pair.info) L.sources.push("DexScreener");
  const [pf, meta] = await Promise.all([
    req(`https://frontend-api-v3.pump.fun/coins-v2/${mint}`, null, 1).catch(() => null),
    tokenMetadata(((rc || {}).tokenMeta || {}).uri),
  ]);
  if (pf) {
    for (const k of ["twitter", "website", "telegram"]) L[k] = L[k] || pf[k];
    L.description = L.description || String(pf.description || "").trim();
    L.pump = pf; L.sources.push("pump.fun");
  } else L.pumpError = true;
  if (meta) {
    for (const k of ["twitter", "website", "telegram"]) L[k] = L[k] || meta[k] || null;
    L.description = L.description || String(meta.description || "").trim();
    L.sources.push("metadata");
  }
  if (rc && rc.fileMeta) { L.description = L.description || String(rc.fileMeta.description || "").trim(); L.sources.push("Rugcheck"); }
  L.twitterIsPost = /\/status\/|\/search/.test(L.twitter || "");
  return L;
}

async function launchPool(mint, dex, best) {
  // The pump.fun bonding-curve pool holds the real launch candles; DexScreener drops it after migration, GeckoTerminal keeps it
  try {
    const d = await req(`https://api.geckoterminal.com/api/v2/networks/solana/tokens/${mint}/pools?page=1`);
    const pools = ownPools(d, mint);
    const pf = pools.find(p => p.relationships.dex.data.id === "pump-fun");
    const ids = pools.map(p => p.attributes.address);
    if (pf) return { pool: { pairAddress: pf.attributes.address, dexId: "pumpfun", pairCreatedAt: Date.parse(pf.attributes.pool_created_at) }, ids };
    // not a pump.fun coin (Meteora, LaunchLab, Bonk …): its earliest pool is the launch
    if (pools.length) {
      const first = pools.reduce((a, b) => (Date.parse(b.attributes.pool_created_at) < Date.parse(a.attributes.pool_created_at) ? b : a));
      return { pool: { pairAddress: first.attributes.address, dexId: first.relationships.dex.data.id, pairCreatedAt: Date.parse(first.attributes.pool_created_at), launch: true }, ids };
    }
    return { pool: ((dex && dex.pairs) || []).find(p => p.dexId === "pumpfun") || best, ids };
  } catch {
    return { pool: ((dex && dex.pairs) || []).find(p => p.dexId === "pumpfun") || best, ids: [] };
  }
}

const median = a => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

async function poolCandles(pool, net) {
  let url = `${gtPools(net)}${pool.pairAddress}/ohlcv/minute?aggregate=1&limit=1000`;
  const created = pool.pairCreatedAt;
  if (created) url += `&before_timestamp=${Math.floor(created / 1000) + 1000 * 60}`;
  const c = (await req(url)).data.attributes.ohlcv_list.sort((a, b) => a[0] - b[0]);
  return created ? c.filter(x => x[0] >= created / 1000 - 60) : c;
}

const MIN_CANDLES = 10;

async function candleChecks(pool, add, net = "solana", main = null) {
  let c;
  const created = pool.pairCreatedAt;
  try {
    c = await poolCandles(pool, net);
    // a launch pool that graduated within seconds (Meteora DBC, fast pump.fun runs) holds only a minute or two:
    // judge the launch on the main pool instead, else "100 % of volume in minute 1" is guaranteed
    if (c.length < MIN_CANDLES && main && main.pairAddress && main.pairAddress !== pool.pairAddress) {
      const c2 = await poolCandles(main, net);
      if (c2.length > c.length) { c = c2; pool = { pairAddress: main.pairAddress, dexId: main.dexId, pairCreatedAt: main.pairCreatedAt, launch: true }; }
    }
  } catch (e) {
    // GeckoTerminal's free API has no minute candles older than ~6 months (401); launch-bundle rules are for new coins anyway
    if (/401/.test(e.message) && created && Date.now() - created > 150 * 864e5) {
      add("V1 første candle (bundle ved launch)", SKIP, "launch for gammel til gratis candle-data", "reglen gælder nye coins");
      add("V6 én wick til himlen", SKIP, "launch for gammel til gratis candle-data", "reglen gælder nye coins");
      return;
    }
    add("V1 første candle (bundle ved launch)", NA, "fejl: " + String(e.message).slice(0, 40));
    add("V6 én wick til himlen", NA, "ingen candles");
    return;
  }
  if (c.length < MIN_CANDLES) {
    // a fresh coin will get there in minutes; an older one with this little trading never will
    if (pool.pairCreatedAt && Date.now() - pool.pairCreatedAt > 30 * 60000) {
      const why = `for lidt handel: kun ${c.length} min med handler`;
      add("V1 første candle (bundle ved launch)", SKIP, why, "kan ikke vurderes");
      add("V6 én wick til himlen", SKIP, why, "kan ikke vurderes");
      return;
    }
    const why = `for ny: kun ${c.length} min handel`;
    add("V1 første candle (bundle ved launch)", NA, why, `kræver ${MIN_CANDLES} min — tjek igen om lidt`);
    add("V6 én wick til himlen", NA, why, `kræver ${MIN_CANDLES} min — tjek igen om lidt`);
    return;
  }
  const vols = c.map(x => x[5]);
  const share = c[0][5] / (vols.reduce((s, v) => s + v, 0) || 1);
  const vsMed = c.length > 5 ? c[0][5] / (median(vols.slice(1, 31)) || 1) : null;
  if (pool.dexId !== "pumpfun" && !pool.launch) {
    add("V1 første candle (bundle ved launch)", NA, "launch-pool ikke fundet",
      "GeckoTerminal svarede ikke med coinens pools — prøv igen om et minut");
  } else {
    const bad = share >= 0.3 || (vsMed || 0) >= 20, warn = share >= 0.15 || (vsMed || 0) >= 10;
    add("V1 første candle (bundle ved launch)", bad ? RED : warn ? YEL : GRN,
      `${(share * 100).toFixed(0)} % af al volumen i 1. minut` + (vsMed ? `, ${vsMed.toFixed(0)}× median` : ""),
      `pool ${pool.dexId}, 1m-candles (1s kræver betalt API)`);
  }
  const tops = c.map(x => Math.max(x[1], x[4])).sort((a, b) => b - a);
  const w = c.reduce((b, x) => (x[2] / (Math.max(x[1], x[4]) || 1) > b[2] / (Math.max(b[1], b[4]) || 1) ? x : b), c[0]);
  const wick = w[2] / (Math.max(w[1], w[4]) || 1);
  // 6th-highest body top as reference: one absurd pool-init candle must not hide a real spike wick
  const above = w[2] / (tops[Math.min(5, tops.length - 1)] || 1);
  add("V6 én wick til himlen", wick >= 3 && above >= 2 ? RED : wick >= 2 && above >= 1.5 ? YEL : GRN,
    `største wick ${f1(wick)}× over candle-krop, ${above.toFixed(2)}× over chartets top-niveau`);
}

async function tradeChecks(best, holders, add, net = "solana") {
  let tr;
  try { tr = (await req(`${gtPools(net)}${best.pairAddress}/trades`)).data.map(t => t.attributes); }
  catch (e) { add("V3 sell-bots der spejler køb", NA, "fejl: " + String(e.message).slice(0, 40)); return []; }
  tr.sort((a, b) => (a.block_timestamp < b.block_timestamp ? -1 : 1));
  const used = new Set(), sellers = new Set();
  let mirrors = 0;
  const buys = tr.map((t, i) => i).filter(i => tr[i].kind === "buy" && Number(tr[i].volume_in_usd || 0) >= 5);
  for (const i of buys) {
    const b = tr[i], bu = Number(b.volume_in_usd);
    for (let j = i + 1; j < Math.min(i + 5, tr.length); j++) {
      const s = tr[j];
      if (used.has(j) || s.kind !== "sell" || s.tx_from_address === b.tx_from_address) continue;
      if (Math.abs(Number(s.volume_in_usd || 0) - bu) <= Math.max(0.02 * bu, 0.5)) {
        mirrors++; used.add(j); sellers.add(s.tx_from_address); break;
      }
    }
  }
  const ratio = buys.length ? mirrors / buys.length : 0;
  const big = [...sellers].filter(s => holders.has(String(s).toLowerCase())).length;
  add("V3 sell-bots der spejler køb", mirrors >= 5 && ratio >= 0.1 ? RED : mirrors >= 3 ? YEL : GRN,
    `${mirrors} spejlede salg på ${buys.length} køb (${(ratio * 100).toFixed(0)} %), ${sellers.size} sælger-wallets, ${big} af dem top-holders`,
    `seneste ${tr.length} handler`);
  return tr;
}

async function txFee(t, rpcs) {
  const body = { jsonrpc: "2.0", id: 1, method: "getTransaction",
    params: [t.tx_hash, { encoding: "jsonParsed", maxSupportedTransactionVersion: 1 }] };
  let res = null, err = "";
  // own key first, then keyless public RPCs; one dead endpoint must not leave V5 unscanned
  for (const u of rpcs) {
    try { res = (await req(u, body, 2)).result; } catch (e) { err = e.message; }
    if (res) break;
  }
  if (!res) return { err };
  const meta = res.meta, msg = res.transaction.message;
  const ins = [...(msg.instructions || []), ...(meta.innerInstructions || []).flatMap(g => g.instructions)];
  const tips = ins.filter(i => i.parsed && typeof i.parsed === "object" && i.parsed.type === "transfer" && JITO.has(i.parsed.info.destination))
    .reduce((s, i) => s + (i.parsed.info.lamports || 0), 0);
  return { fee: (meta.fee || 0) + tips };
}

async function lifetimeVolume(mint) {
  // USD volume since launch: daily candles summed over the coin's own pools (launch pool first)
  try {
    const pools = ownPools(await req(`https://api.geckoterminal.com/api/v2/networks/solana/tokens/${mint}/pools?page=1`), mint)
      .sort((a, b) => (a.relationships.dex.data.id !== "pump-fun") - (b.relationships.dex.data.id !== "pump-fun")
        || Number(b.attributes.reserve_in_usd || 0) - Number(a.attributes.reserve_in_usd || 0));
    let total = 0, ok = false;
    for (const p of pools.slice(0, 4)) {
      try { total += (await req(`${GT}${p.attributes.address}/ohlcv/day?limit=1000`)).data.attributes.ohlcv_list.reduce((s, x) => s + x[5], 0); ok = true; } catch {}
    }
    return ok ? total : null;
  } catch { return null; }
}

// Total fees over the coin's life (the "Total fees" Axiom/pump.fun show): fee per trade from trades spread over the
// recent history × 24h trade count, scaled by volume since launch / 24h volume (24h alone undercounts older coins).
// Per trade, not per $, so a dead coin's dust trades cannot inflate it.
async function feeCheck(tr, best, rpcs, add, mint) {
  if (!tr.length) { add("V5 total fees ≥ 2 SOL", NA, "ingen handler"); return; }
  const step = Math.max(1, Math.floor(tr.length / FEE_SAMPLE));
  const sample = tr.filter((_, i) => i % step === 0).slice(0, FEE_SAMPLE);
  const fees = [];
  let lastErr = "";
  for (let i = 0; i < sample.length; i += 5) {
    for (const r of await Promise.all(sample.slice(i, i + 5).map(t => txFee(t, rpcs)))) r.fee != null ? fees.push(r.fee) : (lastErr = r.err);
  }
  if (!fees.length) {
    add("V5 total fees ≥ 2 SOL", NA, "Solana RPC svarede ikke" + (lastErr ? ` (${lastErr})` : ""), "alle RPC'er afviste — prøv igen om et minut");
    return;
  }
  const t24 = (best.txns || {}).h24 || {};
  const tx24 = (t24.buys || 0) + (t24.sells || 0);
  const avg = fees.reduce((s, f) => s + f, 0) / fees.length / 1e9;
  const est24 = avg * tx24, vol24 = (best.volume || {}).h24 || 0;
  const life = await lifetimeVolume(mint);
  const scale = life && vol24 ? Math.max(1, life / vol24) : 1;
  const est = est24 * scale;
  add("V5 total fees ≥ 2 SOL", est < 1 ? RED : est < 2 ? YEL : GRN,
    `~${est.toFixed(2)} SOL i alt (~${est24.toFixed(2)} SOL sidste 24h: ${(avg * 1000).toFixed(2)} mSOL × ${tx24} handler` + (scale > 1.05 ? `; ${scale.toFixed(1)}× volumen siden launch)` : ")"),
    `estimat: gas + Jito-tips fra ${fees.length} handler spredt over de seneste ${tr.length}`);
}

async function athRow(pair, poolIds, L, net = "solana") {
  const pf = L.pump;
  // pump.fun's ATH is garbage on some old coins (Fartcoin: $428B); a 1000× drop is not a real reading
  if (pf && pf.ath_market_cap && pf.usd_market_cap && pf.ath_market_cap <= 1000 * pf.usd_market_cap) return { ath: pf.ath_market_cap, now: pf.usd_market_cap };
  // fallback: highest daily USD price across the token's pools × current supply factor
  const mc = pair.marketCap || pair.fdv, price = Number(pair.priceUsd);
  if (!mc || !price) return null;
  let hi = 0;
  for (const id of poolIds.slice(0, 2)) {
    try {
      // a thin pool's init candle can print an absurd price; drop highs over 50× the pool's median close
      const d = (await req(`${gtPools(net)}${id}/ohlcv/day?limit=1000`)).data.attributes.ohlcv_list;
      const med = median(d.map(x => x[4]));
      hi = Math.max(hi, ...d.map(x => x[2]).filter(h => !med || h <= 50 * med));
    } catch {}
  }
  const ath = Math.max(hi * mc / price, mc);
  return hi && ath <= 1000 * mc ? { ath, now: mc } : null;
}

// GeckoTerminal prices a pool's candles in its base token; a pool where our coin is the quote side shows the other coin's price
const ownPools = (d, addr) => (d.data || []).filter(p => p.relationships.base_token.data.id.toLowerCase().endsWith("_" + addr.toLowerCase()));

async function evmLaunch(addr, net) {
  // earliest pool = launch; its first minutes show a launch bundle the same way pump.fun candles do
  try {
    const pools = ownPools(await req(`https://api.geckoterminal.com/api/v2/networks/${net}/tokens/${addr}/pools?page=1`), addr)
      .map(p => ({ pairAddress: p.attributes.address, dexId: p.relationships.dex.data.id, pairCreatedAt: Date.parse(p.attributes.pool_created_at), launch: true }));
    if (!pools.length) return { pool: null, ids: [] };
    const first = pools.reduce((a, b) => (b.pairCreatedAt < a.pairCreatedAt ? b : a));
    return { pool: first, ids: pools.map(p => p.pairAddress) };
  } catch { return { pool: null, ids: [] }; }
}

async function evmChecks(addr, c, add) {
  // honeypot.is simulates a real buy + sell; GoPlus reads the contract's owner powers and holders
  const [gpR, hp] = await Promise.all([
    req(`https://api.gopluslabs.io/api/v1/token_security/${c.id}?contract_addresses=${addr}`, null, 2).catch(() => null),
    HONEYPOT_IS.includes(c.id) ? req(`https://api.honeypot.is/v2/IsHoneypot?address=${addr}&chainID=${c.id}`, null, 2).catch(() => null) : null,
  ]);
  const gp = gpR && gpR.result ? (gpR.result[addr.toLowerCase()] || Object.values(gpR.result)[0] || null) : null;
  const on = k => !!gp && String(gp[k]) === "1";
  const sim = !!(hp && hp.simulationSuccess);
  const honey = (sim && hp.honeypotResult && hp.honeypotResult.isHoneypot) || on("is_honeypot") || on("cannot_sell_all");
  if (!sim && !gp) add("Honeypot: kan du sælge?", NA, "ingen svar fra honeypot.is/GoPlus", "prøv igen om et minut");
  else add("Honeypot: kan du sælge?", honey ? RED : GRN, honey ? "NEJ — honeypot" : "ja", sim ? "simuleret køb + salg (honeypot.is)" : "GoPlus kontrakt-analyse");
  const pct = v => (v === "" || v == null ? null : Number(v) * 100);
  const bt = sim ? hp.simulationResult.buyTax : pct(gp && gp.buy_tax);
  const st = sim ? hp.simulationResult.sellTax : pct(gp && gp.sell_tax);
  add("Salgs-skat ≤ 10 %", st == null ? NA : st > 10 ? RED : st > 5 || (bt || 0) > 10 ? YEL : GRN,
    st == null ? "ukendt" : `køb ${f1(bt || 0)} % · salg ${f1(st)} %`, "over 10 % i salgs-skat = du mister for meget ved salg");
  const siph = sim && hp.holderAnalysis ? Number(hp.holderAnalysis.siphoned || 0) : 0;
  if (siph) add("Tokens trukket fra holders", RED, `${siph} wallets tømt`, "honeypot.is: dev kan tage tokens fra holders");
  if (!gp) {
    add("GoPlus-data", NA, "mangler", "mint, pause/blacklist, holders og LP kunne ikke tjekkes");
    return new Set();
  }
  add("Mint-funktion slået fra", on("is_mintable") ? RED : GRN, on("is_mintable") ? "dev kan printe flere" : "ja");
  const hard = ["owner_change_balance", "hidden_owner", "transfer_pausable", "can_take_back_ownership"].filter(on);
  const soft = ["is_blacklisted", "slippage_modifiable", "personal_slippage_modifiable", "trading_cooldown", "anti_whale_modifiable"].filter(on);
  add("Freeze: pause/blacklist/ejer-magt", hard.length ? RED : soft.length ? YEL : GRN, [...hard, ...soft].map(k => CTRL_LABEL[k]).join(", ") || "ingen",
    "rødt = dev kan fryse eller tage dine tokens");
  const open = String(gp.is_open_source) === "1";
  add("Kontrakt verificeret", !open ? RED : on("is_proxy") ? YEL : GRN, !open ? "kildekode skjult" : on("is_proxy") ? "proxy (kan udskiftes)" : "open source");
  if (on("honeypot_with_same_creator")) add("Dev har lavet honeypots før", RED, "ja", "GoPlus");
  const hs = (gp.holders || []).filter(h => !Number(h.is_contract) && !Number(h.is_locked) && !DEAD.test(h.address));
  const top10 = hs.slice(0, 10).reduce((s, h) => s + Number(h.percent) * 100, 0);
  add("V14 top 10 holders ≤ 30 %", top10 > 30 ? RED : GRN, f1(top10) + " %", "ekskl. pools, lockers og kontrakter (GoPlus)");
  const cl = largestEqualCluster(hs.map(h => Number(h.percent) * 100).filter(p => p >= 0.3));
  add("V2 ens holder-balancer (bundle)", bundleLevel(cl),
    cl.length >= 2 ? `${cl.length} wallets ~${cl[0].toFixed(2)} %` : "ingen", "rødt: ≥4 ens på ≥1,3 % eller ≥6 ens");
  const lp = gp.lp_holders || [];
  const locked = lp.filter(h => Number(h.is_locked) || DEAD.test(h.address)).reduce((s, h) => s + Number(h.percent) * 100, 0);
  add("LP låst/brændt", !lp.length ? YEL : locked >= 90 ? GRN : locked >= 50 ? YEL : RED, lp.length ? f1(locked) + " %" : "ingen LP-data",
    lp.length ? "" : "Uniswap V3/V4-pools har ingen LP-tokens; se locker på DexScreener");
  const dev = Math.max(Number(gp.creator_percent) || 0, Number(gp.owner_percent) || 0) * 100;
  add("Dev/creator andel", dev > 5 ? RED : dev > 1 ? YEL : GRN, f1(dev) + " %");
  return new Set((gp.holders || []).map(h => h.address.toLowerCase()));
}

function athFrom(a, rows) {
  if (!a) return;
  const dd = 1 - a.now / a.ath;
  const i9 = rows.findIndex(r => r.rule.startsWith("V9 momentum"));
  rows.splice(i9 + 1, 0, { rule: "V9 fald fra top (info)", s: dd > 0.75 ? YEL : GRN,
    v: `${(dd * 100).toFixed(0)} % under ATH (${fmt(a.ath)})`, n: "Sal: ægte projekter trækker typisk ~50 % tilbage" });
}

// one number for the user: 1-3 don't buy, 4-6 wait, 7-10 buy candidate
function verdict(buy) {
  return buy <= 3 ? { s: RED, t: "KØB IKKE" } : buy <= 6 ? { s: YEL, t: "VENT / FORSIGTIG" } : { s: GRN, t: "KØB-KANDIDAT" };
}
// a coin still on its launch curve whose only red flags are your timing rules is not a rug: it is too early
const TIMING = /^V4 graduated|^V4 market cap|^V5 /;
function tooEarly(rows) {
  const reds = rows.filter(r => r.s === RED);
  return reds.some(r => r.rule.startsWith("V4 graduated")) && reds.every(r => TIMING.test(r.rule));
}
const EARLY_NOTE = "Ingen rugtegn fundet. Dine regler: vent til coinen er graduated, MC er over $50K og fees over 2 SOL.";
const SCALE = "1-3 = køb ikke · 4-6 = vent/forsigtig · 7-10 = køb-kandidat (tjek selv hype og memet)";

function score(rows) {
  const hard = rows.filter(r => r.s === RED && HARD_NO.some(h => r.rule.startsWith(h)));
  const soft = rows.filter(r => r.s === RED && !hard.includes(r));
  // "(info)" rows describe the chart; they never move the score
  const yel = rows.filter(r => r.s === YEL && !r.rule.includes("(info)"));
  let risk = Math.round(3 + 3 * hard.length + 1.5 * soft.length + 0.5 * yel.length);
  risk = Math.max(hard.length ? 8 : 1, Math.min(10, risk));
  let buy = Math.max(1, Math.min(10, 10 - risk + (!hard.length && !soft.length ? 1 : 0)));
  if (hard.length) buy = Math.min(buy, 2);
  let reasons = [
    ...hard.map(r => `🟥 ${r.rule}: ${r.v} (hårdt nej)`),
    ...soft.map(r => `🟥 ${r.rule}: ${r.v}`),
    ...yel.map(r => `🟨 ${r.rule}: ${r.v}`),
  ];
  if (!reasons.length) reasons = ["Ingen røde eller gule på de automatiske tjek"];
  return { buy, risk, reasons: reasons.slice(0, 5) };
}

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

async function run(addr) {
  getCache.clear();
  $("go").disabled = true; $("log").textContent = ""; $("out").hidden = true;
  const rpcIn = $("rpc").value.trim();
  store.set("rpc", rpcIn);
  const rpc = [rpcIn && (rpcIn.includes("://") ? rpcIn : "https://" + rpcIn), ...PUBLIC_RPCS].filter(Boolean);
  const rows = [];
  const add = (rule, s, v, n = "") => rows.push({ rule, s, v, n });
  try {
    const evmAddr = EVM_ADDR.test(addr);
    log("Henter data …");
    const [dex, rc] = await Promise.all([
      req(`https://api.dexscreener.com/latest/dex/tokens/${addr}`).catch(e => (log("FEJL dexscreener: " + e.message), null)),
      evmAddr ? null : req(`https://api.rugcheck.xyz/v1/tokens/${addr}/report`).catch(() => null),
    ]);
    const pair = evmAddr ? bestPair(dex, addr) : await gtFallback(addr, bestPair(dex, addr));
    if (pair.source) log("DexScreener manglede data — bruger GeckoTerminal");
    const chain = pair.chainId || (evmAddr ? "evm" : "solana");
    const name = (pair.baseToken || {}).symbol || ((rc || {}).tokenMeta || {}).symbol || addr;
    let L = { twitter: null };
    let pending = new Set();
    const show = () => render(addr, name, pair, L, rows, [...pending], chain);
    const setV17 = () => {
      const found = ["twitter", "website", "telegram"].filter(k => L[k]);
      const i17 = rows.findIndex(r => r.rule.startsWith("V17"));
      if (i17 < 0) return;
      const src = (L.sources || []).join(" + ");
      // reel rule: a hard no only when description, socials AND website are all missing
      if (found.length) {
        rows[i17] = { rule: rows[i17].rule, s: !L.twitterIsPost || found.length > 1 ? GRN : YEL, v: found.join(", "),
          n: L.twitterIsPost ? "X-linket er et opslag/søgning, ikke en projektkonto" : src };
      } else if (L.description) {
        rows[i17] = { rule: rows[i17].rule, s: YEL, v: "kun beskrivelse, ingen socials/website", n: src };
      } else if (chain !== "solana") {
        rows[i17] = { rule: rows[i17].rule, s: NA, v: "ingen DexScreener-profil", n: "se coinens side/X selv for beskrivelse og socials" };
      } else if ((L.sources || []).some(x => x === "pump.fun" || x === "metadata")) {
        // only pump.fun and the metadata carry links; Rugcheck has just the description, so it cannot prove "no socials"
        rows[i17] = { rule: rows[i17].rule, s: RED, v: "ingen beskrivelse, socials eller website", n: src };
      } else {
        rows[i17] = { rule: rows[i17].rule, s: NA, v: "pump.fun og metadata svarede ikke",
          n: `åbn pump.fun/coin/${addr} og se om der er X/Telegram/website/beskrivelse` };
      }
    };

    if (chain === "solana") {
      baseChecks(rc, pair, add);
      pending = new Set(pair.pairAddress ? ["V1/V6 launch-candles", "V3 handler", "V5 fees", "V17 socials", "V9 ATH"] : []);
      show();
      if (pair.pairAddress) {
        const owners = new Set(((rc || {}).topHolders || []).map(h => String(h.owner).toLowerCase()));
        const lpP = launchPool(addr, dex, pair);
        await Promise.all([
          lpP.then(lp => candleChecks(lp.pool, add, "solana", pair)).then(() => { pending.delete("V1/V6 launch-candles"); show(); }),
          tradeChecks(pair, owners, add).then(tr => { pending.delete("V3 handler"); show(); return feeCheck(tr, pair, rpc, add, addr); })
            .then(() => { pending.delete("V5 fees"); show(); }),
          links(addr, pair, rc).then(l => { L = l; setV17(); pending.delete("V17 socials"); show(); return lpP; })
            .then(lp => athRow(pair, lp.ids.length ? lp.ids : [pair.pairAddress], L)).then(a => { athFrom(a, rows); pending.delete("V9 ATH"); show(); }),
        ]);
      }
    } else if (EVM[chain]) {
      const c = EVM[chain];
      baseChecks(null, pair, add, chain);
      const info = pair.info || {};
      for (const so of info.socials || []) if (so.type in L || ["twitter", "telegram"].includes(so.type)) L[so.type] = L[so.type] || so.url;
      if ((info.websites || []).length) L.website = info.websites[0].url;
      L.twitterIsPost = (L.twitter || "").includes("/status/");
      setV17();
      pending = new Set(["Sikkerhed (honeypot, mint, holders)", "V1/V6 launch-candles", "V3 handler", "V9 ATH"]);
      show();
      const lpP = evmLaunch(addr, c.gt);
      await Promise.all([
        evmChecks(addr, c, add).then(holders => { pending.delete("Sikkerhed (honeypot, mint, holders)"); show(); return tradeChecks(pair, holders, add, c.gt); })
          .then(() => { pending.delete("V3 handler"); show(); }),
        lpP.then(lp => lp.pool ? candleChecks(lp.pool, add, c.gt, pair) : add("V1 første candle (bundle ved launch)", NA, "ingen pools hos GeckoTerminal"))
          .then(() => { pending.delete("V1/V6 launch-candles"); show(); return lpP; })
          .then(lp => athRow(pair, lp.ids.length ? lp.ids : [pair.pairAddress], L, c.gt)).then(a => { athFrom(a, rows); pending.delete("V9 ATH"); show(); }),
      ]);
    } else {
      baseChecks(null, pair, add, chain);
      setV17();
      if (pair.pairAddress) add("Sikkerhedsdata", NA, `findes ikke for ${chain}`, "honeypot, mint, holders og LP kan ikke tjekkes på denne kæde");
    }
    show();
    log("Færdig.");
  } catch (e) {
    log("FEJL: " + e.message);
  } finally {
    $("go").disabled = false;
  }
}

function render(addr, name, pair, L, rows, pending = [], chain = "solana") {
  const { buy: b0, reasons } = score(rows);
  const missing = pending.length ? [] : rows.filter(r => r.s === NA && !r.rule.startsWith("V9"));
  // an unscanned check must never look like a pass
  const buy = missing.length ? Math.min(b0, 3) : b0;
  const early = !pending.length && !missing.length && tooEarly(rows);
  const reds = rows.filter(r => r.s === RED).length, yels = rows.filter(r => r.s === YEL).length, grns = rows.filter(r => r.s === GRN).length;
  const x = L.twitter ? `${L.twitter}${L.twitterIsPost ? " (opslag, ikke projektkonto)" : ""}` : "ingen X-link";

  const text = [
    `# ${name}  (${addr})`, `Kæde: ${chain}`, pair.url || "", `X: ${x}`, "",
    ...(missing.length ? [`## ⚠️ UFULDSTÆNDIG — ${missing.length} tjek IKKE scannet, køb ikke før de er løst:`,
      ...missing.map(r => `- ⬜ ${r.rule}: ${r.v}${r.n ? ` (${r.n})` : ""}`), ""] : []),
    `## SCORE ${buy}/10 · ${early ? "KØB IKKE ENDNU · FOR TIDLIGT" : verdict(buy).t}`, ...(early ? [EARLY_NOTE] : []), SCALE, ...reasons.map(r => "- " + r), "",
    `Automatisk: ${reds} røde, ${yels} gule, ${grns} grønne`, "",
    ...rows.map(r => `${ICON[r.s]} ${r.rule} | ${r.v}${r.n ? " | " + r.n : ""}`), "",
    "Tjekker du selv:", ...MANUAL.map(m => "- " + m),
  ].join("\n");

  $("out").innerHTML = `
    <div class="verdict">
      <h2>${esc(name)}</h2>
      ${pending.length
        ? `<span class="score p-NA">SCANNER … foreløbig ${Math.min(buy, 3)}/10</span>`
        : early ? `<span class="score p-YEL">${buy}/10 · KØB IKKE ENDNU · FOR TIDLIGT</span>`
        : `<span class="score p-${verdict(buy).s}">${buy}/10 · ${verdict(buy).t}</span>`}
    </div>
    ${early && !pending.length ? `<p><strong>${EARLY_NOTE}</strong></p>` : ""}
    <p class="sub">${SCALE}. Mangler et tjek, er scoren højst 3.</p>
    ${pending.length ? `<div class="warn"><strong>Scanner stadig:</strong> ${esc(pending.join(", "))}. Køb ikke før den er færdig.</div>` : ""}
    <div class="links">
      ${pair.url ? `<a href="${esc(pair.url)}" target="_blank" rel="noopener">DexScreener</a>` : ""}
      ${chain === "solana" ? `<a href="https://rugcheck.xyz/tokens/${esc(addr)}" target="_blank" rel="noopener">Rugcheck</a>
      <a href="https://pump.fun/coin/${esc(addr)}" target="_blank" rel="noopener">pump.fun</a>` : `<a href="https://honeypot.is/?address=${esc(addr)}" target="_blank" rel="noopener">honeypot.is</a>`}
      ${L.twitter ? `<a href="${esc(L.twitter)}" target="_blank" rel="noopener">X${L.twitterIsPost ? " (opslag)" : ""}</a>` : "<span>ingen X-link</span>"}
    </div>
    ${missing.length ? `<div class="warn red"><strong>⚠️ UFULDSTÆNDIG: ${missing.length} tjek er IKKE scannet. Køb ikke før de er løst.</strong>
      <ul>${missing.map(r => `<li>⬜ ${esc(r.rule)}: ${esc(r.v)}${r.n ? ` (${esc(r.n)})` : ""}</li>`).join("")}</ul></div>` : ""}
    <ul>${reasons.map(r => `<li>${esc(r)}</li>`).join("")}</ul>
    ${chain !== "solana" && pair.pairAddress ? `<p class="sub">Kæde: ${esc((EVM[chain] || {}).name || chain)}. Solana-reglerne V4 graduated (pump.fun), V5 fees i SOL og V8 insider-graf (Rugcheck) findes ikke her og er sprunget over. I stedet tjekkes honeypot, skat og ejer-magt.</p>` : ""}
    <p class="sub">Automatisk: ${reds} røde, ${yels} gule, ${grns} grønne. Hvert 🟥 på V4, V5, V14, V15, V16, V17 er et hårdt nej. Reglerne er lavet til nye memecoins ($50K–få $M); på store etablerede coins giver V14/V15 falske røde.</p>
    <div class="tbl"><table>
      <thead><tr><th>Tjek</th><th></th><th>Værdi</th><th>Note</th></tr></thead>
      <tbody>${rows.map(r => `<tr><td>${esc(r.rule)}</td><td><span class="pill p-${r.s}">${ICON[r.s]}</span></td><td class="v">${esc(r.v)}</td><td class="n">${esc(r.n)}</td></tr>`).join("")}</tbody>
    </table></div>
    <div><strong>Tjekker du selv</strong><ul>${MANUAL.map(m => `<li>${esc(m)}</li>`).join("")}</ul></div>
    <div style="display:grid;gap:8px">
      <button class="ghost" type="button" id="copy">Kopiér resultat som tekst</button>
      <textarea id="txt" readonly aria-label="Resultat som tekst">${esc(text)}</textarea>
    </div>`;
  $("out").hidden = false;
  $("copy").onclick = () => navigator.clipboard.writeText(text).then(
    () => { $("copy").textContent = "Kopieret"; },
    () => { $("txt").select(); });
}

$("rpc").value = store.get("rpc");
// paste replaces the old address and starts right away; a click selects all so typing replaces it too
$("addr").addEventListener("focus", e => e.target.select());
$("addr").addEventListener("paste", e => {
  const t = ((e.clipboardData && e.clipboardData.getData("text")) || "").trim();
  if (!t) return;
  e.preventDefault();
  $("addr").value = t;
  $("f").requestSubmit();
});
$("f").addEventListener("submit", e => {
  e.preventDefault();
  const a = $("addr").value.trim();
  if (!/^[\w:.-]{20,130}$/.test(a)) { $("log").textContent = "Det ligner ikke en token-adresse. Indsæt contract-adressen (Solana, 0x… osv.)."; return; }
  run(a);
});
const BASE58 = /0x[0-9a-fA-F]{40}|[1-9A-HJ-NP-Za-km-z]{32,44}/g;
const COIN_SITES = ["dexscreener.com", "pump.fun", "gmgn.ai", "axiom.trade", "photon-sol.tinyastro.io", "photon.tinyastro.io", "birdeye.so", "solscan.io", "rugcheck.xyz", "bullx.io", "geckoterminal.com", "dextools.io", "etherscan.io", "basescan.org", "bscscan.com", "four.meme", "honeypot.is"];
const IS_EXT = typeof chrome !== "undefined" && !!(chrome.tabs && chrome.tabs.query);

function start(a) { $("addr").value = a; $("f").requestSubmit(); }

async function fromTab() {
  // extension popup: take the coin from the open DexScreener / pump.fun / terminal tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let host = "";
  try { host = new URL(tab.url).hostname.replace(/^www\./, ""); } catch {}
  // only coin sites; any other page's long ids must not be mistaken for a token
  if (!COIN_SITES.some(d => host === d || host.endsWith("." + d))) return null;
  const ids = [...new Set(tab.url.match(BASE58) || [])];
  for (const id of ids) {
    try {
      const t = ((await req(`https://api.dexscreener.com/latest/dex/tokens/${id}`, null, 2)).pairs || [])[0];
      if (t) return { addr: id, symbol: t.baseToken.symbol };
      const seg = new URL(tab.url).pathname.split("/")[1] || "";
      const pc = host === "dexscreener.com" && seg ? seg : EVM_ADDR.test(id) ? "ethereum" : "solana";
      const p = await req(`https://api.dexscreener.com/latest/dex/pairs/${pc}/${id}`, null, 2);
      const pair = (p.pairs || [])[0] || p.pair;
      if (pair && pair.baseToken) return { addr: pair.baseToken.address, symbol: pair.baseToken.symbol };
    } catch {}
  }
  return null;
}

if (IS_EXT) {
  document.documentElement.classList.add("ext");
  $("big").hidden = false;
  $("big").onclick = () => chrome.tabs.create({ url: chrome.runtime.getURL("index.html") + "?a=" + encodeURIComponent($("addr").value.trim()) });
}
const initial = new URLSearchParams(location.search).get("a") || location.hash.slice(1);
// run a linked coin once, then clean the address bar so a bookmark never keeps an old coin
if (initial) { history.replaceState(null, "", location.pathname); start(initial); }
else if (IS_EXT) {
  // never start on its own: the popup opens empty, and the open tab's coin is only offered as a button
  fromTab().then(c => {
    if (!c) return;
    $("tab").textContent = `Tjek ${c.symbol || "coin"} fra fanen`;
    $("tab").title = c.addr;
    $("tab").hidden = false;
    $("tab").onclick = () => start(c.addr);
  }).catch(() => {});
}
