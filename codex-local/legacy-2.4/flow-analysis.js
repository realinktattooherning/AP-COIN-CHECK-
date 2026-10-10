// Trade-flow challenger 2.3: warnings are associations, never proof of scam.
function analyzeTradeFlows(trades) {
  const valid = trades.map(t => ({...t, _time: Date.parse(t.block_timestamp)/1000, _usd: Number(t.volume_in_usd || 0)}))
    .filter(t => Number.isFinite(t._time) && Number.isFinite(t._usd) && t._usd>0 && t.tx_from_address && t.tx_hash).sort((a,b)=>a._time-b._time);
  const seen=new Set(), tr=[];
  for(const t of valid){const key=JSON.stringify([t.tx_hash,t.kind,t.tx_from_address,t.from_token_amount??null,t.to_token_amount??null,t._usd]);if(!seen.has(key)){tr.push(t);seen.add(key);}}
  const used=new Set(), mirrors=[], splits=[], cycles=[], buys=tr.map((t,i)=>i).filter(i=>tr[i].kind==='buy'&&tr[i]._usd>=5);
  for(const i of buys){const b=tr[i], candidates=new Map();for(let j=i+1;j<tr.length;j++){
    const s=tr[j];if(s._time-b._time>60)break;
    if(used.has(j)||s.kind!=='sell'||s.tx_hash===b.tx_hash||s.tx_from_address===b.tx_from_address)continue;
    if(j<i+5&&Math.abs(s._usd-b._usd)<=Math.max(.02*b._usd,.5)){mirrors.push({buy:b.tx_hash,sells:[s.tx_hash],seller:s.tx_from_address});used.add(j);break;}
    const group=candidates.get(s.tx_from_address)||[];group.push(j);candidates.set(s.tx_from_address,group);
    if(group.length>=2&&group.length<=4&&new Set(group.map(k=>tr[k].tx_hash)).size===group.length){const total=group.reduce((n,k)=>n+tr[k]._usd,0);
      if(Math.abs(total-b._usd)<=Math.max(.02*b._usd,.5)){splits.push({buy:b.tx_hash,sells:group.map(k=>tr[k].tx_hash),seller:s.tx_from_address,buy_usd:b._usd,sell_usd:total});group.forEach(k=>used.add(k));break;}}
  }}
  const inventory=new Map();
  for(const t of tr){const kind=t.kind,mint=kind==='buy'?t.to_token_address:t.from_token_address,amount=Number((kind==='buy'?t.to_token_amount:t.from_token_amount)||0);
    if(!mint||!Number.isFinite(amount)||amount<=0)continue;
    const key=JSON.stringify([t.tx_from_address,mint]);let bag=inventory.get(key);
    if(kind==='buy'){if(!bag||t._time-bag.start>120||bag.sold>0){bag={start:t._time,bought:0,sold:0,hashes:[]};inventory.set(key,bag);}bag.bought+=amount;bag.hashes.push(t.tx_hash);}
    else if(kind==='sell'&&bag&&t._time-bag.start>=0&&t._time-bag.start<=120){bag.sold+=amount;bag.hashes.push(t.tx_hash);
      if(bag.sold>=.95*bag.bought&&bag.sold<=1.05*bag.bought&&new Set(bag.hashes).size>=2){cycles.push({wallet:t.tx_from_address,mint,hashes:[...bag.hashes],bought:bag.bought,sold:bag.sold});inventory.delete(key);}}
  }
  const wallets=new Map();for(const c of cycles)wallets.set(c.wallet,(wallets.get(c.wallet)||0)+1);
  return {valid_trades:tr.length,invalid_or_duplicate_trades:trades.length-tr.length,buys:buys.length,mirrors,splits,cycles,repeated_cycle_wallets:[...wallets].filter(([w,n])=>n>=3).map(([w])=>w).sort(),window_seconds:60,cycle_window_seconds:120};
}
if(typeof module!=='undefined')module.exports={analyzeTradeFlows};
