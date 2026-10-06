(function(){
window.renderNeoTeacherPerformance=function(area,ctx){
  var data=ctx.data||{},esc=ctx.esc,api=ctx.api,portalBlob=ctx.portalBlob,refresh=ctx.refresh,status=ctx.status;
  var today=new Date(Date.now()+330*60000).toISOString().slice(0,10);
  var classrooms=data.classrooms||[],students=data.students||[];
  var standalone=(data.student_performance||[]).map(function(r){return Object.assign({source:'Extra observation'},r);});
  var periodRows=((((data.learning||{})['period-execution'])||{}).records)||[];
  var periodDerived=[];
  periodRows.forEach(function(p){
    (p.student_observations||[]).forEach(function(o){
      if(!o||o.outcome==='Not observed'||(!o.comment&&!o.parent_visible))return;
      var student=students.find(function(s){return s.id===o.student_id;});
      periodDerived.push({
        id:'period:'+String(p.id||[p.date,p.classroom_id,p.start,o.student_id].join(':')),
        student_id:o.student_id,
        student_name:student&&student.name||'Child',
        classroom_id:p.classroom_id,
        date:p.date||'',
        activity:p.subject||p.period||p.parent_activity_note||'Classroom activity',
        outcome:o.outcome||'Observed',
        observation:o.comment||'',
        parent_visible:o.parent_visible===true,
        has_photo:false,
        teacher_name:data.name||'Teacher',
        source:'Record execution',
        start:p.start||'',
        end:p.end||''
      });
    });
  });
  var records=standalone.concat(periodDerived).sort(function(a,b){
    return String(b.date||b.created_at||'').localeCompare(String(a.date||a.created_at||''));
  });
  function icon(name,tone){
    return '<span class="neo-nav-icon neo-tone-'+tone+'" aria-hidden="true"><svg class="neo-work-icon"><use href="#family-glyph-'+name+'"></use></svg></span>';
  }
  function roomName(id){
    var room=classrooms.find(function(x){return x.id===id;});
    return room&&room.name?room.name:'Classroom';
  }
  function uniqueCount(rows,key){return new Set(rows.map(function(r){return r[key];}).filter(Boolean)).size;}
  var todayRows=records.filter(function(r){return r.date===today;});
  var followUp=records.filter(function(r){return r.outcome==='Needs follow-up';}).length;
  var shared=records.filter(function(r){return r.parent_visible;}).length;
  area.innerHTML=
    '<div class="learning-welcome"><div><span class="eyebrow">PERFORMANCE TRACKER</span><h2>Child Performance & Activity</h2><p>Main observations are recorded from My timetable → Record execution. This page tracks them child-wise in one place.</p></div><button type="button" class="secondary" id="openRecordExecution">Open My timetable</button></div>'+
    '<div class="portal-grid">'+
      '<article class="portal-card"><h3>Today’s observations</h3><strong class="metric">'+todayRows.length+'</strong><p>'+uniqueCount(todayRows,'student_id')+' children observed</p></article>'+
      '<article class="portal-card"><h3>Shared with parents</h3><strong class="metric">'+shared+'</strong><p>approved parent-visible updates</p></article>'+
      '<article class="portal-card"><h3>Needs follow-up</h3><strong class="metric">'+followUp+'</strong><p>child outcomes to review</p></article>'+
    '</div>'+
    '<section class="panel performance-filter-panel"><div class="performance-form-grid">'+
      '<label>Classroom<select id="performanceFilterClass"><option value="">All classrooms</option>'+classrooms.map(function(x){return '<option value="'+esc(x.id)+'">'+esc(x.name)+'</option>';}).join('')+'</select></label>'+
      '<label>Child<select id="performanceFilterChild"><option value="">All children</option>'+students.map(function(s){return '<option value="'+esc(s.id)+'">'+esc(s.name)+'</option>';}).join('')+'</select></label>'+
      '<label>Date<input id="performanceFilterDate" type="date"></label>'+
      '<label>Outcome<select id="performanceFilterOutcome"><option value="">All outcomes</option><option>Excellent progress</option><option>Independent</option><option>Participated</option><option>With support</option><option>Needs follow-up</option></select></label>'+
    '</div></section>'+
    '<h3>Performance history</h3><div id="performanceHistory" class="portal-grid performance-history"></div>'+
    '<details class="portal-editor performance-extra-entry"><summary>＋ Add photo / extra observation</summary><p class="form-note">Use this only for evidence or a child-specific observation that is not already captured in Record execution.</p><form id="childPerformanceForm">'+
      '<div class="performance-form-grid">'+
        '<label>Classroom<select name="classroom_id" required><option value="">Choose classroom…</option>'+classrooms.map(function(x){return '<option value="'+esc(x.id)+'">'+esc(x.name)+'</option>';}).join('')+'</select></label>'+
        '<label>Child<select name="student_id" required><option value="">Choose classroom first…</option></select></label>'+
        '<label>Activity date<input name="date" type="date" max="'+today+'" value="'+today+'" required></label>'+
        '<label>Activity / learning area<input name="activity" maxlength="200" required placeholder="Example: Colour sorting activity"></label>'+
        '<label>Outcome<select name="outcome" required><option value="">Choose outcome…</option><option>Excellent progress</option><option>Independent</option><option>Participated</option><option>With support</option><option>Needs follow-up</option></select></label>'+
        '<label class="performance-wide">Observation<textarea name="observation" maxlength="1500" rows="4" required placeholder="Short child-specific observation"></textarea></label>'+
        '<label class="performance-wide performance-photo-field">Activity photo<input name="photo_file" type="file" accept="image/*" capture="environment"><small>Optional. Photo is compressed to a secure JPEG under 150 KB.</small><img id="performancePhotoPreview" alt="Selected activity photo preview" hidden></label>'+
        '<label class="performance-share performance-wide"><input name="parent_visible" type="checkbox"><span><strong>Share this update with parent</strong><small>Tick only after checking the note and photo.</small></span></label>'+
      '</div>'+
      '<button type="submit">Save extra observation</button> <span id="performanceSaveState" class="form-note"></span>'+
    '</form></details>';

  var history=area.querySelector('#performanceHistory');
  var filterClass=area.querySelector('#performanceFilterClass'),filterChild=area.querySelector('#performanceFilterChild'),filterDate=area.querySelector('#performanceFilterDate'),filterOutcome=area.querySelector('#performanceFilterOutcome');
  function draw(){
    var rows=records.filter(function(r){
      return (!filterClass.value||r.classroom_id===filterClass.value)&&(!filterChild.value||r.student_id===filterChild.value)&&(!filterDate.value||r.date===filterDate.value)&&(!filterOutcome.value||r.outcome===filterOutcome.value);
    });
    history.innerHTML=rows.map(function(r){
      var child=students.find(function(s){return s.id===r.student_id;});
      var photo=r.has_photo?'<button type="button" class="secondary" data-performance-photo="'+esc(r.id)+'">View photo</button><div class="performance-photo-slot" data-performance-photo-slot="'+esc(r.id)+'"></div>':'';
      var time=r.start?(' · '+esc(r.start)+(r.end?'–'+esc(r.end):'')):'';
      return '<article class="portal-card performance-history-card"><div class="performance-card-head"><span class="portal-pill">'+esc(r.outcome||'Recorded')+'</span><small>'+esc(r.date||'')+time+'</small></div><h3>'+esc(r.student_name||(child&&child.name)||'Child')+'</h3><p><strong>'+esc(r.activity||'Activity')+'</strong> · '+esc(roomName(r.classroom_id))+'</p>'+(r.observation?'<p>'+esc(r.observation)+'</p>':'')+'<p class="form-note">'+esc(r.source||'Observation')+' · '+(r.parent_visible?'Shared with parent':'Private teacher record')+'</p>'+photo+'</article>';
    }).join('')||'<p class="portal-empty">No performance records match these filters.</p>';
    history.querySelectorAll('[data-performance-photo]').forEach(function(button){
      button.onclick=async function(){
        var id=button.dataset.performancePhoto,slot=history.querySelector('[data-performance-photo-slot="'+id+'"]');button.disabled=true;
        try{var blob=await portalBlob('performance-photo/'+encodeURIComponent(id)),url=URL.createObjectURL(blob);slot.innerHTML='<img class="performance-evidence-photo" alt="Child activity evidence">';slot.querySelector('img').src=url;button.textContent='Photo loaded';}
        catch(err){slot.textContent=err.message;button.disabled=false;}
      };
    });
  }
  [filterClass,filterChild,filterDate,filterOutcome].forEach(function(x){x.onchange=draw;});draw();
  area.querySelector('#openRecordExecution').onclick=function(){
    var button=document.querySelector('#familyApp [data-tab="timetable"]');if(button)button.click();
  };

  var form=area.querySelector('#childPerformanceForm'),classroom=form.elements.classroom_id,child=form.elements.student_id,fileInput=form.elements.photo_file,preview=area.querySelector('#performancePhotoPreview'),previewUrl='';
  function fillChildren(){var rows=students.filter(function(s){return s.classroom_id===classroom.value;});child.innerHTML='<option value="">Choose child…</option>'+rows.map(function(s){return '<option value="'+esc(s.id)+'">'+esc(s.name+' · '+(s.program||roomName(s.classroom_id)))+'</option>';}).join('');}
  classroom.onchange=fillChildren;if(classrooms.length===1){classroom.value=classrooms[0].id;fillChildren();}
  fileInput.onchange=function(){if(previewUrl)URL.revokeObjectURL(previewUrl);var file=fileInput.files&&fileInput.files[0];if(!file){preview.hidden=true;preview.removeAttribute('src');return;}previewUrl=URL.createObjectURL(file);preview.src=previewUrl;preview.hidden=false;};
  function fileDataUrl(file){return new Promise(function(resolve,reject){var reader=new FileReader();reader.onload=function(){resolve(String(reader.result||''));};reader.onerror=function(){reject(Error('Could not read the photo.'));};reader.readAsDataURL(file);});}
  function loadImage(src){return new Promise(function(resolve,reject){var img=new Image();img.onload=function(){resolve(img);};img.onerror=function(){reject(Error('Could not read this image.'));};img.src=src;});}
  async function compressPhoto(file){
    if(!file)return '';if(String(file.type||'').indexOf('image/')!==0)throw Error('Choose an image file.');if(file.size>12*1024*1024)throw Error('Choose a photo smaller than 12 MB.');
    var source=await fileDataUrl(file),img=await loadImage(source),width=img.naturalWidth||img.width,height=img.naturalHeight||img.height,scale=Math.min(1,1280/Math.max(width,height)),quality=.82,last='';
    for(var attempt=0;attempt<10;attempt++){var canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);last=canvas.toDataURL('image/jpeg',quality);if(last.length<=195000)return last;if(quality>.48)quality-=.09;else scale*=.78;}
    throw Error('Photo is still too large. Choose a smaller image.');
  }
  form.onsubmit=async function(e){
    e.preventDefault();var button=e.submitter,state=area.querySelector('#performanceSaveState');button.disabled=true;state.textContent='Preparing update…';
    try{var body=Object.fromEntries(new FormData(form));body.parent_visible=form.elements.parent_visible.checked;body.request_id=crypto.randomUUID();delete body.photo_file;var file=fileInput.files&&fileInput.files[0];if(file){state.textContent='Compressing photo…';body.photo=await compressPhoto(file);}state.textContent='Saving…';await api('performance','POST',body);if(previewUrl)URL.revokeObjectURL(previewUrl);status(body.parent_visible?'✓ Extra observation saved and shared with parent.':'✓ Extra observation saved privately.');await refresh();}
    catch(err){state.textContent=err.message;status(err.message);button.disabled=false;}
  };
};
})();