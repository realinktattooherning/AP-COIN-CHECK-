(function(root){
  'use strict';
  const num=v=>v===null||v===undefined||typeof v==='boolean'||(typeof v==='string'&&!v.trim())||!Number.isFinite(Number(v))?null:Number(v);
  const text=v=>typeof v==='string'&&!!v.trim();
  const httpsURL=v=>{if(typeof v!=='string')return false;try{const u=new URL(v);return u.protocol==='https:'&&!!u.hostname&&!u.username&&!u.password;}catch{return false;}};
  function assessContext(context,selected,now,security,creatorReport){
    const result={revision:'market-context-1',status:'UNKNOWN',reason:'CONTEXT_REQUIRED',score_effect:0,buy_signal:false,scam_signal:false,social_trend:'NOT_AUTOMATICALLY_VERIFIED',peer_performance:'NOT_AUTOMATICALLY_VERIFIED',migration:'NOT_CHECKED',validation:'UNVALIDATED_HYPOTHESIS'};
    const id=[selected?.chainId,selected?.pairAddress,selected?.baseToken?.address];now=num(now);
    if(!id.every(Boolean)||now===null)return result;
    security=security||{};const at=num(security.at),bound=security.chain===id[0]&&security.pool===id[1]&&security.mint===id[2],fresh=bound&&at!==null&&now-at>=0&&now-at<=900;
    if(fresh&&security.risk_flags?.length)return {...result,status:'HOLD',reason:'RISK_FLAGS'};
    if(creatorReport?.status==='REPORTED_CREATOR_MATCH')return {...result,status:'HOLD',reason:'REPORTED_CREATOR_REVIEW'};
    if(!context)return result;
    if(context.chain!==id[0]||context.pool!==id[1]||context.mint!==id[2])return {...result,reason:'CONTEXT_IDENTITY_MISMATCH'};
    const reviewed=num(context.reviewed_at);
    if(reviewed===null||now-reviewed<0||now-reviewed>86400)return {...result,reason:'CONTEXT_TIME_INVALID'};
    if(!text(context.theme))return {...result,reason:'THEME_REQUIRED'};
    for(const [kind,fields] of [['social',['note']],['comparison',['sample_scope','positive_examples','negative_or_missing_examples']]]){
      const evidence=context[kind]||{},observed=num(evidence.observed_at);
      if(!httpsURL(evidence.source_url)||observed===null||now-observed<0||now-observed>86400||observed>reviewed||!fields.every(k=>text(evidence[k])))return {...result,reason:kind==='social'?'SOCIAL_EVIDENCE_REQUIRED':'BALANCED_COMPARISON_REQUIRED'};
    }
    if(!fresh||security.complete!==true)return {...result,reason:'RISK_SCAN_REQUIRED'};
    if(!['NO_LIST_MATCH','NOT_COVERED'].includes(creatorReport?.status))return {...result,reason:'CREATOR_CHECK_UNKNOWN'};
    return {...result,status:'MANUALLY_DOCUMENTED',reason:'CONTEXT_RECORDED',theme:context.theme.trim(),reviewed_at:reviewed,social_observed_at:num(context.social.observed_at),comparison_observed_at:num(context.comparison.observed_at)};
  }
  const api={assessContext};if(typeof module==='object'&&module.exports)module.exports=api;else root.MarketContext=api;
})(typeof window==='object'?window:this);
