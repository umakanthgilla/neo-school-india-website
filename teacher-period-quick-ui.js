(function(){
  const API='https://neo-lead-crm-api.umakanthgilla.workers.dev';
  let teacherMePromise=null;
  const token=()=>sessionStorage.getItem('neo_teacher_token')||'';
  const teacherMe=()=>teacherMePromise||(teacherMePromise=fetch(API+'/api/teacher/me',{headers:{Authorization:'Bearer '+token()}})
    .then(async r=>{const b=await r.json().catch(()=>({}));if(!r.ok)throw Error(b.error||'Teacher profile unavailable.');return b})
    .catch(()=>({attendance:[]})));
  const textOf=(el)=>String(el?.textContent||'').trim();
  const fieldWith=(root,selector)=>{const el=root.querySelector(selector);return el?.closest('.px-field')||el?.parentElement||null};

  async function applyQuickUI(form){
    if(!form||form.dataset.quickPeriodApplied)return;
    const futureNote=[...form.querySelectorAll('.form-note')].some(x=>/Future period/i.test(textOf(x)));
    if(futureNote)return;
    form.dataset.quickPeriodApplied='1';
    form.classList.add('px-quick-form');

    const head=form.querySelector('.px-head');
    if(head){
      const oldTitle=head.querySelector('h3');
      if(oldTitle){
        const subject=oldTitle.textContent.trim();
        oldTitle.textContent='Period Execution';
        const p=head.querySelector('p');
        if(p&&!p.dataset.quickSubject){
          p.dataset.quickSubject='1';
          p.innerHTML='<strong>'+p.textContent.trim()+'</strong> · '+subject;
        }
      }
    }

    const sections=[...form.querySelectorAll(':scope > .px-section')];
    const prepare=sections.find(s=>/Prepare/i.test(textOf(s.querySelector('h4'))));
    const conduct=sections.find(s=>/Conduct/i.test(textOf(s.querySelector('h4'))));
    const observe=sections.find(s=>/Observe children/i.test(textOf(s.querySelector('h4'))));
    const homework=sections.find(s=>/Homework/i.test(textOf(s.querySelector('h4'))));
    const record=sections.find(s=>/Record & share/i.test(textOf(s.querySelector('h4'))));

    if(prepare)prepare.hidden=true;

    if(conduct){
      const h=conduct.querySelector('h4');if(h)h.textContent='1 · Period status & update';
      conduct.classList.add('px-quick-section','px-conduct-compact');
      const teacherNote=fieldWith(conduct,'[name="activity_note"]');
      const parentUpdate=fieldWith(conduct,'[name="parent_activity_note"]');
      if(teacherNote)teacherNote.classList.add('px-compact-field');
      if(parentUpdate)parentUpdate.classList.add('px-compact-field');
    }

    if(observe){
      const h=observe.querySelector('h4');if(h)h.textContent='2 · Children — quick observation';
      observe.classList.add('px-quick-section');
      const children=observe.querySelector('.px-children');
      if(children){
        children.classList.add('px-children-compact');
        const rows=[...children.querySelectorAll('.px-child')];
        const tools=document.createElement('div');
        tools.className='px-roster-head';
        tools.innerHTML='<div><strong>'+rows.length+' children</strong><span class="px-attendance-summary">Checking attendance…</span></div><div class="px-bulk-actions"><button type="button" class="secondary" data-px-all="Participated">Set all Participated</button><button type="button" class="secondary" data-px-all="Not observed">Clear</button></div>';
        children.before(tools);

        rows.forEach((row,index)=>{
          row.classList.add('px-child-compact');
          const strong=row.querySelector(':scope > strong');
          if(strong){
            const main=document.createElement('div');main.className='px-child-main';
            const no=document.createElement('span');no.className='px-child-no';no.textContent=String(index+1);
            row.insertBefore(main,strong);main.append(no,strong);
          }
          const noteInput=row.querySelector('.px-child-note');
          const noteField=fieldWith(row,'.px-child-note');
          if(noteField&&noteInput){
            noteField.classList.add('px-child-note-field');
            noteField.hidden=!noteInput.value;
            const toggle=document.createElement('button');
            toggle.type='button';toggle.className='px-note-toggle secondary';toggle.textContent=noteInput.value?'Edit note':'+ Note';
            const outcomeField=fieldWith(row,'.px-outcome');
            (outcomeField||row).after(toggle);
            toggle.onclick=()=>{
              noteField.hidden=!noteField.hidden;
              toggle.textContent=noteField.hidden?(noteInput.value?'Edit note':'+ Note'):'Hide note';
              if(!noteField.hidden)noteInput.focus();
            };
            row.querySelector('.px-outcome')?.addEventListener('change',e=>{
              if(e.target.value==='Needs follow-up'){
                noteField.hidden=false;toggle.textContent='Hide note';noteInput.focus();
              }
            });
          }
          const visible=row.querySelector('.px-visible')?.closest('.px-check');
          if(visible){visible.classList.add('px-visible-compact');visible.childNodes.forEach(n=>{if(n.nodeType===3)n.textContent=' Parent';});}
        });

        tools.querySelectorAll('[data-px-all]').forEach(btn=>btn.onclick=()=>{
          rows.filter(r=>!r.classList.contains('px-child-absent')).forEach(r=>{const sel=r.querySelector('.px-outcome');if(sel&&!sel.disabled)sel.value=btn.dataset.pxAll;});
        });

        const date=textOf(form.querySelector('.px-head .portal-pill'));
        const me=await teacherMe(),attendance=Array.isArray(me.attendance)?me.attendance:[];
        const dayRows=attendance.filter(a=>a.date===date),map=new Map(dayRows.map(a=>[a.student_id,a.status]));
        let present=0,unavailable=0;
        rows.forEach(row=>{
          const status=map.get(row.dataset.student)||'';
          if(status==='Present')present++;
          if(['Absent','Leave'].includes(status)){
            unavailable++;row.classList.add('px-child-absent');
            row.querySelectorAll('select,input,button').forEach(x=>x.disabled=true);
            const main=row.querySelector('.px-child-main');
            if(main){const badge=document.createElement('span');badge.className='px-attendance-badge';badge.textContent=status;main.append(badge);}
          }
        });
        const summary=tools.querySelector('.px-attendance-summary');
        if(summary)summary.textContent=dayRows.length?(present+' present · '+unavailable+' absent/leave'):'Attendance not marked yet';
      }
    }

    if(record){
      const parentShare=record.querySelector('[name="parent_share"]')?.closest('.px-check');
      if(parentShare&&conduct){parentShare.classList.add('px-parent-share');conduct.append(parentShare);}
      const privateField=fieldWith(record,'[name="teacher_note"]');
      if(privateField){
        const details=document.createElement('details');details.className='px-optional-block';
        const summary=document.createElement('summary');summary.textContent='＋ Internal follow-up note (optional)';
        const body=document.createElement('div');body.className='px-optional-body';
        privateField.before(details);details.append(summary,body);body.append(privateField);
        record.before(details);
      }
      record.hidden=true;
    }

    if(homework){
      const details=document.createElement('details');details.className='px-optional-block';
      if(homework.querySelector('[name="hw_title"]')?.value||homework.querySelector('[name="hw_instructions"]')?.value)details.open=true;
      const summary=document.createElement('summary');summary.textContent='＋ Homework / worksheet (optional)';
      const body=document.createElement('div');body.className='px-optional-body';
      homework.before(details);details.append(summary,body);
      [...homework.children].forEach(ch=>{if(ch.tagName!=='H4')body.append(ch)});
      homework.remove();
    }

    const actions=form.querySelector('.px-actions');
    const save=actions?.querySelector('button[type="submit"]');
    if(save)save.textContent='Save Period Execution';
  }

  const scan=root=>{
    (root.matches?.('.px-form')?[root]:[...root.querySelectorAll?.('.px-form')||[]]).forEach(form=>applyQuickUI(form));
  };
  const observer=new MutationObserver(mutations=>mutations.forEach(m=>m.addedNodes.forEach(n=>{if(n.nodeType===1)scan(n)})));
  observer.observe(document.documentElement,{subtree:true,childList:true});
  document.addEventListener('toggle',e=>{if(e.target instanceof HTMLDetailsElement&&e.target.open)setTimeout(()=>scan(e.target),40)},true);
  scan(document);
})();