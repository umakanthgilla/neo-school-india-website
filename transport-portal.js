/* Neo School transport phase 1. All writes go to the authenticated Worker. */
(function(){
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const option=(rows,label)=>rows.map(x=>'<option value="'+esc(x.id)+'">'+esc(label(x))+'</option>').join('');
 const form=(title,body,kind)=>'<form class="panel transport-form" data-kind="'+kind+'"><h3>'+title+'</h3><div class="portal-grid">'+body+'</div><button type="submit">Save '+title+'</button></form>';
 const input=(name,label,type='text')=>'<label>'+label+'<input name="'+name+'" type="'+type+'" required></label>';
 const select=(name,label,html)=>'<label>'+label+'<select name="'+name+'" required><option value="">Choose…</option>'+html+'</select></label>';
 const msg=(area,message)=>{const n=area.querySelector('[data-transport-status]');if(n)n.textContent=message};
 async function school(area,{school,token,base}){
  area.innerHTML='<section class="panel"><h2>Transport & safety</h2><p>Loading routes, vehicles and today’s trips…</p></section>';
  const endpoint=base+'/api/transport/school/';
  async function api(kind,method='GET',body,id=''){
   const r=await fetch(endpoint+kind+'/'+encodeURIComponent(school.school_id)+(id?'/'+encodeURIComponent(id):''),{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
   const b=await r.json().catch(()=>({error:'Unreadable response.'}));if(!r.ok)throw Error(b.error||'Transport request failed.');return b;
  }
  async function draw(){
   try{
    const d=await api('routes'),today=new Date(Date.now()+330*60000).toISOString().slice(0,10);
    const vehicles=d.vehicles.filter(v=>v.active),routes=d.routes.filter(r=>r.active),assignments=d.assignments.filter(a=>a.active),trips=d.trips.filter(t=>t.date===today),availableStudents=d.students.filter(s=>!assignments.some(a=>a.student_id===s.id));
    const names=new Map(d.students.map(s=>[s.id,s.name])),drivers=d.staff.filter(s=>s.status!=='Inactive');
    area.innerHTML='<div class="learning-welcome"><div><span class="eyebrow">SCHOOL OPERATIONS · TRANSPORT</span><h2>Transport</h2><p>Manage assigned children and record today’s pickup and drop. GPS is not required for this stage.</p></div></div><p class="portal-status" data-transport-status role="status"></p>'+
     '<div class="portal-grid">'+
     form('Vehicle',input('registration_no','Registration number')+input('label','Vehicle name')+input('capacity','Seating capacity','number'),'vehicles')+
     form('Route',input('name','Route name')+select('vehicle_id','Vehicle',option(vehicles,v=>v.registration_no+' · '+v.label))+select('driver_staff_id','Driver (Staff Master)',option(drivers,s=>s.name+' · '+s.id))+'<label>Stops, one per line<textarea name="stops" rows="4" required></textarea></label>','routes')+
     form('Child assignment',select('route_id','Route',option(routes,r=>r.name))+select('student_id','Student',option(availableStudents,s=>s.name+' · '+s.program))+'<label>Pickup / drop stop<select name="stop" required><option value="">Select route first</option></select></label><p>Students already assigned to transport are not shown here. To change a stop, remove the current assignment below, then assign the child again.</p>','assignments')+
     form('Today’s trip',select('route_id','Route',option(routes,r=>r.name))+'<label>Direction<select name="direction" required><option value="Pickup">Morning pickup</option><option value="Drop">Return drop</option></select></label><p>Choose the route and morning pickup or return drop to create one run for today. Then press Started below and record each child’s journey. This does not change their permanent route assignment.</p>','trips')+'</div>'+
     '<section class="panel"><h3>Routes & assigned children</h3>'+ (routes.length?routes.map(r=>'<div class="transport-row"><b>'+esc(r.name)+'</b> · '+esc(d.vehicles.find(v=>v.id===r.vehicle_id)?.registration_no||'')+' · '+esc(d.staff.find(s=>s.id===r.driver_staff_id)?.name||'')+'<p>Stops: '+esc(r.stops.join(' → '))+'</p><p>Children: '+esc(assignments.filter(a=>a.route_id===r.id).map(a=>(names.get(a.student_id)||a.student_id)+' ('+a.stop+')').join(', ')||'None')+'</p>'+assignments.filter(a=>a.route_id===r.id).map(a=>'<button type="button" class="secondary" data-disable="assignments" data-id="'+esc(a.id)+'">Remove '+esc(names.get(a.student_id)||a.student_id)+' assignment</button>').join('')+'<button class="secondary" data-disable="routes" data-id="'+esc(r.id)+'">Close route</button></div>').join(''):'<p>No routes yet.</p>')+'</section>'+
     '<section class="panel"><h3>Today’s trips</h3>'+ (trips.length?trips.map(t=>{const r=routes.find(x=>x.id===t.route_id);return '<div class="transport-row"><b>'+esc(r?.name||t.route_id)+' · '+esc(t.direction)+'</b><p>Status: '+esc(t.status)+' · '+(t.events||[]).length+' child events</p><div class="actions">'+((t.direction==='Pickup'?['Started','Approaching','At stop','Arrived school','Completed']:['Started','Approaching','At stop','Completed']).filter(s=>({Planned:['Started'],Started:['Approaching','At stop','Arrived school','Completed'],Approaching:['At stop','Arrived school','Completed'],'At stop':['Approaching','Arrived school','Completed'],'Arrived school':['Completed']}[t.status]||[]).includes(s)).map(s=>'<button class="secondary" data-trip="'+esc(t.id)+'" data-next="'+s+'">'+s+'</button>').join(''))+'</div><div class="portal-grid">'+assignments.filter(a=>a.route_id===t.route_id).map(a=>'<label>'+esc(names.get(a.student_id)||a.student_id)+'<select data-trip-child="'+esc(t.id)+'" data-student="'+esc(a.student_id)+'"><option value="">Record child event…</option>'+(t.direction==='Pickup'?['Ready','Picked up','Dropped at school','Absent']:['Boarded at school','Dropped at stop','Absent']).map(s=>'<option>'+s+'</option>').join('')+'</select></label>').join('')+'</div></div>'}).join(''):'<p>No trip started for today.</p>')+'</section>';
    const assignmentRoute=area.querySelector('form[data-kind="assignments"] [name="route_id"]'),stop=area.querySelector('form[data-kind="assignments"] [name="stop"]');
    assignmentRoute.onchange=()=>{const r=routes.find(x=>x.id===assignmentRoute.value);stop.innerHTML='<option value="">Choose stop…</option>'+(r?.stops||[]).map(s=>'<option>'+esc(s)+'</option>').join('')};
    area.querySelectorAll('form.transport-form').forEach(f=>f.onsubmit=async e=>{e.preventDefault();const button=f.querySelector('[type=submit]');button.disabled=true;try{const body=Object.fromEntries(new FormData(f));if(f.dataset.kind==='routes')body.stops=body.stops.split('\n').map(x=>x.trim()).filter(Boolean);if(f.dataset.kind==='vehicles')body.capacity=Number(body.capacity);if(f.dataset.kind==='trips')body.date=today;body.request_id=crypto.randomUUID();await api(f.dataset.kind,'POST',body);await draw()}catch(err){msg(area,err.message);button.disabled=false}});
    area.querySelectorAll('[data-trip]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{await api('trips','PATCH',{status:b.dataset.next},b.dataset.trip);await draw()}catch(err){msg(area,err.message);b.disabled=false}});
    area.querySelectorAll('[data-trip-child]').forEach(s=>s.onchange=async()=>{if(!s.value)return;const event=s.value;s.disabled=true;try{await api('trips','PATCH',{status:'',student_id:s.dataset.student,event_type:event},s.dataset.tripChild);await draw()}catch(err){msg(area,err.message);s.disabled=false}});
    area.querySelectorAll('[data-disable]').forEach(b=>b.onclick=async()=>{if(b.dataset.disable==='assignments'){const current=assignments.find(a=>a.id===b.dataset.id);if(trips.some(t=>t.route_id===current?.route_id&&t.status!=='Completed')){msg(area,'Complete today’s active trip before changing this child’s assignment.');return}if(!window.confirm('Remove this child’s transport assignment? You can assign a new route or stop afterwards.'))return}b.disabled=true;try{await api(b.dataset.disable,'PATCH',{active:false},b.dataset.id);await draw()}catch(err){msg(area,err.message);b.disabled=false}});
   }catch(err){area.innerHTML='<section class="panel portal-error"><h3>Transport data unavailable</h3><p>'+esc(err.message)+'</p><button type="button" data-retry>Retry</button></section>';area.querySelector('[data-retry]').onclick=draw}
  }
  await draw();
 }
 async function parent(area,{token,base}){
  area.innerHTML='<section class="panel"><h3>My child’s transport</h3><p>Loading today’s trip…</p></section>';
  try{
   const r=await fetch(base+'/api/transport/parent/me',{headers:{Authorization:'Bearer '+token}});
   const d=await r.json();if(!r.ok)throw Error(d.error||'Transport unavailable.');
   area.innerHTML='<div class="learning-welcome"><div><span class="eyebrow">MY CHILD · TRANSPORT</span><h2>Transport</h2><p>School-recorded pickup and drop updates for your child.</p></div></div>'+
    (d.assignments.length?d.assignments.map(a=>{const route=d.routes.find(x=>x.id===a.route_id),vehicle=d.vehicles.find(x=>x.id===route?.vehicle_id),trips=d.trips.filter(t=>t.route_id===a.route_id);return '<section class="panel"><h3>'+esc(route?.name||'Assigned route')+'</h3><p>Stop: '+esc(a.stop)+' · Vehicle: '+esc(vehicle?.registration_no||'Pending')+'</p>'+(trips.length?trips.map(t=>'<div class="transport-row"><b>'+esc(t.direction)+' · '+esc(t.status)+'</b><p>'+esc((t.events||[]).map(e=>e.type+' at '+new Date(e.at).toLocaleTimeString('en-IN',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit'})).join(' · ')||'No child update yet')+'</p></div>').join(''):'<p>No trip recorded today.</p>')+'</section>'}).join(''):'<section class="panel"><p>No transport assignment for your child.</p></section>');
  }catch(err){area.innerHTML='<section class="panel portal-error"><h3>Transport unavailable</h3><p>'+esc(err.message)+'</p></section>'}
 }
 async function driver(area,{token,base,schoolId}){
  area.innerHTML='<section class="panel"><h3>My transport trips</h3><p>Loading assigned routes…</p></section>';
  const root=base+'/api/transport/driver/';
  async function api(path,method='GET',body){
   const r=await fetch(root+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
   const d=await r.json().catch(()=>({error:'Unreadable response.'}));if(!r.ok)throw Error(d.error||'Trip request failed.');return d;
  }
  async function draw(){
   try{
    const d=await api('me'),names=new Map(d.students.map(s=>[s.id,s.name]));
    area.innerHTML='<section class="panel"><h3>My transport trips</h3><p>Record progress and each child’s pickup or drop. Only routes assigned to your Staff ID appear here.</p><p data-transport-status role="status"></p>'+
     (d.trips.length?d.trips.map(t=>{const route=d.routes.find(r=>r.id===t.route_id),next={Planned:['Started'],Started:['Approaching','At stop','Arrived school','Completed'],Approaching:['At stop','Arrived school','Completed'],'At stop':['Approaching','Arrived school','Completed'],'Arrived school':['Completed']}[t.status]||[];
       if(t.direction!=='Pickup')next.splice(next.indexOf('Arrived school'),next.includes('Arrived school')?1:0);
       return '<div class="transport-row"><h4>'+esc(route?.name||t.route_id)+' · '+esc(t.direction)+'</h4><p>Current status: '+esc(t.status)+'</p><div class="actions">'+next.map(s=>'<button class="secondary" data-driver-trip="'+esc(t.id)+'" data-next="'+s+'">'+s+'</button>').join('')+'</div>'+
       d.assignments.filter(a=>a.route_id===t.route_id).map(a=>'<label>'+esc(names.get(a.student_id)||a.student_id)+' · '+esc(a.stop)+'<select data-driver-child="'+esc(t.id)+'" data-student="'+esc(a.student_id)+'"><option value="">Record child event…</option>'+(t.direction==='Pickup'?['Ready','Picked up','Dropped at school','Absent']:['Boarded at school','Dropped at stop','Absent']).map(s=>'<option>'+s+'</option>').join('')+'</select></label>').join('')+'</div>'}).join(''):'<p>No trip assigned for today. Your school starts trips from the Transport section.</p>')+'</section>';
    area.querySelectorAll('[data-driver-trip]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{await api('trips/'+encodeURIComponent(schoolId)+'/'+encodeURIComponent(b.dataset.driverTrip),'PATCH',{status:b.dataset.next});await draw()}catch(e){msg(area,e.message);b.disabled=false}});
    area.querySelectorAll('[data-driver-child]').forEach(s=>s.onchange=async()=>{if(!s.value)return;const event=s.value;s.disabled=true;try{await api('trips/'+encodeURIComponent(schoolId)+'/'+encodeURIComponent(s.dataset.driverChild),'PATCH',{status:'',student_id:s.dataset.student,event_type:event});await draw()}catch(e){msg(area,e.message);s.disabled=false}});
   }catch(e){area.innerHTML='<section class="panel portal-error"><h3>Transport unavailable</h3><p>'+esc(e.message)+'</p><button data-retry>Retry</button></section>';area.querySelector('[data-retry]').onclick=draw}
  }
  await draw();
 }
 window.NeoTransport={school,parent,driver};
})();
