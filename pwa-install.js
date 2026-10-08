(()=> {
  let deferredPrompt=null;
  const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone=window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
  const role=(()=>{
    const p=location.pathname.toLowerCase();
    if(p.includes('crm'))return ['Neo Growth CRM','Growth CRM'];
    if(p.includes('teacher'))return ['Neo Teacher','Teacher Portal'];
    if(p.includes('parent'))return ['Neo Parent','Parent Portal'];
    if(p.includes('transport'))return ['Neo Transport','Transport Portal'];
    if(p.includes('supply'))return ['Neo Supply','Supply Chain Portal'];
    if(p.includes('admin'))return ['Neo Head Office','Head Office Portal'];
    if(p.includes('school'))return ['Neo School','School Portal'];
    return ['Neo School India','Neo School India'];
  })();
  function showIOS(){
    alert('To install '+role[0]+': open this page in Safari, tap Share, then choose “Add to Home Screen”.');
  }
  function install(){
    if(isStandalone){alert(role[0]+' is already installed/opened as an app.');return}
    if(deferredPrompt){
      deferredPrompt.prompt();
      deferredPrompt.userChoice.finally(()=>{deferredPrompt=null;update()});
      return;
    }
    if(isIOS){showIOS();return}
    alert('If Install App is not shown by the browser yet, open the browser menu and choose “Install app” or “Add to Home screen”. If an older Neo app is installed, uninstall it once and reopen this portal.');
  }
  function update(){
    document.querySelectorAll('[data-neo-install]').forEach(b=>{
      b.hidden=isStandalone;
      b.textContent='Install App';
      b.onclick=install;
    });
  }
  function inject(){
    if(document.querySelector('[data-neo-install]')){update();return}
    let host=null,before=null;
    if(document.querySelector('.family-tabs')){
      host=document.querySelector('.family-tabs');before=host.querySelector('#familySignOut');
    }else if(document.querySelector('.neo-department-nav')){
      host=document.querySelector('.neo-department-nav');before=host.querySelector('#navSignOut');
    }else if(document.querySelector('#appView .workspace-nav')){
      host=document.querySelector('#appView .workspace-nav');before=host.querySelector('.logout');
    }else if(document.querySelector('#app .side')){
      host=document.querySelector('#app .side');before=host.querySelector('.nav-signout');
    }else if(document.querySelector('.transport-work-bar')){
      host=document.querySelector('.transport-work-bar');
    }
    if(!host)return;
    const b=document.createElement('button');
    b.type='button';b.dataset.neoInstall='1';b.className='neo-install-app';
    b.innerHTML='<span aria-hidden="true">↓</span><span>Install App</span>';
    const s=document.getElementById('neoInstallStyle')||document.createElement('style');
    s.id='neoInstallStyle';
    s.textContent=`
    .neo-install-app{display:flex!important;align-items:center!important;justify-content:flex-start!important;gap:9px!important;min-height:46px!important;width:100%!important;padding:9px 13px!important;border:1px solid #2b4a80!important;border-radius:12px!important;background:#17356c!important;color:#fff!important;font:inherit!important;font-weight:800!important;cursor:pointer!important;text-align:left!important}
    .neo-install-app>span:first-child{display:grid;place-items:center;width:29px;height:29px;flex:0 0 29px;border-radius:9px;background:#eaf7fb;color:#0b5f82;font-size:18px;font-weight:900}
    .family-tabs>.neo-install-app{width:calc(100% - 24px)!important;margin:7px 12px 8px!important}
    .neo-department-nav>.neo-install-app,#appView .workspace-nav>.neo-install-app,#app .side>.neo-install-app{margin:7px 0!important}
    .transport-work-bar>.neo-install-app{width:auto!important;min-width:145px!important}
    `;document.head.appendChild(s);
    if(before&&before.parentElement===host)host.insertBefore(b,before);else host.appendChild(b);
    update();
  }
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;inject();update()});
  window.addEventListener('appinstalled',()=>{deferredPrompt=null;update()});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{inject();setTimeout(inject,900)});else{inject();setTimeout(inject,900)}
  let scheduled=false;
  new MutationObserver(()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;inject()})}).observe(document.body||document.documentElement,{childList:true,subtree:true});
})();
