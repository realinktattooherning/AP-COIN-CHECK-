(() => {
  'use strict';
  const $=id=>document.getElementById(id), C=ScreenCore;
  let stream=null, image=null, crop=null, drag=null, worker=null, busy=false, epoch=0;
  let choice=null, previous=null, timer=null, watching=false, watchEpoch=0, refreshBusy=false, sourceLabel='', ocrOriginal='';
  const fullCanvas=document.createElement('canvas');
  const ctx=$('preview').getContext('2d');
  const status=(s,error=false)=>{ $('status').textContent=s; $('status').classList.toggle('error',error); };
  const money=n=>n===null || n===undefined || !Number.isFinite(Number(n)) ? 'Ukendt' : new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:Number(n)<1?8:2,notation:Number(n)>=10000?'compact':'standard'}).format(Number(n));
  const pct=n=>n===null || n===undefined || !Number.isFinite(Number(n)) ? 'Ukendt' : `${Number(n)>0?'+':''}${Number(n).toFixed(1)}%`;
  function element(tag,text,klass){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(klass)el.className=klass;return el;}
  function setBusy(on){busy=on;['ask','use-text','upload','question','connect','from-tab'].forEach(id=>$(id).disabled=on);$('capture').disabled=on||!stream;}
  function stopWatch(){watching=false;watchEpoch++;clearTimeout(timer);timer=null;$('watch').textContent='Følg denne pool · 30 sek.';$('watch-state').textContent='Overvågning er slukket. Ingen skærmpopups eller handler.';}
  function clearAnswer(){window.dispatchEvent(new Event("dk-research-reset"));epoch++;stopWatch();choice=null;previous=null;$('selected').hidden=true;$('results').replaceChildren();$('risk-frame').src='about:blank';}
  function stopShare(){if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;$('feed').srcObject=null;$('capture').disabled=true;$('stop').hidden=true;$('source-state').textContent='Ikke forbundet';$('connect').textContent='Vælg stream-fane';}
  $('stop').onclick=()=>{stopShare();status('Deling stoppet. Det sidste billede kan stadig analyseres.');};
  $('connect').onclick=async()=>{
    if(!navigator.mediaDevices?.getDisplayMedia){status('Skærmdeling er ikke tilgængelig her. Åbn HTTPS-siden i Chrome, eller vælg et billede.',true);return;}
    try{
      const next=await navigator.mediaDevices.getDisplayMedia({video:{displaySurface:'browser'},audio:false});
      stopShare();clearAnswer();crop=null;stream=next;
      const capturedStream=next;
      next.getVideoTracks()[0].addEventListener('ended',()=>{if(stream===capturedStream){stopShare();status('Skærmdelingen sluttede. Seneste billede er bevaret.');}});
      $('feed').srcObject=next;await $('feed').play();
      $('capture').disabled=false;$('stop').hidden=false;$('connect').textContent='Skift fane';$('source-state').textContent='Fane forbundet';
      status('Forbundet. Skriv fx RIPS, gi mig adresse og analyse — eller tryk Tag billede.');
    }catch(err){status(err.name==='NotAllowedError'?'Ingen skærm blev delt. Du kan prøve igen eller vælge et billede.':'Skærmdeling kunne ikke starte: '+err.message,true);}
  };
  function draw(){
    if(!image)return;
    const can=$('preview');can.width=fullCanvas.width;can.height=fullCanvas.height;ctx.drawImage(fullCanvas,0,0);
    if(crop){ctx.save();ctx.fillStyle='rgba(0,0,0,.42)';ctx.beginPath();ctx.rect(0,0,can.width,can.height);ctx.rect(crop.x,crop.y,crop.w,crop.h);ctx.fill('evenodd');ctx.strokeStyle='#ff3d59';ctx.lineWidth=Math.max(3,can.width/400);ctx.strokeRect(crop.x,crop.y,crop.w,crop.h);ctx.restore();}
  }
  function setImage(src,w,h,label,keepCrop=false){
    clearAnswer();if(!keepCrop || w!==fullCanvas.width || h!==fullCanvas.height)crop=null;
    // Limit memory while preserving a typical full-HD stream at native resolution.
    const scale=Math.min(1,3000/Math.max(w,h));
    fullCanvas.width=Math.round(w*scale);fullCanvas.height=Math.round(h*scale);fullCanvas.getContext('2d').drawImage(src,0,0,fullCanvas.width,fullCanvas.height);
    image=true;sourceLabel=label;$('preview-box').hidden=false;$('captured-at').textContent=label+' · '+new Date().toLocaleTimeString('da-DK');$('ocr-text').value='';ocrOriginal='';draw();
  }
  function takeImage(){if(!stream || !$('feed').videoWidth)throw new Error('Streamen er ikke klar. Vælg fanen igen.');setImage($('feed'),$('feed').videoWidth,$('feed').videoHeight,'Nyt skærmbillede',true);}
  $('capture').onclick=()=>{try{takeImage();status('Billede taget. Afgræns evt. adressen med musen og tryk Aflæs & analysér.');}catch(e){status(e.message,true);}};
  async function importImage(file){
    if(busy)return;
    if(!file || !/^image\/(png|jpeg|webp)$/.test(file.type) || file.size>20*1024*1024){status('Vælg PNG, JPG eller WebP under 20 MB.',true);return;}
    setBusy(true);clearAnswer();status('Indlæser billedet…');
    try{
      const bitmap=await createImageBitmap(file);
      stopShare();setImage(bitmap,bitmap.width,bitmap.height,'Indsat billede');bitmap.close();status('Billedet er klar. Afgræns evt. adressen, og stil dit spørgsmål.');
    }catch{status('Billedet kunne ikke læses. Prøv PNG eller JPG.',true);}finally{setBusy(false);}
  }
  $('upload').onchange=e=>{importImage(e.target.files[0]);e.target.value='';};
  document.addEventListener('paste',e=>{const f=[...(e.clipboardData?.files||[])].find(x=>x.type.startsWith('image/'));if(f){e.preventDefault();importImage(f);}});
  function point(e){const r=$('preview').getBoundingClientRect();return {x:Math.max(0,Math.min(fullCanvas.width,(e.clientX-r.left)*fullCanvas.width/r.width)),y:Math.max(0,Math.min(fullCanvas.height,(e.clientY-r.top)*fullCanvas.height/r.height))};}
  $('preview').onpointerdown=e=>{if(!image||busy)return;drag=point(e);$('preview').setPointerCapture(e.pointerId);};
  $('preview').onpointermove=e=>{if(!drag)return;const p=point(e);crop={x:Math.min(p.x,drag.x),y:Math.min(p.y,drag.y),w:Math.abs(p.x-drag.x),h:Math.abs(p.y-drag.y)};draw();};
  $('preview').onpointerup=()=>{if(!drag)return;drag=null;if(!crop||crop.w<12||crop.h<12)crop=null;draw();};
  $('preview').onpointercancel=()=>{drag=null;};
  $('reset-crop').onclick=()=>{crop=null;draw();};
  async function ocr(){
    if(!worker){status('Starter lokal billedaflæsning… Første gang hentes sprogmodellen fra denne side.');
      worker=await Tesseract.createWorker('eng',1,{workerPath:new URL('vendor/ocr/worker.min.js',location.href).href,corePath:new URL('vendor/ocr/core/',location.href).href,langPath:new URL('vendor/ocr/lang',location.href).href,workerBlobURL:false,logger:m=>{if(m.status==='recognizing text')status('Aflæser billede lokalt · '+Math.round(m.progress*100)+'%');}});
      await worker.setParameters({tessedit_pageseg_mode:'11',preserve_interword_spaces:'1'});
    }
    const c=crop||{x:0,y:0,w:fullCanvas.width,h:fullCanvas.height};
    const input=document.createElement('canvas');const scale=Math.min(2,3200/Math.max(c.w,c.h));input.width=Math.max(1,Math.round(c.w*scale));input.height=Math.max(1,Math.round(c.h*scale));input.getContext('2d').drawImage(fullCanvas,c.x,c.y,c.w,c.h,0,0,input.width,input.height);
    let {data}=await worker.recognize(input,{}, {text:true,blocks:true});
    // Re-read long identifier lines independently. Each result remains an OCR reading,
    // never a repaired address; different readings still require exact public token matches.
    const lines=(data.blocks||[]).flatMap(b=>(b.paragraphs||[]).flatMap(p=>p.lines||[])).filter(l=>/[A-Za-z0-9]{24,}/.test(l.text||'')).slice(0,3);
    const extra=[];
    for(const line of lines){
      const box=line.bbox,pad=14;
      const left=Math.max(0,box.x0-pad),top=Math.max(0,box.y0-pad);
      const rectangle={left,top,width:Math.min(input.width,box.x1+pad)-left,height:Math.min(input.height,box.y1+pad)-top};
      await worker.setParameters({tessedit_pageseg_mode:'7',tessedit_char_whitelist:/0x[0-9a-f]/i.test(line.text)?'0123456789abcdefABCDEFx':'123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'});
      const second=await worker.recognize(input,{rectangle});
      if(C.extract(second.data.text).length&&!data.text.includes(second.data.text.trim()))extra.push(second.data.text.trim());
    }
    await worker.setParameters({tessedit_pageseg_mode:'11',tessedit_char_whitelist:''});
    if(extra.length)data.text+='\n\nEkstra linjeaflæsning:\n'+extra.join('\n');
    $('ocr-text').value=data.text;ocrOriginal=data.text;return data.text;
  }
  async function json(url){const response=await fetch(url,{signal:AbortSignal.timeout(15000),cache:'no-store',credentials:'omit'});if(!response.ok)throw new Error('Datakilden svarede '+response.status);return response.json();}
  async function resolve(item){
    if(item.kind==='pair'){
      const data=await json(`https://api.dexscreener.com/latest/dex/pairs/${encodeURIComponent(item.chain)}/${encodeURIComponent(item.address)}`);
      return (data.pairs||[]).filter(p=>p.chainId===item.chain&&C.equal(p.pairAddress,item.address)&&C.valid(p.baseToken?.address||''));
    }
    const data=await json('https://api.dexscreener.com/latest/dex/tokens/'+encodeURIComponent(item.address));return C.tokenPairs(data.pairs,item.address,item.chain);
  }
  function rawCandidate(item,label,failed){
    const box=element('article',undefined,'panel candidate');box.append(element('h3',item.kind==='pair'?'Aflæst pooladresse':'Aflæst adresse · token ikke bekræftet'),element('p',label+(failed?' · Opslag fejlede.':' · Ingen præcis token-match i datakilden.')),element('code',item.address,'address'),element('p','En fuld adresse kan også være en wallet. Kontrollér tegnene på billedet. Manglende data er ikke et scam-signal.'));
    const b=element('button','Kopiér aflæst adresse');b.onclick=()=>copy(item.address,b);box.append(b);$('results').append(box);
  }
  function candidate(pair,evidence,unconfirmed=false){
    const box=element('article',undefined,'panel candidate');box.append(element('h3',`${pair.baseToken.symbol||'Token'} · ${pair.chainId}`),element('p',`${pair.baseToken.name||''} · Likviditet ${money(pair.liquidity?.usd)}`),element('code',pair.baseToken.address,'address'),element('p',evidence));
    if(unconfirmed)box.append(element('p','Muligt navnematch — adressen er IKKE aflæst fra billedet. Sammenlign navn, netværk og pool.'));
    const b=element('button','Vælg og analysér');b.onclick=()=>select(pair,evidence);box.append(b);$('results').append(box);
  }
  function offerName(name){
    const box=element('article',undefined,'panel candidate');box.append(element('h3','Ingen sikker tokenidentifikation'),element('p','En skjult, forkortet eller sløret adresse kan ikke genskabes sikkert. Søg på et navn for at se mulige matches.'));
    const field=element('input');field.type='text';field.maxLength=40;field.value=name;field.setAttribute('aria-label','Tokennavn til søgning');field.className='name-search';
    const b=element('button','Find mulige navnematches');b.onclick=()=>searchName(field.value.trim());box.append(field,b);$('results').append(box);
    if(!name){const names=C.suggestNames($('ocr-text').value);if(names.length){box.append(element('p','Mulige tickere i billedteksten (kan også være chat/UI):'));const buttons=element('div',undefined,'actions');for(const n of names){const button=element('button','Søg '+n);button.onclick=()=>searchName(n);buttons.append(button);}box.append(buttons);}}
  }
  async function searchName(name){
    if(!name||name.length>40)return;clearAnswer();const id=epoch;setBusy(true);status('Søger efter mulige matches til '+name+'…');
    try{
      const data=await json('https://api.dexscreener.com/latest/dex/search?q='+encodeURIComponent(name));if(id!==epoch)return;
      const clean=s=>String(s||'').replace(/^\$/,'').toLowerCase();
      const pairs=C.distinctTokens(data.pairs).filter(p=>clean(p.baseToken.symbol)===clean(name)||clean(p.baseToken.name)===clean(name)).slice(0,10);
      pairs.forEach(p=>candidate(p,'Valgt fra navnesøgning: '+name,true));
      status(pairs.length?`${pairs.length} mulige matches. Vælg kun efter at have sammenlignet med streamen.`:'Ingen præcise navnematches. Prøv det fulde tokennavn eller en adresse.');if(!pairs.length)offerName(name);
    }catch(e){if(id===epoch){status('Søgningen fejlede: '+e.message,true);offerName(name);}}finally{setBusy(false);}
  }
  async function analyze(useText=false){
    if(busy)return;
    const explicit=C.extract($('question').value), name=C.queryName($('question').value);
    clearAnswer();setBusy(true);
    try{
      let text,label;
      if(explicit.length){text=$('question').value;label='Manuelt indtastet adresse';}
      else if(useText){text=$('ocr-text').value;label=text===ocrOriginal && ocrOriginal?'Aflæst fra '+sourceLabel.toLowerCase():'Manuelt indtastet / rettet tekst';}
      else if(stream||image){if(stream)takeImage();text=await ocr();label='Aflæst fra '+sourceLabel.toLowerCase();}
      else{setBusy(false);if(name){await searchName(name);return;}offerName('');status('Tilføj et billede, skriv en adresse eller fx RIPS, gi mig adresse og analyse.');return;}
      const id=epoch, items=C.extract(text);
      if(!items.length){if(name){setBusy(false);await searchName(name);return;}offerName(name);status('Ingen fuld gyldig adresse aflæst. Ret teksten, afgræns billedet eller søg på navnet.');return;}
      status(`Fandt ${items.length} adresse${items.length===1?'':'r'}. Kontrollerer token og netværk…`);
      const matches=[];
      for(const item of items.slice(0,8)){
        try{const pairs=C.distinctTokens(await resolve(item));if(id!==epoch)return;
          if(!pairs.length)rawCandidate(item,label,false);
          for(const p of pairs){
            const evidence=item.kind==='pair'?`${label}: pool ${item.address}. Tokenadressen er slået op fra denne pool.`:`${label}; præcist tokenmatch i DexScreener. Kontrollér stadig OCR-tegnene.`;
            if(!matches.some(x=>x.p.chainId===p.chainId&&C.equal(x.p.baseToken.address,p.baseToken.address)))matches.push({p,evidence});
          }
        }catch{if(id!==epoch)return;rawCandidate(item,label,true);}
      }
      const relevant=name?matches.filter(x=>[x.p.baseToken.symbol,x.p.baseToken.name].some(s=>String(s).toLowerCase()===name.toLowerCase())):matches;
      if(relevant.length===1){select(relevant[0].p,relevant[0].evidence);status('Adresse fundet. Markedstal og risikoanalyse vises nedenfor.');}
      else if(relevant.length>1){relevant.forEach(x=>candidate(x.p,x.evidence));status('Flere tokens fundet. Vælg den, der matcher streamen.');}
      else{if(name){offerName(name);status('De aflæste adresser matcher ikke '+name+'. Vælg ikke en anden coin på grund af navnet alene.');}else status('Aflæste adresser vises nedenfor. Tokenidentiteten kunne ikke bekræftes.',true);}
    }catch(e){status('Billedaflæsning fejlede: '+e.message+'. Prøv at afgrænse billedet eller indsætte adressen.',true);if(worker){await worker.terminate().catch(()=>{});worker=null;}}
    finally{setBusy(false);}
  }
  // exact address from the open tab itself (URL, coin links, title, page text such as the stream chat): no OCR misreads
  $('from-tab').onclick=async()=>{
    if(busy)return;clearAnswer();setBusy(true);const id=epoch;
    try{
      let [tab]=await chrome.tabs.query({active:true,lastFocusedWindow:true});
      if(!tab){status('Ingen aktiv fane fundet.',true);return;}
      let origin='';try{origin=new URL(tab.url).origin+'/*';}catch{}
      status('Læser fanen '+(tab.title||'')+' …');
      let pg=await CoinFinder.readTab(tab);
      // the panel may not hold activeTab for this tab: ask once for read access to just this site
      if(!pg.read&&origin&&/^https?:/.test(origin)&&await chrome.permissions.request({origins:[origin]}).catch(()=>false))pg=await CoinFinder.readTab(tab);
      const list=await CoinFinder.resolveCandidates(CoinFinder.pageCandidates(pg));if(id!==epoch)return;
      const where=pg.read?'fanens link, titel og tekst':'kun fanens adresse (siden kunne ikke læses)';
      if(!list.length){offerName('');status('Ingen token-adresse fundet i '+where+'. Brug skærmbillede/OCR eller skriv navnet.',true);return;}
      const ev=x=>`Fundet på fanen (${where}): ${tab.url}. Præcis adresse, ikke OCR.`;
      if(list.length===1||list[0].pts>=100){select(list[0].pair,ev(list[0]));status('Adresse fundet på fanen. Markedstal og risikoanalyse vises nedenfor.');}
      else{list.slice(0,6).forEach(x=>candidate(x.pair,ev(x)));status(list.length+' tokens nævnt på fanen. Den øverste nævnes oftest; vælg den der matcher streamen.');}
    }catch(e){status('Fanen kunne ikke læses: '+e.message,true);}finally{setBusy(false);}
  };
  $('question-form').onsubmit=e=>{e.preventDefault();analyze();};$('use-text').onclick=()=>analyze(true);
  function select(pair,evidence){
    stopWatch();epoch++;choice=pair;previous={pair,time:Date.now()};$('results').replaceChildren();$('selected').hidden=false;
    $('token-name').textContent=(pair.baseToken.symbol||'Token')+' · '+pair.chainId;$('token-address').textContent=pair.baseToken.address;$('evidence').textContent=evidence;
    $('pump').hidden=!(pair.chainId==='solana'&&(pair.baseToken.address.endsWith('pump')||pair.dexId==='pumpswap'||pair.dexId==='pumpfun'));
    $('pump').href='https://pump.fun/coin/'+encodeURIComponent(pair.baseToken.address);
    $('dex').href='https://dexscreener.com/'+encodeURIComponent(pair.chainId)+'/'+encodeURIComponent(pair.pairAddress);
    $('movement').textContent='';renderMarket(pair);window.dispatchEvent(new CustomEvent('dk-market-observation',{detail:{pair,at:Date.now()/1000}}));
    $('risk-frame').src='app.html?embedded=1&a='+encodeURIComponent(pair.baseToken.address)+'&chain='+encodeURIComponent(pair.chainId)+'&pool='+encodeURIComponent(pair.pairAddress);
    $('selected').scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  }
  function renderMarket(p){
    const box=$('market');box.replaceChildren();const grid=element('div',undefined,'market-grid');
    for(const [label,value] of [['Pris',money(p.priceUsd)],['Likviditet',money(p.liquidity?.usd)],['Market cap',money(p.marketCap)],['Prisændring · 5 min.',pct(p.priceChange?.m5)]]){const d=element('div',undefined,'metric');d.append(element('small',label),element('strong',value));grid.append(d);}box.append(grid);
    const tx=p.txns?.m5;box.append(element('p',tx&&Number.isFinite(tx.buys)&&Number.isFinite(tx.sells)?`5 min.: ${tx.buys} køb / ${tx.sells} salg. Det er transaktioner, ikke unikke personer.`:'5 min. handelsaktivitet: ukendt.','hint'));
    const notes=[];if(p.liquidity?.usd===0)notes.push('Datakilden viser nul likviditet.');else if(Number(p.liquidity?.usd)>0&&p.liquidity.usd<10000)notes.push('Tynd likviditet under $10.000: større risiko for prispåvirkning.');
    if(p.liquidity?.usd==null)notes.push('Likviditet er ukendt.');if(Number(p.priceChange?.m5)<=-20)notes.push('Kraftigt prisfald de seneste 5 minutter.');if(tx&&tx.buys===0&&tx.sells===0)notes.push('Ingen rapporterede handler de seneste 5 minutter.');
    if(notes.length)box.append(element('p',notes.join(' ')+' Det fastslår ikke årsagen eller beviser et rug.','market-note'));
    $('market-time').textContent='Offentligt API-svar hentet '+new Date().toLocaleTimeString('da-DK')+'. Datakildens egen aktualitet og salgsmulighed er ikke bekræftet. Samme pool: '+p.pairAddress;
  }
  async function refresh(){
    if(!choice||refreshBusy)return;refreshBusy=true;const id=epoch,selected=choice;
    try{const data=await json(`https://api.dexscreener.com/latest/dex/pairs/${encodeURIComponent(selected.chainId)}/${encodeURIComponent(selected.pairAddress)}`);if(id!==epoch)return;
      const p=C.pinnedPair(data.pairs,selected);
      if(!p){window.dispatchEvent(new Event('dk-market-missing'));$('market').replaceChildren(element('p','UKENDT: den valgte pool eller dens base-token mangler. Ingen automatisk overgang til en anden pool.','market-note'));$('market-time').textContent='Kontrolleret '+new Date().toLocaleTimeString('da-DK');$('movement').textContent='';previous=null;return;}
      const change=C.delta(previous,p,Date.now());renderMarket(p);window.dispatchEvent(new CustomEvent('dk-market-observation',{detail:{pair:p,at:Date.now()/1000}}));$('movement').textContent=change?`Siden forrige svar: pris ${pct(change.price)} · likviditet ${pct(change.liquidity)}.`:'Ingen sammenlignelig nylig måling.';previous={pair:p,time:Date.now()};
    }catch(e){if(id===epoch){window.dispatchEvent(new Event('dk-market-missing'));$('market').replaceChildren(element('p','UKENDT: markedsopdateringen fejlede. '+e.message,'market-note'));$('market-time').textContent='Fejl ved opslag '+new Date().toLocaleTimeString('da-DK');$('movement').textContent='';previous=null;}}finally{refreshBusy=false;}
  }
  async function watchTick(){if(!watching)return;const generation=watchEpoch;await refresh();if(watching&&generation===watchEpoch)timer=setTimeout(watchTick,30000);}
  $('watch').onclick=()=>{if(watching){stopWatch();return;}watching=true;$('watch').textContent='Stop overvågning';$('watch-state').textContent='Følger den valgte pool ca. hvert 30. sekund, mens panelet er åbent. Browseren kan sætte baggrundsfaner på pause. Risikotjekket nedenfor er et separat snapshot.';watchTick();};
  $('refresh').onclick=refresh;
  async function copy(text,button){try{await navigator.clipboard.writeText(text);button.textContent='Kopieret';setTimeout(()=>button.textContent='Kopiér adresse',1500);}catch{status('Kopiér adressen manuelt fra feltet.',true);}}
  $('copy').onclick=()=>{if(choice)copy(choice.baseToken.address,$('copy'));};
  window.addEventListener('pagehide',()=>{stopShare();stopWatch();if(worker)worker.terminate();});
})();
