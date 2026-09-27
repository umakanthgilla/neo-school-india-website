(function(){
 const base='https://neo-lead-crm-api.umakanthgilla.workers.dev/api/transport/push/';
 const supported=()=>('serviceWorker'in navigator)&&('PushManager'in window)&&('Notification'in window);
 const keyBytes=value=>{const raw=atob(value.replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from(raw,c=>c.charCodeAt(0))};
 async function call(token,path,method='GET',body){const response=await fetch(base+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const value=await response.json();if(!response.ok)throw Error(value.error||'Push setup failed.');return value}
 async function mount(area,token,role){
  if(!supported()||!area||!token)return;
  const box=document.createElement('div');box.className='neo-push-optin';box.innerHTML='<button type="button" class="secondary">Enable phone alerts</button><span role="status" aria-live="polite"></span>';
  area.prepend(box);const button=box.querySelector('button'),status=box.querySelector('span');
  try{const existing=await navigator.serviceWorker.getRegistration('/'),subscribed=await existing?.pushManager.getSubscription();
   if(subscribed&&Notification.permission==='granted'){await call(token,'subscription','POST',{endpoint:subscribed.endpoint});button.textContent='Phone alerts enabled';button.dataset.enabled='true'}
  }catch(error){status.textContent=error.message}
  button.onclick=async()=>{button.disabled=true;try{
   if(button.dataset.enabled==='true'){
    const registration=await navigator.serviceWorker.getRegistration('/'),subscription=await registration?.pushManager.getSubscription();if(subscription){await call(token,'subscription','DELETE',{endpoint:subscription.endpoint});await subscription.unsubscribe()}button.dataset.enabled='false';button.textContent='Enable phone alerts';status.textContent='Phone alerts disabled.';
   }else{
    const permission=await Notification.requestPermission();if(permission!=='granted')throw Error('Allow notifications in browser settings to receive phone alerts.');
    const {publicKey}=await call(token,'key');const registration=await navigator.serviceWorker.register('/neo-transport-sw.js?role='+encodeURIComponent(role),{scope:'/'});const subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:keyBytes(publicKey)});
    try{await call(token,'subscription','POST',{endpoint:subscription.endpoint})}catch(error){await subscription.unsubscribe();throw error}
    button.dataset.enabled='true';button.textContent='Phone alerts enabled';status.textContent='Phone alerts are enabled for this login.';
   }
  }catch(error){status.textContent=error.message}finally{button.disabled=false}};
 }
 async function signOut(token){if(!supported()||!token)return;try{const registration=await navigator.serviceWorker.getRegistration('/'),subscription=await registration?.pushManager.getSubscription();if(subscription){await call(token,'subscription','DELETE',{endpoint:subscription.endpoint});await subscription.unsubscribe()}}catch{}}
 window.NeoTransportPush={mount,signOut};
})();
