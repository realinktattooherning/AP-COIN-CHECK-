/* Shared advisory UI for the ordinary scan and stream panel. No orders or score edits. */
(() => {
  'use strict';
  const R=EntryResearch, streamPage=!!document.getElementById('selected');
  const host=document.createElement('section');host.className='research-box';host.hidden=true;
  host.innerHTML=`<p class="eyebrow">KØBSRESEARCH · 3.5 · FORSØGSREGLER</p><h2>Watchlist før beslutning</h2>
    <p data-wallet role="status">Creator: afventer data.</p><p data-drawdown>Observeret kursfald: ukendt.</p><p data-state></p>
    <p class="hint">70 % fald er en hypotese til research. Det er ikke et købssignal. Toppen gælder kun målinger fra samme pool i denne åbne session, højst 24 timer; den er ikke nødvendigvis ATH.</p>
    <details><summary>Dokumentér narrativet manuelt</summary><p class="hint">Læs den oprindelige kilde og kontrollér, at den stadig er relevant for netop denne token. Et X-link alene er ikke dokumentation for det.</p>
      <label>Kilde (HTTPS)<input data-source type="url" placeholder="https://…"></label>
      <label>Kildens offentliggørelse<input data-published type="datetime-local"></label>
      <label>Hvad er stadig relevant?<textarea data-note rows="2" maxlength="1000"></textarea></label>
      <button data-review type="button">Jeg har kontrolleret kilden · gem vurdering</button><p data-evidence class="hint">Ingen vurdering gemt. Kun denne session.</p>
    </details>
    <h3>Hvad virker i markedet lige nu?</h3><p data-context-state role="status">Markedskontekst: ukendt.</p>
    <p class="hint">Sammenlign samme narrativ med både vindere og tabere. Dokumentér aktuel omtale af memet. Et enkelt personligt feed viser ikke hele markedet; migration er ingen sikkerhedsgaranti.</p>
    <details data-context-form><summary>Dokumentér markedskontekst manuelt</summary>
      <label>Meme eller narrativ<input data-theme maxlength="160" placeholder="Hvilket konkret tema forbinder dem?"></label>
      <label>Kilde til aktuel omtale (HTTPS)<input data-social-url type="url" placeholder="https://…"></label>
      <label>Hvornår observerede du omtalen?<input data-social-at type="datetime-local"></label>
      <label>Hvad viser omtalen, og hvad ved vi ikke?<textarea data-social-note rows="2" maxlength="1000"></textarea></label>
      <label>Kilde til sammenligningen (HTTPS)<input data-peer-url type="url" placeholder="https://…"></label>
      <label>Hvornår observerede du sammenligningen?<input data-peer-at type="datetime-local"></label>
      <label>Hvilke coins, periode og udvælgelse?<textarea data-peer-scope rows="2" maxlength="1000" placeholder="Brug fulde adresser og samme måleperiode. Undgå kun at udvælge vindere."></textarea></label>
      <label>Positive eksempler eller ingen observeret<textarea data-peer-positive rows="2" maxlength="1000"></textarea></label>
      <label>Tabere, flade forløb og manglende data<textarea data-peer-negative rows="2" maxlength="1000" placeholder="Skriv også, hvis du ikke har undersøgt dem."></textarea></label>
      <button data-context-save type="button">Gem min kildevurdering</button>
      <button data-context-export type="button" disabled>Hent researchnotat</button>
      <p data-context-evidence class="hint">Kun denne session. X/TikTok og sammenligningsresultater læses ikke automatisk. Ukendt omtale betyder ikke scam.</p>
    </details>
    <p><a href="https://x.com/XiLeeTrades/status/2108559638429851896" target="_blank" rel="noopener">Kilde til markedsreglen ↗</a></p>
    <p class="hint">En rapporteret creator kræver nærmere kontrol. Intet match er ingen sikkerhedsgaranti. Scoren og den eksisterende risikoanalyse ændres ikke.</p>
    <p><a data-wallet-source target="_blank" rel="noopener">Kilde til creator-listen ↗</a> · <a href="https://x.com/bystevenr/status/2108400638350750118" target="_blank" rel="noopener">Kilde til strategihypotesen ↗</a></p>`;
  if(streamPage)document.getElementById('risk-analysis').before(host);
  else document.getElementById('out').before(host);
  const $=selector=>host.querySelector(selector);
  let selected=null,history=[],security=null,narrative=null,creator=null,registry=null,registryReady=false,marketContext=null;
  const registryPromise=fetch('reported-creators.json',{credentials:'omit'}).then(r=>{if(!r.ok)throw Error('list');return r.json();}).then(r=>{registry=r;registryReady=true;render();}).catch(()=>{registryReady=true;render();});
  const key=p=>[p?.chainId,p?.pairAddress,p?.baseToken?.address].join(':');
  function clearContext(){marketContext=null;for(const el of host.querySelectorAll('[data-context-form] input,[data-context-form] textarea'))el.value='';$('[data-context-export]').disabled=true;$('[data-context-evidence]').textContent='Kun denne session. X/TikTok og sammenligningsresultater læses ikke automatisk. Ukendt omtale betyder ikke scam.';}
  function reset(pair){selected=pair;history=[];security=null;narrative=null;creator=null;
    clearContext();
    $('[data-source]').value='';$('[data-published]').value='';$('[data-note]').value='';$('[data-evidence]').textContent='Ingen vurdering gemt. Kun denne session.';
  }
  function observe(pair,at){if(!selected||key(pair)!==key(selected))reset(pair);
    history.push({at,pair:JSON.parse(JSON.stringify(pair))});history=history.filter(x=>x.at>=at-86400).slice(-4000);render();
  }
  const reasonText={INSUFFICIENT_HISTORY:'Afventer mindst tre målinger fordelt over mindst ét minut.',STALE_RETRIEVAL:'Seneste opslag er for gammelt. Opdatér markedstal.',OBSERVATION_GAP:'Der er et hul på over 15 minutter i målingerne. Ingen sammenhængende vurdering.',MISSING_PRICE:'En pris mangler i måleserien.',CONFLICTING_OBSERVATIONS:'Modstridende målinger på samme tidspunkt.',LIQUIDITY_UNKNOWN:'Likviditeten er ukendt.',NO_REPORTED_LIQUIDITY:'Stop research: ingen rapporteret likviditet.',RISK_FLAGS:'Afvent: den fulde scanner har røde flag. Et narrativ tilsidesætter dem ikke.',REPORTED_CREATOR_REVIEW:'Afvent: creator matcher den rapporterede liste. Undersøg launch- og salgstransaktioner.',RISK_SCAN_REQUIRED:'Afventer et komplet, nyligt risikotjek for samme token og pool.',CREATOR_CHECK_UNKNOWN:'Creator eller adresseliste kunne ikke kontrolleres.',WAIT_FOR_PULLBACK:'Watchlist: det observerede fald er under 70 %.',NARRATIVE_EVIDENCE_REQUIRED:'Stort observeret fald; narrativets fortsatte relevans er ikke dokumenteret.',PULLBACK_AND_REVIEWED_NARRATIVE:'Researchkandidat: stort observeret fald og din manuelle vurdering er gemt. Ingen valideret købsanbefaling.'};
  function render(){
    if(!selected)return;host.hidden=false;
    const now=Date.now()/1000,match=R.creatorMatch(creator,selected.chainId,registry,now);
    const wallet=$('[data-wallet]');wallet.replaceChildren();
    const labels={UNKNOWN:registryReady?'Creator-kontrol: ukendt.':'Henter creator-listen…',NOT_COVERED:'Creator-listen dækker kun Solana.',NO_LIST_MATCH:'Creator: intet præcist match i den eksterne liste. Andre wallets og forbindelser er ikke undersøgt.',REPORTED_CREATOR_MATCH:'ADVARSEL: den oplyste creator står på den eksternt rapporterede deployer-liste. Påstandene er ikke bekræftede rug pulls.'};
    wallet.textContent=labels[match.status];
    if(creator&&selected.chainId==='solana'&&ScreenCore.solanaAddress(creator)){
      const a=document.createElement('a');a.href='https://solscan.io/account/'+encodeURIComponent(creator);a.textContent=creator;a.target='_blank';a.rel='noopener';a.className='research-address';wallet.append(a);
    }
    host.dataset.creatorStatus=match.status;$('[data-wallet-source]').href='https://x.com/bandosei/status/2108215385397059797';
    const result=R.assess(history,selected,now,narrative,security,match);
    host.dataset.researchStatus=result.status;
    $('[data-drawdown]').textContent=result.drawdown_pct===null?'Observeret kursfald: ukendt.':`Fald fra observeret top: ${result.drawdown_pct.toFixed(1)} % · ${result.observations} målinger.`;
    $('[data-state]').textContent=reasonText[result.reason]||'Ukendt';
    const contextResult=MarketContext.assessContext(marketContext,selected,now,security,match);
    host.dataset.contextStatus=contextResult.status;
    const contextReasons={CONTEXT_REQUIRED:'Markedskontekst: ukendt. Tilføj kilder til omtale og en bred sammenligning.',CONTEXT_IDENTITY_MISMATCH:'Kilderne tilhører en anden token eller pool.',CONTEXT_TIME_INVALID:'Vurderingen er for gammel eller har et ugyldigt tidspunkt.',THEME_REQUIRED:'Angiv det konkrete meme eller narrativ.',SOCIAL_EVIDENCE_REQUIRED:'Aktuel omtale: tilføj kilde, tidspunkt inden for 24 timer og din observation.',BALANCED_COMPARISON_REQUIRED:'Sammenligning: dokumentér udvælgelse, positive eksempler samt tabere eller datamangler med en aktuel kilde.',RISK_FLAGS:'Afvent: risikoflag kan ikke tilsidesættes af popularitet.',REPORTED_CREATOR_REVIEW:'Afvent: creator matcher den rapporterede liste.',RISK_SCAN_REQUIRED:'Kilder gemt; afventer et komplet, nyligt risikotjek af samme token og pool.',CREATOR_CHECK_UNKNOWN:'Kilder gemt; creator-kontrol er ukendt.',CONTEXT_RECORDED:'Manuel markedskontekst dokumenteret. Omtale og resultater er ikke automatisk verificeret; dette er ingen købsanbefaling.'};
    $('[data-context-state]').textContent=contextReasons[contextResult.reason]||'Markedskontekst: ukendt.';
  }
  $('[data-context-save]').onclick=()=>{
    if(!selected)return;
    const candidate={chain:selected.chainId,pool:selected.pairAddress,mint:selected.baseToken.address,reviewed_at:Date.now()/1000,
      theme:$('[data-theme]').value.trim(),social:{source_url:$('[data-social-url]').value.trim(),observed_at:new Date($('[data-social-at]').value).getTime()/1000,note:$('[data-social-note]').value.trim()},
      comparison:{source_url:$('[data-peer-url]').value.trim(),observed_at:new Date($('[data-peer-at]').value).getTime()/1000,sample_scope:$('[data-peer-scope]').value.trim(),positive_examples:$('[data-peer-positive]').value.trim(),negative_or_missing_examples:$('[data-peer-negative]').value.trim()}};
    marketContext=candidate;$('[data-context-export]').disabled=false;
    $('[data-context-evidence]').textContent='Din egen kildevurdering er gemt i denne session. Se status ovenfor; et gemt eller eksporteret notat er ikke en verificering.';render();
  };
  $('[data-context-export]').onclick=()=>{
    if(!selected||!marketContext)return;
    const now=Date.now()/1000,match=R.creatorMatch(creator,selected.chainId,registry,now);
    const snapshot={exported_at:now,evidence:marketContext,assessment:MarketContext.assessContext(marketContext,selected,now,security,match),security,creator_report:match,provenance:'Manual user notes; source contents and outcomes not automatically verified. No order or performance claim.'};
    const url=URL.createObjectURL(new Blob([JSON.stringify(snapshot,null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download='dk-market-context-'+Math.floor(now)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  $('[data-review]').onclick=()=>{
    if(!selected)return;const url=$('[data-source]').value.trim(),sourceAt=new Date($('[data-published]').value).getTime()/1000,now=Date.now()/1000,note=$('[data-note]').value.trim();
    let validURL=false;try{validURL=new URL(url).protocol==='https:';}catch{}
    if(!validURL||!Number.isFinite(sourceAt)||sourceAt>now||!note){$('[data-evidence]').textContent='Angiv en HTTPS-kilde, en offentliggørelsesdato i fortiden og din begrundelse.';return;}
    narrative={state:'intact',chain:selected.chainId,mint:selected.baseToken.address,source_url:url,source_at:sourceAt,reviewed_at:now,note};
    $('[data-evidence]').textContent='Din manuelle vurdering er gemt '+new Date().toLocaleTimeString('da-DK')+'. Kildens indhold er ikke automatisk verificeret.';render();
  };
  function scan(data){if(!data?.pair||!data.mint||data.pair.baseToken?.address!==data.mint)return;
    if(streamPage && (!selected||key(data.pair)!==key(selected)))return;
    if(!streamPage&&(!selected||key(data.pair)!==key(selected)))reset(data.pair);
    creator=data.creator||null;security=data.security;
    if(!streamPage && !history.some(p=>p.at===data.at))observe(data.pair,data.at);else render();
  }
  window.addEventListener('dk-research-reset',()=>{selected=null;history=[];security=null;creator=null;narrative=null;clearContext();host.hidden=true;});
  window.addEventListener('dk-research-scan',e=>{if(!streamPage)scan(e.detail);});
  window.addEventListener('dk-market-observation',e=>{if(streamPage)observe(e.detail.pair,e.detail.at);});
  window.addEventListener('dk-market-missing',()=>{if(selected)observe({...selected,priceUsd:null},Date.now()/1000);});
  window.addEventListener('message',event=>{
    if(!streamPage||event.source!==document.getElementById('risk-frame').contentWindow||event.origin!==location.origin||event.data?.type!=='dk-research-scan')return;
    scan(event.data.detail);
  });
  const freshnessTimer=setInterval(render,30000);
  window.addEventListener('pagehide',()=>clearInterval(freshnessTimer));
})();
