/* Neo School India bulk upload enhancements: direct XLSX reading + correction report. */
(()=>{
'use strict';
if(window.__neoBulkUploadPlus)return;window.__neoBulkUploadPlus=true;

const SHEETJS='https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
let sheetPromise=null,enhanceTimer=0;
function ensureSheetJs(){
  if(window.XLSX)return Promise.resolve(window.XLSX);
  if(sheetPromise)return sheetPromise;
  sheetPromise=new Promise((resolve,reject)=>{
    const existing=document.querySelector('script[data-neo-sheetjs]');
    if(existing){
      existing.addEventListener('load',()=>window.XLSX?resolve(window.XLSX):reject(Error('Excel reader did not initialise.')),{once:true});
      existing.addEventListener('error',()=>reject(Error('Excel reader could not be loaded. Use CSV UTF-8 or check the internet connection.')),{once:true});
      return;
    }
    const s=document.createElement('script');s.src=SHEETJS;s.async=true;s.dataset.neoSheetjs='true';
    s.onload=()=>window.XLSX?resolve(window.XLSX):reject(Error('Excel reader did not initialise.'));
    s.onerror=()=>reject(Error('Excel reader could not be loaded. Use CSV UTF-8 or check the internet connection.'));
    document.head.append(s);
  });
  return sheetPromise;
}

const csvCell=value=>{const text=String(value??'');return /[",\n\r]/.test(text)?'"'+text.replace(/"/g,'""')+'"':text};
function downloadText(filename,text){
  const blob=new Blob(['\uFEFF'+text],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function downloadCorrections(panel){
  const items=(panel._bulkItems||[]).filter(x=>x.errors?.length);
  if(!items.length)return;
  const keys=[];for(const item of items)for(const k of Object.keys(item.data||{}))if(!keys.includes(k))keys.push(k);
  const headers=['source_row',...keys,'validation_error'];
  const rows=items.map(item=>[item.row,...keys.map(k=>item.data?.[k]??''),(item.errors||[]).join(' | ')]);
  downloadText('neo-bulk-upload-corrections.csv',[headers,...rows].map(r=>r.map(csvCell).join(',')).join('\r\n'));
}

async function excelToCsv(file){
  const XLSX=await ensureSheetJs();
  const workbook=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:true,dateNF:'yyyy-mm-dd'});
  if(!workbook.SheetNames?.length)throw Error('The Excel workbook has no worksheets.');
  const sheetName=workbook.SheetNames[0],sheet=workbook.Sheets[sheetName];
  const csv=XLSX.utils.sheet_to_csv(sheet,{FS:',',RS:'\n',dateNF:'yyyy-mm-dd',blankrows:false});
  if(!csv.trim())throw Error('The first Excel worksheet is empty.');
  return {csv,sheetName};
}

function syncCorrectionButton(panel){
  const button=panel.querySelector('[data-bulk-corrections]');if(!button)return;
  const invalid=(panel._bulkItems||[]).filter(x=>x.errors?.length).length;
  const disabled=!invalid,label=invalid?'Download '+invalid+' correction row'+(invalid===1?'':'s'):'Download correction report';
  if(button.disabled!==disabled)button.disabled=disabled;
  if(button.textContent!==label)button.textContent=label;
}

function enhancePanel(panel){
  if(!panel||panel.dataset.bulkPlus)return;panel.dataset.bulkPlus='true';
  const input=panel.querySelector('[data-bulk-file]'),actions=panel.querySelector('.neo-bulk-actions'),result=panel.querySelector('[data-bulk-result]');
  if(!input||!actions)return;
  input.accept='.csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const label=input.closest('label');if(label&&label.childNodes[0]?.textContent!=='Choose Excel / CSV ')label.childNodes[0].textContent='Choose Excel / CSV ';
  const note=panel.querySelector('.neo-bulk-note'),student=/Students/i.test(panel.querySelector('summary')?.textContent||''),noteHtml=student?'<b>Migration workflow:</b> Download the template → fill student details → upload the saved <b>.xlsx</b> directly, or use <b>CSV UTF-8 (.csv)</b>. Student ID and Admission No. are generated automatically. Valid rows are imported class-wise: Playgroup → Nursery → LKG → UKG → Daycare.':'<b>Migration workflow:</b> Download the template → fill it in Excel → upload the saved <b>.xlsx</b> directly, or use <b>CSV UTF-8 (.csv)</b>. Existing Staff IDs are preserved when valid; leave Staff ID blank to generate a new one.';if(note&&note.innerHTML!==noteHtml)note.innerHTML=noteHtml;
  const template=panel.querySelector('[data-bulk-template]');if(template&&template.textContent!=='Download Excel-compatible template')template.textContent='Download Excel-compatible template';
  const correction=document.createElement('button');correction.type='button';correction.className='secondary';correction.dataset.bulkCorrections='true';correction.disabled=true;correction.textContent='Download correction report';correction.onclick=()=>downloadCorrections(panel);actions.append(correction);

  const original=input.onchange;
  input.onchange=async e=>{
    const file=e.target.files?.[0];if(!file)return;
    if(/\.xlsx$/i.test(file.name)){
      try{
        if(result)result.textContent='Opening Excel workbook locally…';
        const {csv,sheetName}=await excelToCsv(file);
        const csvFile=new File([csv],file.name.replace(/\.xlsx$/i,'')+'.csv',{type:'text/csv'});
        if(result)result.textContent='Excel sheet “'+sheetName+'” opened. Validating rows…';
        if(typeof original==='function')original.call(input,{target:{files:[csvFile]}});
      }catch(error){
        panel._bulkItems=[];panel.querySelector('[data-bulk-summary]')?.replaceChildren();panel.querySelector('[data-bulk-preview]')?.replaceChildren();panel.querySelector('[data-bulk-import]')?.setAttribute('disabled','');if(result)result.textContent=error.message;syncCorrectionButton(panel);
      }
      return;
    }
    if(typeof original==='function')original.call(input,e);
  };
  let syncQueued=false;
  new MutationObserver(()=>{if(syncQueued)return;syncQueued=true;requestAnimationFrame(()=>{syncQueued=false;if(panel.isConnected)syncCorrectionButton(panel)})}).observe(panel,{childList:true,subtree:true});
  syncCorrectionButton(panel);
}

function enhance(){document.querySelectorAll('#neoBulkUploadPanel:not([data-bulk-plus])').forEach(enhancePanel)}
function scheduleEnhance(){clearTimeout(enhanceTimer);enhanceTimer=setTimeout(enhance,40)}
new MutationObserver(()=>{if(document.querySelector('#neoBulkUploadPanel:not([data-bulk-plus])'))scheduleEnhance()}).observe(document.body,{childList:true,subtree:true});
enhance();
})();
