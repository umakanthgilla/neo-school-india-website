(function(){
window.renderNeoTeacherPerformance=function(area,ctx){
  var data=ctx.data||{},esc=ctx.esc,api=ctx.api,portalBlob=ctx.portalBlob,refresh=ctx.refresh,status=ctx.status;
  var today=new Date(Date.now()+330*60000).toISOString().slice(0,10);
  var classrooms=data.classrooms||[],students=data.students||[];
  var records=(data.student_performance||[]).slice().sort(function(a,b){return String(b.date||b.created_at||'').localeCompare(String(a.date||a.created_at||''));});
  var activitySuggestions=[].concat(
    ((data.learning||{}).timetable||{}).slots||[],
    ((data.learning||{}).timetable||{}).periods||[]
  ).map(function(x){return x.subject;}).filter(Boolean);
  ((data.learning||{}).plans||{}).plans?.forEach(function(p){(p.lessons||[]).forEach(function(l){activitySuggestions.push(l.subject||l.concept);});});
  activitySuggestions=[...new Set(activitySuggestions.filter(Boolean).map(String))].sort(function(a,b){return a.localeCompare(b);});
  function icon(name,tone){
    return '<span class="neo-nav-icon neo-tone-'+tone+'" aria-hidden="true"><svg class="neo-work-icon"><use href="#family-glyph-'+name+'"></use></svg></span>';
  }
  function roomName(id){
    var room=classrooms.find(function(x){return x.id===id;});
    return room&&room.name?room.name:'Classroom';
  }
  var stepHtml=[
    ['users',0,'1 · Child','Select classroom and child'],
    ['book',1,'2 · Activity','What the child worked on'],
    ['chart',2,'3 · Outcome','Quick performance level'],
    ['pen',3,'4 · Observation','Short teacher note'],
    ['eye',4,'5 · Photo & share','Optional evidence and parent visibility']
  ].map(function(s){
    return '<article class="performance-step">'+icon(s[0],s[1])+'<div><b>'+s[2]+'</b><small>'+s[3]+'</small></div></article>';
  }).join('');
  var classroomOptions=classrooms.map(function(x){return '<option value="'+esc(x.id)+'">'+esc(x.name)+'</option>';}).join('');
  var datalist=activitySuggestions.map(function(x){return '<option value="'+esc(x)+'"></option>';}).join('');
  var history=records.map(function(r){
    var child=students.find(function(s){return s.id===r.student_id;});
    var photo=r.has_photo?'<button type="button" class="secondary" data-performance-photo="'+esc(r.id)+'">View photo</button><div class="performance-photo-slot" data-performance-photo-slot="'+esc(r.id)+'"></div>':'';
    return '<article class="portal-card performance-history-card"><div class="performance-card-head"><span class="portal-pill">'+esc(r.outcome||'Recorded')+'</span><small>'+esc(r.date||'')+'</small></div><h3>'+esc(r.student_name||(child&&child.name)||'Child')+'</h3><p><strong>'+esc(r.activity||'Activity')+'</strong> · '+esc(roomName(r.classroom_id))+'</p><p>'+esc(r.observation||'')+'</p><p class="form-note">'+(r.parent_visible?'Shared with parent':'Private teacher record')+' · '+esc(r.teacher_name||data.name||'Teacher')+'</p>'+photo+'</article>';
  }).join('');
  area.innerHTML=
    '<div class="learning-welcome"><div><span class="eyebrow">CHILD OBSERVATION</span><h2>Child Performance & Activity</h2><p>Record a child’s activity outcome, observation and an optional photo. Share only approved updates with the parent.</p></div><span class="portal-pill">'+records.length+' saved</span></div>'+
    '<section class="panel performance-entry-panel"><form id="childPerformanceForm">'+
      '<div class="performance-step-grid">'+stepHtml+'</div>'+
      '<div class="performance-form-grid">'+
        '<label>Classroom<select name="classroom_id" required><option value="">Choose classroom…</option>'+classroomOptions+'</select></label>'+
        '<label>Child<select name="student_id" required><option value="">Choose classroom first…</option></select></label>'+
        '<label>Activity date<input name="date" type="date" max="'+today+'" value="'+today+'" required></label>'+
        '<label>Activity / learning area<input name="activity" list="performanceActivityList" maxlength="200" required placeholder="Example: Colour sorting activity"><datalist id="performanceActivityList">'+datalist+'</datalist></label>'+
        '<label>Outcome<select name="outcome" required><option value="">Choose outcome…</option><option>Excellent progress</option><option>Independent</option><option>Participated</option><option>With support</option><option>Needs follow-up</option></select></label>'+
        '<label class="performance-wide">Observation<textarea name="observation" maxlength="1500" rows="4" required placeholder="Example: Identified red and blue independently and completed the sorting activity with confidence."></textarea></label>'+
        '<label class="performance-wide performance-photo-field">Activity photo<input name="photo_file" type="file" accept="image/*" capture="environment"><small>Optional. The photo is compressed to a secure JPEG under 150 KB before upload.</small><img id="performancePhotoPreview" alt="Selected activity photo preview" hidden></label>'+
        '<label class="performance-share performance-wide"><input name="parent_visible" type="checkbox"><span><strong>Share this update with parent</strong><small>Tick only after checking that the note and photo are appropriate for this child’s parent.</small></span></label>'+
      '</div>'+
      '<button type="submit">Save child performance</button> <span id="performanceSaveState" class="form-note"></span>'+
    '</form></section>'+
    '<h3>Recent child performance</h3><div class="portal-grid performance-history">'+(history||'<p class="portal-empty">No child performance records yet.</p>')+'</div>';

  var form=area.querySelector('#childPerformanceForm');
  var classroom=form.elements.classroom_id,child=form.elements.student_id,fileInput=form.elements.photo_file;
  var preview=area.querySelector('#performancePhotoPreview'),previewUrl='';
  function fillChildren(){
    var rows=students.filter(function(s){return s.classroom_id===classroom.value;});
    child.innerHTML='<option value="">Choose child…</option>'+rows.map(function(s){return '<option value="'+esc(s.id)+'">'+esc(s.name+' · '+(s.program||roomName(s.classroom_id)))+'</option>';}).join('');
  }
  classroom.onchange=fillChildren;
  if(classrooms.length===1){classroom.value=classrooms[0].id;fillChildren();}
  fileInput.onchange=function(){
    if(previewUrl)URL.revokeObjectURL(previewUrl);
    var file=fileInput.files&&fileInput.files[0];
    if(!file){preview.hidden=true;preview.removeAttribute('src');return;}
    previewUrl=URL.createObjectURL(file);preview.src=previewUrl;preview.hidden=false;
  };
  function fileDataUrl(file){
    return new Promise(function(resolve,reject){
      var reader=new FileReader();
      reader.onload=function(){resolve(String(reader.result||''));};
      reader.onerror=function(){reject(Error('Could not read the photo.'));};
      reader.readAsDataURL(file);
    });
  }
  function loadImage(src){
    return new Promise(function(resolve,reject){
      var img=new Image();
      img.onload=function(){resolve(img);};
      img.onerror=function(){reject(Error('Could not read this image.'));};
      img.src=src;
    });
  }
  async function compressPhoto(file){
    if(!file)return '';
    if(String(file.type||'').indexOf('image/')!==0)throw Error('Choose an image file.');
    if(file.size>12*1024*1024)throw Error('Choose a photo smaller than 12 MB.');
    var source=await fileDataUrl(file),img=await loadImage(source);
    var width=img.naturalWidth||img.width,height=img.naturalHeight||img.height;
    var scale=Math.min(1,1280/Math.max(width,height)),quality=.82,last='';
    for(var attempt=0;attempt<10;attempt++){
      var canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
      var context=canvas.getContext('2d');context.drawImage(img,0,0,canvas.width,canvas.height);
      last=canvas.toDataURL('image/jpeg',quality);
      if(last.length<=195000)return last;
      if(quality>.48)quality-=.09;else scale*=.78;
    }
    throw Error('Photo is still too large. Choose a smaller image.');
  }
  form.onsubmit=async function(e){
    e.preventDefault();
    var button=e.submitter,state=area.querySelector('#performanceSaveState');
    button.disabled=true;state.textContent='Preparing update…';
    try{
      var body=Object.fromEntries(new FormData(form));
      body.parent_visible=form.elements.parent_visible.checked;
      body.request_id=crypto.randomUUID();
      delete body.photo_file;
      var file=fileInput.files&&fileInput.files[0];
      if(file){state.textContent='Compressing photo…';body.photo=await compressPhoto(file);}
      state.textContent='Saving…';
      await api('performance','POST',body);
      if(previewUrl)URL.revokeObjectURL(previewUrl);
      status(body.parent_visible?'✓ Child performance saved and shared with the parent.':'✓ Child performance saved as a private teacher record.');
      await refresh();
    }catch(err){
      state.textContent=err.message;status(err.message);button.disabled=false;
    }
  };
  area.querySelectorAll('[data-performance-photo]').forEach(function(button){
    button.onclick=async function(){
      var id=button.dataset.performancePhoto;
      var slot=area.querySelector('[data-performance-photo-slot="'+id+'"]');
      button.disabled=true;
      try{
        var blob=await portalBlob('performance-photo/'+encodeURIComponent(id)),url=URL.createObjectURL(blob);
        slot.innerHTML='<img class="performance-evidence-photo" alt="Child activity evidence">';
        slot.querySelector('img').src=url;
        button.textContent='Photo loaded';
      }catch(err){slot.textContent=err.message;button.disabled=false;}
    };
  });
};
})();