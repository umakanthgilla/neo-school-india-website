/* Complete-kit batch dispatch: one consignment in the UI, item-wise audit lines underneath. */
function renderDispatchBatch(c){
  head('Dispatch & Courier Tracking','Dispatch one complete kit consignment while every packed material remains individually traceable.');
  const packs=data.packs||[],shipments=data.shipments||[],orders=data.center_orders||[];
  const liveShipment=s=>!['Cancelled'].includes(s.status);
  const packHasShipment=p=>shipments.some(s=>String(s.pack_id)===String(p.id)&&liveShipment(s));
  const readyGroups=new Map();
  packs.filter(p=>['Packed','Quality Checked'].includes(p.status)&&!packHasShipment(p)).forEach(p=>{
    const key=String(p.center_order_id||`${p.school_id}|${p.school_name}|${p.notes||''}`);
    const order=orders.find(o=>String(o.id)===String(p.center_order_id)&&String(o.school_id)===String(p.school_id));
    const group=readyGroups.get(key)||{key,school_id:p.school_id,school_name:p.school_name,center_order_id:p.center_order_id,kit_name:order?.item_name||String(p.notes||'Complete Student Kit').split(' · ')[0],kit_quantity:Number(order?.quantity||1),boxes:Number(p.box_count||1),packs:[]};
    group.packs.push(p);readyGroups.set(key,group);
  });
  const batches=[...readyGroups.values()];
  const shipmentGroups=new Map();
  shipments.filter(liveShipment).forEach(s=>{
    const p=packs.find(x=>String(x.id)===String(s.pack_id)),key=[s.school_id||s.school_name,s.awb_no,s.dispatch_date].join('|');
    const order=orders.find(o=>String(o.id)===String(p?.center_order_id)&&String(o.school_id)===String(p?.school_id));
    const group=shipmentGroups.get(key)||{key,school_name:s.school_name,kit_name:order?.item_name||'Complete Student Kit',awb_no:s.awb_no,courier_partner:s.courier_partner,dispatch_date:s.dispatch_date,expected_delivery:s.expected_delivery,box_count:Number(s.box_count||p?.box_count||1),status:s.status,items:[]};
    group.items.push(s);if(s.status==='Delivered')group.status=group.items.every(x=>x.status==='Delivered')?'Delivered':group.status;shipmentGroups.set(key,group);
  });
  const sentBatches=[...shipmentGroups.values()].map(g=>({...g,status:g.items.every(x=>x.status==='Delivered')?'Delivered':g.items.some(x=>x.status==='In Transit')?'In Transit':'Dispatched'}));
  c.innerHTML=`<section class="stats"><article><span>Ready kit consignments</span><strong>${batches.length}</strong></article><article><span>Item lines inside</span><strong>${batches.reduce((n,g)=>n+g.packs.length,0)}</strong></article><article><span>Dispatched consignments</span><strong>${sentBatches.length}</strong></article><article><span>Dispatch mode</span><strong>One click</strong></article></section>
  <section class="panel"><h2>Dispatch Complete Kit</h2><p class="empty">Select one complete kit. Its item-wise packing records will travel under one AWB / LR number.</p><form id="batchShipForm"><div class="fields"><label>Ready complete kit<select name="batch_key" required><option value="">Choose complete kit…</option>${batches.map(g=>`<option value="${esc(g.key)}">${esc(g.school_name)} · ${esc(g.kit_name)} · ${g.kit_quantity} kit · ${g.packs.length} items</option>`).join('')}</select></label><label>Boxes<input name="box_count" type="number" min="1" value="1" required></label><label>Courier partner<input name="courier_partner" required></label><label>AWB / LR number<input name="awb_no" required></label><label>Dispatch date<input name="dispatch_date" type="date" required></label><label>Expected delivery<input name="expected_delivery" type="date" required></label><label>Freight INR<input name="freight" type="number" min="0" step=".01" value="0"></label><label>Tracking / proof URL<input name="proof_url"></label><label>Notes<textarea name="notes"></textarea></label></div><div id="dispatchBatchSummary" class="printing-order" hidden></div><button id="dispatchBatchButton" disabled>Dispatch Complete Kit</button></form></section>
  <section class="panel"><h2>Consignment tracker</h2><div class="cards">${sentBatches.map(g=>card(g.school_name+' · '+g.kit_name,[`${esc(g.courier_partner)} · AWB ${esc(g.awb_no)}`,`${g.items.length} tracked materials · ${esc(g.box_count)} boxes`,`Dispatched ${esc(g.dispatch_date)} · Expected ${esc(g.expected_delivery)}`],g.status==='Delivered'?`<span class="pill done">Delivered</span>`:`<div class="toolbar"><button data-ship-batch="${esc(g.key)}" data-status="In Transit">In transit</button><button data-ship-batch="${esc(g.key)}" data-status="Delivered">Delivered</button></div>`)).join('')||'<p class="empty">No complete-kit consignments dispatched yet.</p>'}</div></section>`;
  const form=$('#batchShipForm'),select=form.elements.batch_key,summary=$('#dispatchBatchSummary'),button=$('#dispatchBatchButton');form.elements.dispatch_date.value=today();
  const selected=()=>batches.find(g=>g.key===select.value);
  select.onchange=()=>{const g=selected();if(!g){summary.hidden=true;button.disabled=true;return}form.elements.box_count.value=g.boxes||1;summary.hidden=false;summary.innerHTML=`<div class="packing-alert ready">✓ One consignment: ${esc(g.kit_name)} · ${g.kit_quantity} kit · ${g.packs.length} materials · ${g.boxes||1} box</div>`;button.disabled=false};
  form.onsubmit=async e=>{e.preventDefault();const g=selected();if(!g)return;button.disabled=true;const v=Object.fromEntries(new FormData(form));let completed=0;try{for(const p of g.packs){await api('/api/supply/shipments','POST',{pack_id:p.id,courier_partner:v.courier_partner,awb_no:v.awb_no,dispatch_date:v.dispatch_date,expected_delivery:v.expected_delivery,freight_paise:completed?0:Math.round(Number(v.freight||0)*100),proof_url:v.proof_url,notes:`${g.kit_name} · Complete kit batch · ${v.notes||''}`,box_count:Number(v.box_count||1)});completed++}await load();note(`✓ ${g.kit_name} dispatched as one consignment with ${completed} tracked materials.`)}catch(x){note(`${x.message} (${completed} item lines dispatched before the error.)`,true);button.disabled=false}};
  c.querySelectorAll('[data-ship-batch]').forEach(b=>b.onclick=async()=>{b.disabled=true;const g=shipmentGroups.get(b.dataset.shipBatch);let completed=0;try{for(const s of g.items){if(s.status===b.dataset.status)continue;await api('/api/supply/shipments/'+encodeURIComponent(s.id),'PATCH',{status:b.dataset.status});completed++}await load();note(`✓ Complete kit consignment updated to ${b.dataset.status}.`)}catch(x){note(`${x.message} (${completed} lines updated.)`,true);b.disabled=false}});
}

const renderBeforeBatchDispatch=render;
render=function(){if(tab==='dispatch'&&data.center_orders){renderDispatchBatch($('#content'));return}renderBeforeBatchDispatch()};
if(token&&data.center_orders)render();
