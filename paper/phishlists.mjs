// Drainer/phishing domains from the public lists wallets use (MetaMask, Phantom, Scam Sniffer), merged and split into
// 256 small shards by the first byte of sha1(domain), so the site and the extension fetch one ~KB file per check.
// usage: node paper/phishlists.mjs <out-dir>
import fs from "node:fs";
import crypto from "node:crypto";
const OUT = process.argv[2];
const SRC = {
  metamask: "https://raw.githubusercontent.com/MetaMask/eth-phishing-detect/main/src/config.json",
  phantom: "https://raw.githubusercontent.com/phantom/blocklist/master/blocklist.yaml",
  scamsniffer: "https://raw.githubusercontent.com/scamsniffer/scam-database/main/blacklist/domains.json",
};
const clean = d => String(d || "").trim().toLowerCase().replace(/^\*\./, "").replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");
const domains = new Set(), counts = {};
let allow = new Set();
for (const [name, url] of Object.entries(SRC)) {
  try {
    const r = await fetch(url); if (!r.ok) throw new Error("HTTP " + r.status);
    const txt = await r.text(); let list = [];
    if (name === "metamask") { const j = JSON.parse(txt); list = j.blacklist || []; allow = new Set((j.whitelist || []).map(clean)); }
    else if (name === "phantom") list = [...txt.matchAll(/url:\s*(\S+)/g)].map(m => m[1]);
    else list = JSON.parse(txt);
    let n = 0; for (const d of list) { const c = clean(d); if (c && c.includes(".")) { domains.add(c); n++; } }
    counts[name] = n;
  } catch (e) { counts[name] = "failed: " + e.message; }
}
for (const d of allow) domains.delete(d);
// never flag the big real sites even if a list ever does by mistake
for (const d of ["pump.fun", "dexscreener.com", "phantom.app", "phantom.com", "jup.ag", "raydium.io", "solscan.io", "gmgn.ai", "axiom.trade", "github.com", "x.com", "twitter.com", "google.com"]) domains.delete(d);
const shards = Array.from({ length: 256 }, () => []);
for (const d of domains) shards[parseInt(crypto.createHash("sha1").update(d).digest("hex").slice(0, 2), 16)].push(d);
fs.mkdirSync(OUT, { recursive: true });
shards.forEach((s, i) => fs.writeFileSync(`${OUT}/${i.toString(16).padStart(2, "0")}.txt`, s.sort().join("\n")));
fs.writeFileSync(`${OUT}/meta.json`, JSON.stringify({ updated: new Date().toISOString(), total: domains.size, sources: counts }));
console.log(JSON.stringify({ total: domains.size, sources: counts }));
