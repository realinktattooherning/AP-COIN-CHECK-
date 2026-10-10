(() => {
  const extension=typeof chrome!=='undefined'&&chrome.runtime?.id;
  const button=document.querySelector('[data-open-companion]');
  if(button)button.addEventListener('click',async e=>{
    e.preventDefault();
    if(extension&&chrome.sidePanel){
      try { const w=await chrome.windows.getCurrent();await chrome.sidePanel.open({windowId:w.id});return; } catch {}
    }
    const url=extension?chrome.runtime.getURL('screen.html'):new URL('screen.html',location.href).href;
    const popup=window.open(url,'dk-stream-companion','popup,width=470,height=880');
    if(!popup)location.href=url;
  });
  const params=new URLSearchParams(location.search);
  if(params.get('embedded')==='1'){
    document.documentElement.classList.add('companion-embedded');
    const address=params.get('a'),chain=params.get('chain'),pool=params.get('pool');
    if(window.ScreenCore?.valid(address||'')&&ScreenCore.valid(pool||'')&&/^[a-z0-9-]+$/.test(chain||''))window.CompanionInput={address,chain,pool};
    // Resume the linked scan after the existing profile chooser has been used.
    let pending=true;
    window.addEventListener('risk-profile-change',()=>{
      if(pending&&window.CompanionInput){pending=false;setTimeout(()=>{if(document.getElementById('go')?.disabled===false)document.getElementById('f').requestSubmit();},0);}
    });
  }
})();
