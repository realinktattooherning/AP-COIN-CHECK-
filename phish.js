// Is this site a known drainer/phishing site? Checks a domain (and its parent domains) against the merged MetaMask,
// Phantom and Scam Sniffer lists that the bot publishes to paper-data/phish/ (sharded by sha1, one small file per check).
(function (root) {
  "use strict";
  const BASE = "https://raw.githubusercontent.com/realinktattooherning/AP-COIN-CHECK-/paper-data/phish/";
  const cache = new Map();
  const host = v => { try { return new URL(/^[a-z]+:\/\//i.test(v) ? v : "https://" + v).hostname.toLowerCase().replace(/^www\./, ""); } catch { return ""; } };
  async function sha1(s) { const b = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(s)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join(""); }
  async function shard(id) {
    if (!cache.has(id)) cache.set(id, fetch(BASE + id + ".txt", { credentials: "omit" }).then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.text(); })
      .then(t => new Set(t.split("\n"))).catch(e => { cache.delete(id); throw e; }));
    return cache.get(id);
  }
  // returns { domain, listed: true/false, match } or throws when the lists cannot be read (never "safe" by default)
  async function check(input) {
    const h = host(input);
    if (!h || !h.includes(".")) throw new Error("not a web address");
    const parts = h.split(".");
    for (let i = 0; i < parts.length - 1; i++) {
      const d = parts.slice(i).join(".");
      const set = await shard((await sha1(d)).slice(0, 2));
      if (set.has(d)) return { domain: h, listed: true, match: d };
    }
    return { domain: h, listed: false };
  }
  root.DKPhish = { check, host };
})(typeof window === "object" ? window : this);
