/* Calendar publish compatibility + compact calendar display fix. */
(()=>{
  const original=window.renderNeoCalendar;
  if(typeof original!=='function') return;

  const canonicalType=value=>{
    const raw=String(value??'').trim();
    const key=raw.toLowerCase().replace(/\s+/g,' ');
    const aliases={
      'holiday':'Holiday','event':'Event','meeting':'Meeting','ptm':'PTM',
      'ptm / meeting':'PTM','ptm/meeting':'PTM','celebration':'Celebration',
      'academic':'Academic','academic event':'Academic','assessment':'Assessment',
      'exam':'Exam','assessment / exam':'Assessment','assessment/exam':'Assessment',
      'school reopening':'School reopening','school re-opening':'School reopening',
      'reopening':'School reopening','other':'Other'
    };
    return aliases[key]||raw;
  };

  const allowed=new Set(['Holiday','PTM','Meeting','Celebration','Event','Academic','Assessment','Exam','School reopening','Other']);
  function normalizeEvents(events){
    return (Array.isArray(events)?events:[]).map((event,index)=>{
      const e={...event};
      e.date=String(e.date??'').trim();e.type=canonicalType(e.type);
      e.title=String(e.title??'').trim();e.description=String(e.description??'').trim();
      if(!e.description&&e.title)e.description=e.title;
      if(!/^\d{4}-\d{2}-\d{2}$/.test(e.date))throw Error(`Calendar row ${index+1}: invalid date.`);
      if(!e.title)throw Error(`Calendar row ${index+1}: title is missing.`);
      if(!allowed.has(e.type))throw Error(`Calendar row ${index+1}: unsupported category “${e.type||'blank'}”.`);
      if(e.title.length>160)throw Error(`Calendar row ${index+1}: title is longer than 160 characters.`);
      if(e.description.length>2000)throw Error(`Calendar row ${index+1}: description is longer than 2000 characters.`);
      return e;
    });
  }

  window.renderNeoCalendar=async function(area,options){
    const api=options.api;
    const wrapped={...options,api:async(kind,body)=>{
      if(kind==='calendar'&&body&&Array.isArray(body.events))body={...body,events:normalizeEvents(body.events)};
      return api(kind,body);
    }};
    return original(area,wrapped);
  };

  /* Calendar grid: one visible priority dot per date; details table remains unchanged. */
  const priority=['holiday','assessment','celebration','meeting','reopening','academicEvent','event','other','academic'];
  const compact=()=>{
    document.querySelectorAll('.neo-month-day').forEach(day=>{
      day.style.setProperty('min-height','60px','important');
      day.style.setProperty('padding','6px 8px','important');
    });
    document.querySelectorAll('.neo-calendar-markers').forEach(group=>{
      group.style.marginTop='7px';group.style.gap='0';
      const dots=[...group.querySelectorAll('.neo-calendar-dot')];
      if(!dots.length)return;
      const chosen=priority.map(k=>dots.find(d=>d.classList.contains(k))).find(Boolean)||dots[0];
      dots.forEach(d=>{d.style.display=d===chosen?'inline-block':'none'});
      chosen.style.setProperty('width','12px','important');
      chosen.style.setProperty('height','12px','important');
      chosen.style.setProperty('flex','0 0 12px','important');
      chosen.style.setProperty('border-radius','50%','important');
    });
  };
  let queued=false;
  const observer=new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;compact()})});
  observer.observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('DOMContentLoaded',compact);
})();
