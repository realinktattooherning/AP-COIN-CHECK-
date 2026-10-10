(function (root) {
  'use strict';
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  function solanaAddress(value) {
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)) return false;
    let n = 0n;
    for (const c of value) n = n * 58n + BigInt(alphabet.indexOf(c));
    let bytes = 0;
    while (n > 0n) { bytes++; n >>= 8n; }
    return bytes + (value.match(/^1*/) || [''])[0].length === 32;
  }
  const evmAddress = value => /^0x[0-9a-fA-F]{40}$/.test(value);
  const valid = value => solanaAddress(value) || evmAddress(value);
  const equal = (a, b) => typeof a === 'string' && typeof b === 'string' && (evmAddress(a) ? a.toLowerCase() === b.toLowerCase() : a === b);
  function extract(text) {
    const found = [];
    const add = item => { if (!found.some(x => x.kind === item.kind && x.chain === item.chain && equal(x.address, item.address))) found.push(item); };
    const rest = String(text).replace(/(?:https?:\/\/)?(?:www\.)?(?:pump\.fun|dexscreener\.com|solscan\.io|rugcheck\.xyz)\/[^\s<>"']+/gi, raw => {
      try {
        const url = new URL(/^https?:/i.test(raw) ? raw : 'https://' + raw);
        const host = url.hostname.replace(/^www\./, '').toLowerCase();
        const parts = url.pathname.split('/').filter(Boolean);
        const address = parts.at(-1);
        if (host === 'dexscreener.com' && parts.length === 2 && /^[a-z0-9-]+$/.test(parts[0]) && valid(address)) add({address, chain:parts[0], kind:'pair', evidence:raw});
        else if ((host === 'pump.fun' && parts.length === 2 && parts[0] === 'coin' || host === 'solscan.io' && parts[0] === 'token' || host === 'rugcheck.xyz' && parts[0] === 'tokens') && solanaAddress(address)) add({address, chain:'solana', kind:'token', evidence:raw});
      } catch {}
      return ' ';
    });
    for (const match of rest.matchAll(/(?<![A-Za-z0-9])(?:0x[0-9a-fA-F]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})(?![A-Za-z0-9])/g)) {
      if (valid(match[0])) add({address:match[0], chain:evmAddress(match[0]) ? null : 'solana', kind:'token', evidence:match[0]});
    }
    return found;
  }
  function queryName(text) {
    const s=String(text).trim();
    if (!s || extract(s).length) return '';
    const first=s.match(/^\$?([\p{L}\p{N}_-]{2,24})(?:\s*[,,:]|\s+(?:gi(?:v)?|give|adresse|address|analy[sz]|hvad|what)\b)/iu);
    if (first) return first[1];
    return /^\$?[\p{L}\p{N}_ -]{2,40}$/u.test(s) && !/\b(adresse|address|analyse|analysis|giv|give|hvad|what|scan)\b/i.test(s) ? s.replace(/^\$/,'') : '';
  }
  function suggestNames(text) {
    const stop=new Set('SOL USD USDT USDC ETH BNB BTC BUY SELL LONG SHORT CA MC VOL PNL ROI ATH LOW HIGH LIVE CHAT SEND SWAP TOKEN PRICE POOL TOTAL BALANCE MAX MIN ALL NEW COPY HOME TEST FIXTURE NOT TRADE OCR EXPECTED'.split(' '));
    const out=[];
    for(const line of String(text).split(/\r?\n/)){
      const match=line.trim().match(/^\$?([A-Z][A-Z0-9]{1,14})(?:\s*\/\s*(?:SOL|USDC|ETH))?$/);
      if(match&&!stop.has(match[1])&&!out.includes(match[1]))out.push(match[1]);
    }
    return out.slice(0,6);
  }
  function tokenPairs(pairs, address, chain) {
    return (Array.isArray(pairs) ? pairs : []).filter(p => equal(p.baseToken?.address,address) && (!chain || p.chainId === chain));
  }
  function distinctTokens(pairs) {
    const map = new Map();
    for (const p of Array.isArray(pairs) ? pairs : []) {
      if (!valid(p.baseToken?.address || '') || !p.chainId || !valid(p.pairAddress || '')) continue;
      const k=p.chainId+':'+(evmAddress(p.baseToken.address) ? p.baseToken.address.toLowerCase() : p.baseToken.address);
      if (!map.has(k) || (p.liquidity?.usd || 0) > (map.get(k).liquidity?.usd || 0)) map.set(k,p);
    }
    return [...map.values()];
  }
  function pinnedPair(pairs, selected) {
    return tokenPairs(pairs,selected.baseToken.address,selected.chainId).find(p => equal(p.pairAddress,selected.pairAddress)) || null;
  }
  function delta(previous, current, now) {
    if (!previous || !current || now-previous.time > 15*60000 || now < previous.time || !equal(previous.pair.pairAddress,current.pairAddress) || !equal(previous.pair.baseToken.address,current.baseToken.address) || previous.pair.chainId!==current.chainId) return null;
    const change=(a,b)=>a!==null && a!==undefined && b!==null && b!==undefined && Number(a)>0 && Number.isFinite(Number(b)) ? (Number(b)/Number(a)-1)*100 : null;
    return {price:change(previous.pair.priceUsd,current.priceUsd), liquidity:change(previous.pair.liquidity?.usd,current.liquidity?.usd)};
  }
  const api={solanaAddress,evmAddress,valid,equal,extract,queryName,suggestNames,tokenPairs,distinctTokens,pinnedPair,delta};
  if (typeof module==='object' && module.exports) module.exports=api;
  else root.ScreenCore=api;
})(typeof window==='object' ? window : this);
