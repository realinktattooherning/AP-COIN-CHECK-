(function (root) {
  'use strict';
  const num = v => v === null || v === undefined || typeof v === 'boolean' || (typeof v==='string'&&!v.trim()) || !Number.isFinite(Number(v)) ? null : Number(v);
  const identity = p => [p?.chainId, p?.pairAddress, p?.baseToken?.address];
  const equal = (a,b) => a.length===b.length && a.every((v,i)=>v===b[i]);
  function validCreator(v){
    if(typeof v!=='string'||!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v))return false;
    const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';let n=0n,bytes=0;
    for(const c of v)n=58n*n+BigInt(alphabet.indexOf(c));
    while(n>0n){bytes++;n>>=8n;}
    return bytes+(v.match(/^1*/)||[''])[0].length===32;
  }
  function creatorMatch(creator, chain, registry, decisionAt) {
    const result={status:'UNKNOWN',creator,source_url:registry?.source_url || null,score_effect:0,confirmed_rug:false};
    if(chain!=='solana') result.status='NOT_COVERED';
    else if(Date.parse(registry?.recorded_at)/1000<=decisionAt && Array.isArray(registry?.entries) && validCreator(creator)) {
      const entry=registry.entries.find(e=>e.chain===chain && e.address===creator);
      result.status=entry?'REPORTED_CREATOR_MATCH':'NO_LIST_MATCH';
      if(entry)result.source_row=entry.source_row;
    }
    return result;
  }
  function assess(history, selected, now, narrative, security, creatorReport) {
    const result={revision:'entry-research-1',status:'UNKNOWN',score_effect:0,buy_signal:false,drawdown_pct:null,observed_peak:null,observations:0,narrative:'UNKNOWN',reason:'INSUFFICIENT_HISTORY',peak_scope:'Observed same-pool prices before decision; not proven ATH',quote_basis:'Retrieval timestamps, not guaranteed exchange freshness or execution'};
    const ident=identity(selected);if(!ident.every(Boolean))return result;
    security=security||{};const scanAt=num(security.at),bound=equal([security.chain,security.pool,security.mint],ident);
    if(bound && scanAt!==null && now-scanAt>=0 && now-scanAt<=900 && security.risk_flags?.length)return {...result,status:'HOLD',reason:'RISK_FLAGS'};
    if(creatorReport?.status==='REPORTED_CREATOR_MATCH')return {...result,status:'HOLD',reason:'REPORTED_CREATOR_REVIEW'};
    const points=new Map();
    for(const row of history){const t=num(row.at);if(t!==null && now-86400<=t && t<=now && equal(identity(row.pair),ident)) {
      if(points.has(t) && JSON.stringify(points.get(t))!==JSON.stringify(row.pair)){result.reason='CONFLICTING_OBSERVATIONS';return result;}
      points.set(t,row.pair);
    }}
    const series=[...points].sort((a,b)=>a[0]-b[0]);result.observations=series.length;
    if(series.length<3 || series.at(-1)[0]-series[0][0]<60)return result;
    if(now-series.at(-1)[0]>120){result.reason='STALE_RETRIEVAL';return result;}
    if(series.some((b,i)=>i && b[0]-series[i-1][0]>900)){result.reason='OBSERVATION_GAP';return result;}
    const prices=series.map(([,p])=>num(p.priceUsd));
    if(prices.some(p=>p===null || p<=0)){result.reason='MISSING_PRICE';return result;}
    const peak=Math.max(...prices), drawdown=(1-prices.at(-1)/peak)*100;
    Object.assign(result,{observed_peak:peak,drawdown_pct:Math.round(drawdown*10000)/10000,observed_from:series[0][0],observed_to:series.at(-1)[0]});
    const liquidity=num(series.at(-1)[1].liquidity?.usd);
    if(liquidity===null){result.reason='LIQUIDITY_UNKNOWN';return result;}
    if(liquidity<=0){return {...result,status:'HOLD',reason:'NO_REPORTED_LIQUIDITY'};}
    if(!bound || scanAt===null || now-scanAt<0 || now-scanAt>900 || security.complete!==true){result.reason='RISK_SCAN_REQUIRED';return result;}
    if(!creatorReport || creatorReport.status==='UNKNOWN'){result.reason='CREATOR_CHECK_UNKNOWN';return result;}
    Object.assign(result,{status:'WATCHLIST',reason:'WAIT_FOR_PULLBACK'});if(drawdown<70-1e-9)return result;
    narrative=narrative||{};const checked=num(narrative.reviewed_at),published=num(narrative.source_at);
    if(narrative.chain===ident[0] && narrative.mint===ident[2] && narrative.state==='intact' && checked!==null && published!==null && published<=checked && checked<=now && now-checked<=86400 && narrative.source_url?.startsWith('https://') && narrative.note){
      return {...result,status:'REVIEW_CANDIDATE',narrative:'MANUALLY_ATTESTED',reason:'PULLBACK_AND_REVIEWED_NARRATIVE'};
    }
    return {...result,status:'WATCHLIST',reason:'NARRATIVE_EVIDENCE_REQUIRED'};
  }
  const api={creatorMatch,assess};
  if(typeof module==='object' && module.exports)module.exports=api;else root.EntryResearch=api;
})(typeof window==='object'?window:this);
