/* Calendar publish compatibility fix.
   Keeps the visible draft unchanged, but normalizes imported rows before the
   school sends them to the Worker so one incomplete spreadsheet description
   cannot block the whole calendar publish. */
(()=>{
  const original=window.renderNeoCalendar;
  if(typeof original!=='function') return;

  const canonicalType=value=>{
    const raw=String(value??'').trim();
    const key=raw.toLowerCase().replace(/\s+/g,' ');
    const aliases={
      'holiday':'Holiday',
      'event':'Event',
      'meeting':'Meeting',
      'ptm':'PTM',
      'ptm / meeting':'PTM',
      'ptm/meeting':'PTM',
      'celebration':'Celebration',
      'academic':'Academic',
      'academic event':'Academic',
      'assessment':'Assessment',
      'exam':'Exam',
      'assessment / exam':'Assessment',
      'assessment/exam':'Assessment',
      'school reopening':'School reopening',
      'school re-opening':'School reopening',
      'reopening':'School reopening',
      'other':'Other'
    };
    return aliases[key]||raw;
  };

  const allowed=new Set(['Holiday','PTM','Meeting','Celebration','Event','Academic','Assessment','Exam','School reopening','Other']);

  function normalizeEvents(events){
    return (Array.isArray(events)?events:[]).map((event,index)=>{
      const e={...event};
      e.date=String(e.date??'').trim();
      e.type=canonicalType(e.type);
      e.title=String(e.title??'').trim();
      e.description=String(e.description??'').trim();

      if(!e.description && e.title) e.description=e.title;

      if(!/^\d{4}-\d{2}-\d{2}$/.test(e.date))
        throw Error(`Calendar row ${index+1}: invalid date.`);
      if(!e.title)
        throw Error(`Calendar row ${index+1}: title is missing.`);
      if(!allowed.has(e.type))
        throw Error(`Calendar row ${index+1}: unsupported category “${e.type||'blank'}”.`);
      if(e.title.length>160)
        throw Error(`Calendar row ${index+1}: title is longer than 160 characters.`);
      if(e.description.length>2000)
        throw Error(`Calendar row ${index+1}: description is longer than 2000 characters.`);
      return e;
    });
  }

  window.renderNeoCalendar=async function(area,options){
    const api=options.api;
    const wrapped={...options,api:async(kind,body)=>{
      if(kind==='calendar' && body && Array.isArray(body.events)){
        body={...body,events:normalizeEvents(body.events)};
      }
      return api(kind,body);
    }};
    return original(area,wrapped);
  };
})();
