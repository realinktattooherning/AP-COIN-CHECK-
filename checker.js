const RED = "RED", YEL = "YEL", GRN = "GRN", NA = "NA";
const ICON = { RED: "🟥", YEL: "🟨", GRN: "🟩", NA: "⬜" };
const GT = "https://api.geckoterminal.com/api/v2/networks/solana/pools/";
const JITO = new Set([
  "96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5", "HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe",
  "Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY", "ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49",
  "DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh", "ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt",
  "DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL", "3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT",
]);
const FEE_SAMPLE = 30;
const PUBLIC_RPCS = ["https://solana-rpc.publicnode.com", "https://api.mainnet-beta.solana.com"];
const MANUAL = [
  "V7/V13 hype + sentiment fra holders på X (link ovenfor)",
  "V11 forstår du memet",
  "V12 dev/team kan findes",
];
const HARD_NO = ["V4", "V5", "V14", "V15", "V16", "V17", "Mint", "Freeze", "Rugcheck: rugged"];

const $ = id => document.getElementById(id);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = s => { $("log").textContent += s + "\n"; };
const store = {
  get(k) { try { return localStorage.getItem(k) || ""; } catch { return ""; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};

let gtNext = 0;
async function req(url, body, tries = 6) {
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

function bestPair(dex) {
  const all = (dex && dex.pairs) || [];
  const sol = all.filter(p => p.chainId === "solana");
  const pairs = sol.length ? sol : all;
  return pairs.reduce((b, p) => (((p.liquidity || {}).usd || 0) > ((b.liquidity || {}).usd || -1) ? p : b), {});
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

function baseChecks(rc, pair, add) {
  const mc = pair.marketCap || pair.fdv;
  const vol = pair.volume || {}, txns = pair.txns || {};
  if (rc) {
    if (rc.rugged) add("Rugcheck: rugged", RED, "JA", "rugcheck markerer token som rugget");
    const top = holdersExPools(rc);
    const top10 = top.slice(0, 10).reduce((s, h) => s + (h.pct || 0), 0);
    add("V14 top 10 holders ≤ 30 %", top10 > 30 ? RED : GRN, f1(top10) + " %", "ekskl. pools/kendte konti");
    const cl = largestEqualCluster(top.slice(0, 20).map(h => h.pct || 0).filter(p => p >= 0.3));
    add("V2 ens holder-balancer (bundle)", cl.length >= 4 ? RED : cl.length === 3 ? YEL : GRN,
      cl.length ? `${cl.length} wallets ~${cl[0].toFixed(2)} %` : "ingen", "≥4 inden for ~2 % af hinanden = rødt");
    const ins = rc.graphInsidersDetected || 0, flagged = top.filter(h => h.insider).length;
    add("V8 insider-wallets", ins >= 5 || flagged >= 3 ? RED : ins || flagged ? YEL : GRN,
      `${ins} insiders i graf, ${flagged} top-holders flaget`);
    add("Mint authority revoked", rc.mintAuthority ? RED : GRN, rc.mintAuthority ? "aktiv" : "revoked");
    add("Freeze authority revoked", rc.freezeAuthority ? RED : GRN, rc.freezeAuthority ? "aktiv" : "revoked");
    const locked = Math.max(0, ...(rc.markets || []).map(m => (m.lp || {}).lpLockedPct || 0));
    add("LP låst/brændt", locked >= 90 ? GRN : locked >= 50 ? YEL : RED, locked.toFixed(0) + " %",
      "pump.fun/pumpswap-pools kan vise lavt selv om LP er brændt — tjek manuelt hvis rødt");
    const cb = rc.creatorBalance || 0, supply = (rc.token || {}).supply || 0;
    if (supply) {
      const share = cb / supply * 100;
      add("Dev/creator andel", share > 5 ? RED : share > 1 ? YEL : GRN, f1(share) + " %");
    }
    const danger = (rc.risks || []).filter(r => r.level === "danger").map(r => r.name);
    const warn = (rc.risks || []).filter(r => r.level === "warn").map(r => r.name);
    add("Rugcheck risici", danger.length ? RED : warn.length ? YEL : GRN, [...danger, ...warn].join(", ") || "ingen",
      "score " + (rc.score_normalised ?? rc.score));
  } else {
    add("Rugcheck-data", NA, "mangler", "V2, V8, V14, authorities, LP kunne ikke tjekkes");
  }
  if (pair.pairAddress) {
    const dexId = pair.dexId || "?";
    add("V4 graduated", dexId !== "pumpfun" ? GRN : RED, dexId, "pumpfun = stadig på bonding curve");
    add("V4 market cap ≥ $50-60K", mc == null ? NA : mc < 50000 ? RED : GRN, fmt(mc), "sweet spot $50K-200K");
    add("V15 market cap ≤ 24h-volumen", mc == null ? NA : mc > (vol.h24 || 0) ? RED : GRN, `MC ${fmt(mc)} / vol ${fmt(vol.h24)}`);
    const h1 = txns.h1 || {}, h24 = txns.h24 || {};
    const b1 = h1.buys || 0, s1 = h1.sells || 0;
    add("V16 købere ≥ sælgere (1h)", s1 > b1 * 1.1 ? RED : s1 > b1 ? YEL : GRN,
      `1h ${h1.buys ?? "?"}/${h1.sells ?? "?"}, 24h ${h24.buys ?? "?"}/${h24.sells ?? "?"} (køb/salg)`,
      "rødt ved >10 % flere salg; antal handler, ikke unikke wallets");
    add("V17 beskrivelse/socials/website", NA, "?", "");
    const age = pair.pairCreatedAt ? (Date.now() - pair.pairCreatedAt) / 3600000 : null;
    add("V10 alder ≤ 1 døgn", age == null ? NA : age > 24 ? YEL : GRN, age == null ? "?" : f1(age) + " t");
    const liq = (pair.liquidity || {}).usd, ratio = liq && mc ? liq / mc * 100 : null;
    add("Likviditet ift. MC", ratio == null ? NA : ratio < 5 ? RED : ratio < 10 ? YEL : GRN,
      ratio == null ? fmt(liq) : `${fmt(liq)} (${f1(ratio)} % af MC)`);
    const pc = pair.priceChange || {};
    add("V9 momentum (info)", NA, `pris 5m ${pc.m5 ?? "?"}% · 1h ${pc.h1 ?? "?"}% · 24h ${pc.h24 ?? "?"}% · vol 5m ${fmt(vol.m5)}`);
  } else {
    add("DexScreener-data", NA, "mangler", "V4, V9, V10, V15, V16, V17 kunne ikke tjekkes");
  }
}

async function links(mint, pair) {
  // pump.fun blocks browser calls (403 with an Origin header); DexScreener is the reliable source here
  const info = pair.info || {};
  const L = { twitter: null, website: null, telegram: null, pump: null };
  for (const s of info.socials || []) if (s.type in L && !L[s.type]) L[s.type] = s.url;
  if ((info.websites || []).length) L.website = info.websites[0].url;
  try {
    const pf = await req(`https://frontend-api-v3.pump.fun/coins-v2/${mint}`, null, 1);
    for (const k of ["twitter", "website", "telegram"]) L[k] = L[k] || pf[k];
    L.pump = pf;
  } catch { L.pumpError = true; }
  L.twitterIsPost = (L.twitter || "").includes("/status/");
  return L;
}

async function launchPool(mint, dex, best) {
  // The pump.fun bonding-curve pool holds the real launch candles; DexScreener drops it after migration, GeckoTerminal keeps it
  try {
    const d = await req(`https://api.geckoterminal.com/api/v2/networks/solana/tokens/${mint}/pools?page=1`);
    const pools = d.data || [];
    const pf = pools.find(p => p.relationships.dex.data.id === "pump-fun");
    const ids = pools.map(p => p.attributes.address);
    if (pf) return { pool: { pairAddress: pf.attributes.address, dexId: "pumpfun", pairCreatedAt: Date.parse(pf.attributes.pool_created_at) }, ids };
    return { pool: ((dex && dex.pairs) || []).find(p => p.dexId === "pumpfun") || best, ids };
  } catch {
    return { pool: ((dex && dex.pairs) || []).find(p => p.dexId === "pumpfun") || best, ids: [] };
  }
}

const median = a => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

async function candleChecks(pool, add) {
  let url = `${GT}${pool.pairAddress}/ohlcv/minute?aggregate=1&limit=1000`;
  const created = pool.pairCreatedAt;
  if (created) url += `&before_timestamp=${Math.floor(created / 1000) + 1000 * 60}`;
  let c;
  try {
    c = (await req(url)).data.attributes.ohlcv_list.sort((a, b) => a[0] - b[0]);
    if (created) c = c.filter(x => x[0] >= created / 1000 - 60);
  } catch (e) {
    add("V1 første candle (bundle ved launch)", NA, "fejl: " + String(e.message).slice(0, 40));
    add("V6 én wick til himlen", NA, "ingen candles");
    return;
  }
  if (!c.length) { add("V1 første candle (bundle ved launch)", NA, "ingen candles"); return; }
  const vols = c.map(x => x[5]);
  const share = c[0][5] / (vols.reduce((s, v) => s + v, 0) || 1);
  const vsMed = c.length > 5 ? c[0][5] / (median(vols.slice(1, 31)) || 1) : null;
  if (pool.dexId !== "pumpfun") {
    add("V1 første candle (bundle ved launch)", NA, "launch-pool (pump.fun) ikke fundet",
      `kun ${pool.dexId}-pool — ikke en pump.fun-coin, eller API fejlede`);
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

async function tradeChecks(best, rc, add) {
  let tr;
  try { tr = (await req(`${GT}${best.pairAddress}/trades`)).data.map(t => t.attributes); }
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
  const owners = new Set(((rc || {}).topHolders || []).map(h => h.owner));
  const big = [...sellers].filter(s => owners.has(s)).length;
  add("V3 sell-bots der spejler køb", mirrors >= 5 && ratio >= 0.1 ? RED : mirrors >= 3 ? YEL : GRN,
    `${mirrors} spejlede salg på ${buys.length} køb (${(ratio * 100).toFixed(0)} %), ${sellers.size} sælger-wallets, ${big} af dem top-holders`,
    `seneste ${tr.length} handler`);
  return tr;
}

async function feeCheck(tr, best, rpcs, add) {
  if (!tr.length) { add("V5 total fees ≥ 2 SOL", NA, "ingen handler"); return; }
  const fees = [];
  let lastErr = "", done = 0;
  const one = async t => {
    const body = { jsonrpc: "2.0", id: 1, method: "getTransaction",
      params: [t.tx_hash, { encoding: "jsonParsed", maxSupportedTransactionVersion: 1 }] };
    let res = null;
    // own key first, then keyless public RPCs; one dead endpoint must not leave V5 unscanned
    for (const u of rpcs) {
      try { res = (await req(u, body, 2)).result; } catch (e) { lastErr = e.message; }
      if (res) break;
    }
    if (res) {
      const meta = res.meta, msg = res.transaction.message;
      const ins = [...(msg.instructions || []), ...(meta.innerInstructions || []).flatMap(g => g.instructions)];
      const tips = ins.filter(i => i.parsed && typeof i.parsed === "object" && i.parsed.type === "transfer" && JITO.has(i.parsed.info.destination))
        .reduce((s, i) => s + (i.parsed.info.lamports || 0), 0);
      fees.push((meta.fee || 0) + tips);
    }
    done++;
  };
  // 5 at a time: fast on a Helius key, still gentle enough for the public RPC
  const sample = tr.slice(-FEE_SAMPLE);
  for (let i = 0; i < sample.length; i += 5) await Promise.all(sample.slice(i, i + 5).map(one));
  if (!fees.length) {
    add("V5 total fees ≥ 2 SOL", NA, "Solana RPC svarede ikke" + (lastErr ? ` (${lastErr})` : ""),
      "alle RPC'er afviste — prøv igen om et minut");
    return;
  }
  const t24 = (best.txns || {}).h24 || {};
  const tx24 = (t24.buys || 0) + (t24.sells || 0);
  const avg = fees.reduce((s, f) => s + f, 0) / fees.length / 1e9;
  const est = avg * tx24, vol24 = (best.volume || {}).h24 || 0;
  const perK = vol24 ? est / (vol24 / 1000) : 0;
  add("V5 total fees ≥ 2 SOL", est < 1 ? RED : est < 2 ? YEL : GRN,
    `~${est.toFixed(2)} SOL på 24h (${(avg * 1000).toFixed(2)} mSOL/handel × ${tx24} handler, ${perK.toFixed(3)} SOL pr. $1K vol)`,
    `estimat: gas + Jito-tips fra ${fees.length} stikprøver; minimumsværdi`);
}

async function athRow(pair, poolIds, L) {
  const pf = L.pump;
  if (pf && pf.ath_market_cap && pf.usd_market_cap) return { ath: pf.ath_market_cap, now: pf.usd_market_cap };
  // fallback: highest daily USD price across the token's pools × current supply factor
  const mc = pair.marketCap || pair.fdv, price = Number(pair.priceUsd);
  if (!mc || !price) return null;
  let hi = 0;
  for (const id of poolIds.slice(0, 2)) {
    try { hi = Math.max(hi, ...(await req(`${GT}${id}/ohlcv/day?limit=1000`)).data.attributes.ohlcv_list.map(x => x[2])); } catch {}
  }
  return hi ? { ath: Math.max(hi * mc / price, mc), now: mc } : null;
}

// one number for the user: 1-3 don't buy, 4-6 wait, 7-10 buy candidate
function verdict(buy) {
  return buy <= 3 ? { s: RED, t: "KØB IKKE" } : buy <= 6 ? { s: YEL, t: "VENT / FORSIGTIG" } : { s: GRN, t: "KØB-KANDIDAT" };
}
const SCALE = "1-3 = køb ikke · 4-6 = vent/forsigtig · 7-10 = køb-kandidat (tjek selv hype og memet)";

function score(rows) {
  const hard = rows.filter(r => r.s === RED && HARD_NO.some(h => r.rule.startsWith(h)));
  const soft = rows.filter(r => r.s === RED && !hard.includes(r));
  const yel = rows.filter(r => r.s === YEL);
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
  $("go").disabled = true; $("log").textContent = ""; $("out").hidden = true;
  const rpcIn = $("rpc").value.trim();
  store.set("rpc", rpcIn);
  const rpc = [rpcIn && (rpcIn.includes("://") ? rpcIn : "https://" + rpcIn), ...PUBLIC_RPCS].filter(Boolean);
  const rows = [];
  const add = (rule, s, v, n = "") => rows.push({ rule, s, v, n });
  try {
    log("Henter DexScreener + Rugcheck …");
    const [dex, rc] = await Promise.all([
      req(`https://api.dexscreener.com/latest/dex/tokens/${addr}`).catch(e => (log("FEJL dexscreener: " + e.message), null)),
      req(`https://api.rugcheck.xyz/v1/tokens/${addr}/report`).catch(e => (log("FEJL rugcheck: " + e.message), null)),
    ]);
    const pair = bestPair(dex);
    const name = (pair.baseToken || {}).symbol || ((rc || {}).tokenMeta || {}).symbol || addr;
    baseChecks(rc, pair, add);
    let L = { twitter: null };
    const pending = new Set(pair.pairAddress ? ["V1/V6 launch-candles", "V3 handler", "V5 fees", "V17 socials", "V9 ATH"] : []);
    const show = () => render(addr, name, pair, L, rows, [...pending]);
    show();
    if (pair.pairAddress) {
      const lpP = launchPool(addr, dex, pair);
      await Promise.all([
        lpP.then(lp => candleChecks(lp.pool, add)).then(() => { pending.delete("V1/V6 launch-candles"); show(); }),
        tradeChecks(pair, rc, add).then(tr => { pending.delete("V3 handler"); show(); return feeCheck(tr, pair, rpc, add); })
          .then(() => { pending.delete("V5 fees"); show(); }),
        links(addr, pair).then(l => {
          L = l;
          const found = ["twitter", "website", "telegram"].filter(k => L[k]);
          const i17 = rows.findIndex(r => r.rule.startsWith("V17"));
          if (found.length) {
            rows[i17] = { rule: rows[i17].rule, s: !L.twitterIsPost || found.length > 1 ? GRN : YEL, v: found.join(", "),
              n: L.twitterIsPost ? "X-linket er et enkelt opslag, ikke en projektkonto" : "DexScreener" + (L.pump ? " + pump.fun" : "") };
          } else if (L.pumpError) {
            rows[i17] = { rule: rows[i17].rule, s: NA, v: "ingen på DexScreener, pump.fun blokerer browseren",
              n: `åbn pump.fun/coin/${addr} og se om der er X/Telegram/website/beskrivelse` };
          } else {
            rows[i17] = { rule: rows[i17].rule, s: RED, v: "ingen socials/website", n: "DexScreener + pump.fun" };
          }
          pending.delete("V17 socials"); show();
          return lpP;
        }).then(lp => athRow(pair, lp.ids.length ? lp.ids : [pair.pairAddress], L)).then(a => {
          if (a) {
            const dd = 1 - a.now / a.ath;
            const i9 = rows.findIndex(r => r.rule.startsWith("V9 momentum"));
            rows.splice(i9 + 1, 0, { rule: "V9 fald fra top (info)", s: dd > 0.75 ? YEL : GRN,
              v: `${(dd * 100).toFixed(0)} % under ATH (${fmt(a.ath)})`, n: "Sal: ægte projekter trækker typisk ~50 % tilbage" });
          }
          pending.delete("V9 ATH"); show();
        }),
      ]);
    }
    show();
    log("Færdig.");
  } catch (e) {
    log("FEJL: " + e.message);
  } finally {
    $("go").disabled = false;
  }
}

function render(addr, name, pair, L, rows, pending = []) {
  const { buy: b0, reasons } = score(rows);
  const missing = pending.length ? [] : rows.filter(r => r.s === NA && !r.rule.startsWith("V9"));
  // an unscanned check must never look like a pass
  const buy = missing.length ? Math.min(b0, 3) : b0;
  const reds = rows.filter(r => r.s === RED).length, yels = rows.filter(r => r.s === YEL).length, grns = rows.filter(r => r.s === GRN).length;
  const x = L.twitter ? `${L.twitter}${L.twitterIsPost ? " (opslag, ikke projektkonto)" : ""}` : "ingen X-link";

  const text = [
    `# ${name}  (${addr})`, pair.url || "", `X: ${x}`, "",
    ...(missing.length ? [`## ⚠️ UFULDSTÆNDIG — ${missing.length} tjek IKKE scannet, køb ikke før de er løst:`,
      ...missing.map(r => `- ⬜ ${r.rule}: ${r.v}${r.n ? ` (${r.n})` : ""}`), ""] : []),
    `## SCORE ${buy}/10 · ${verdict(buy).t}`, SCALE, ...reasons.map(r => "- " + r), "",
    `Automatisk: ${reds} røde, ${yels} gule, ${grns} grønne`, "",
    ...rows.map(r => `${ICON[r.s]} ${r.rule} | ${r.v}${r.n ? " | " + r.n : ""}`), "",
    "Tjekker du selv:", ...MANUAL.map(m => "- " + m),
  ].join("\n");

  $("out").innerHTML = `
    <div class="verdict">
      <h2>${esc(name)}</h2>
      ${pending.length
        ? `<span class="score p-NA">SCANNER … foreløbig ${Math.min(buy, 3)}/10</span>`
        : `<span class="score p-${verdict(buy).s}">${buy}/10 · ${verdict(buy).t}</span>`}
    </div>
    <p class="sub">${SCALE}. Mangler et tjek, er scoren højst 3.</p>
    ${pending.length ? `<div class="warn"><strong>Scanner stadig:</strong> ${esc(pending.join(", "))}. Køb ikke før den er færdig.</div>` : ""}
    <div class="links">
      ${pair.url ? `<a href="${esc(pair.url)}" target="_blank" rel="noopener">DexScreener</a>` : ""}
      <a href="https://rugcheck.xyz/tokens/${esc(addr)}" target="_blank" rel="noopener">Rugcheck</a>
      <a href="https://pump.fun/coin/${esc(addr)}" target="_blank" rel="noopener">pump.fun</a>
      ${L.twitter ? `<a href="${esc(L.twitter)}" target="_blank" rel="noopener">X${L.twitterIsPost ? " (opslag)" : ""}</a>` : "<span>ingen X-link</span>"}
    </div>
    ${missing.length ? `<div class="warn red"><strong>⚠️ UFULDSTÆNDIG: ${missing.length} tjek er IKKE scannet. Køb ikke før de er løst.</strong>
      <ul>${missing.map(r => `<li>⬜ ${esc(r.rule)}: ${esc(r.v)}${r.n ? ` (${esc(r.n)})` : ""}</li>`).join("")}</ul></div>` : ""}
    <ul>${reasons.map(r => `<li>${esc(r)}</li>`).join("")}</ul>
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
  if (/^0x[0-9a-fA-F]{40}$/.test(a)) { $("log").textContent = "Det er en 0x-adresse (Ethereum, Base, BSC o.l.), ikke Solana. Tjekket virker kun på Solana-coins."; return; }
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a)) { $("log").textContent = "Det ligner ikke en Solana-adresse (32–44 tegn, base58)."; return; }
  run(a);
});
const BASE58 = /[1-9A-HJ-NP-Za-km-z]{32,44}/g;
const COIN_SITES = ["dexscreener.com", "pump.fun", "gmgn.ai", "axiom.trade", "photon-sol.tinyastro.io", "birdeye.so", "solscan.io", "rugcheck.xyz", "bullx.io", "geckoterminal.com"];
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
      if (((await req(`https://api.dexscreener.com/latest/dex/tokens/${id}`, null, 2)).pairs || []).length) return id;
      const p = await req(`https://api.dexscreener.com/latest/dex/pairs/solana/${id}`, null, 2);
      const pair = (p.pairs || [])[0] || p.pair;
      if (pair && pair.baseToken) return pair.baseToken.address;
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
  $("log").textContent = "Leder efter coin i den åbne fane …";
  fromTab().then(a => {
    $("log").textContent = a ? "" : "Ingen coin i den åbne fane. Indsæt en adresse.";
    if (a) start(a);
  });
}
