self.addEventListener('push',event=>{
 const role=new URL(self.location.href).searchParams.get('role');
 const url=role==='parent'?'/parents':role==='school'?'/schools':role==='transport'?'/transport':'/';
 event.waitUntil(self.registration.showNotification('Neo School India',{body:role==='parent'?'New school or child-safety update. Open your Parent Portal for details.':'New school operations update. Open your portal for details.',icon:'/neo-top-logo.jpeg',badge:'/neo-favicon-v4.svg',tag:'neo-school-update',data:{url}}));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();const url=new URL(event.notification.data?.url||'/',self.location.origin).href;
 event.waitUntil((async()=>{const windows=await clients.matchAll({type:'window',includeUncontrolled:true});const target=windows.find(w=>w.url.startsWith(url));if(target)return target.focus();return clients.openWindow(url)})());
});
