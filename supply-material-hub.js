/* NEO School Material Hub + Student Kit Builder */
tabs.splice(5,1,['materials','School Material Hub','▦'],['kits','Student Kit Builder','◫']);

const legacySupplyRender=render;
const materialMoney=paise=>money(Number(paise||0));

function materialCard(p){
 return card(p.name,[`${esc(p.sku)} · ${esc(p.category)} · ${esc(p.status)}`,`${esc(p.program||'School-wide')} · ${esc(p.unit)} · Center price ${materialMoney(p.center_price_paise)}`],`<span class="pill done">${esc(p.program||'School-wide')}</span>`)
}

function renderMaterialHub(c){
 head('NEO School Material Hub','Create every school material once, fix its price here, and reuse it safely in all class kits.');
 const materials=data.products.filter(x=>x.product_type==='Component');
 c.innerHTML=`<section class="stats"><article><span>Total materials</span><strong>${materials.length}</strong></article><article><span>Common materials</span><strong>${materials.filter(x=>x.program==='School-wide').length}</strong></article><article><span>Class-specific</span><strong>${materials.filter(x=>x.program!=='School-wide').length}</strong></article><article><span>Active</span><strong>${materials.filter(x=>x.status==='Active').length}</strong></article></section>
 <section class="panel"><h2>Add material to master</h2><p class="empty">Use <b>School-wide</b> for common items. Use Nursery/LKG/UKG only for class-specific books or materials.</p><form id="materialForm"><div class="fields">
 <label>Material SKU<input name="sku" required placeholder="MAT-BAG-001"></label>
 <label>Material name<input name="name" required placeholder="School Bag"></label>
 <label>Category<select name="category"><option>Uniforms</option><option>Books</option><option>Bags</option><option>Shoes</option><option>Stationery</option><option>ID cards</option><option>Other</option></select></label>
 <label>Applicable class<select name="program"><option>School-wide</option><option>Playgroup</option><option>Nursery</option><option>LKG</option><option>UKG</option><option>Daycare</option></select></label>
 <label>Unit<select name="unit"><option>Piece</option><option>Set</option><option>Pair</option><option>Book</option><option>Box</option></select></label>
 <label>Size / edition<input name="size" placeholder="Standard / 2026–27 / Size 28"></label>
 <label>Standard price INR<input name="standard_price" type="number" min="0.01" step="0.01" required></label>
 <label>Center price INR<input name="center_price" type="number" min="0.01" step="0.01" required></label>
 <label>Reorder level<input name="reorder_level" type="number" min="0" value="0"></label>
 </div><button>Save material & fixed price</button></form></section>
 <section class="panel"><h2>Material master</h2><div class="cards">${materials.map(materialCard).join('')||'<p class="empty">No materials created yet.</p>'}</div></section>`;
 saveForm('#materialForm','products',b=>{b.product_type='Component';b.center_category=b.category==='Books'?'Books':b.category==='Uniforms'?'Uniforms':'Stationery';b.standard_price_paise=Math.round(Number(b.standard_price)*100);b.center_price_paise=Math.round(Number(b.center_price)*100);b.reorder_level=Number(b.reorder_level||0);b.available_to_centers=false;b.components=[];delete b.standard_price;delete b.center_price});
}

function renderKitBuilder(c){
 head('Student Kit Builder','Choose a class, include the required Material Hub items, and save one fixed kit. Prices are read-only.');
 const active=data.products.filter(x=>x.product_type==='Component'&&x.status==='Active');
 c.innerHTML=`<section class="panel"><h2>Create fixed student kit</h2><form id="fixedKitForm"><div class="fields">
 <label>Kit SKU<input name="sku" required placeholder="KIT-NUR-001"></label>
 <label>Kit name<input name="name" required placeholder="NEO Nursery Student Kit"></label>
 <label>Class / programme<select name="program"><option>Playgroup</option><option>Nursery</option><option>LKG</option><option>UKG</option><option>Daycare</option></select></label>
 <label>Edition<input name="size" placeholder="2026–27"></label>
 <label>Total kit price INR<input name="center_price" readonly required></label>
 </div><section class="kit-builder"><div class="kit-builder-head"><div><h3>Material Hub Items</h3><small>Common and selected-class materials load automatically. Untick anything not required.</small></div></div><div id="materialRows"></div><div class="kit-total">Total Kit Price · <span id="fixedKitTotal">₹0.00</span></div></section><button>Save fixed student kit</button></form></section>
 <section class="panel"><h2>Fixed kits</h2><div class="cards">${data.products.filter(x=>x.product_type==='Kit').map(p=>card(p.name,[`${esc(p.sku)} · ${esc(p.program)} · ${esc(p.status)}`,`${p.components?.length||0} materials · Fixed total ${money(p.center_price_paise)}`],`<span class="pill done">${money(p.center_price_paise)}</span>`)).join('')||'<p class="empty">No fixed kits yet.</p>'}</div></section>`;
 const f=$('#fixedKitForm'),rows=$('#materialRows');
 const recalc=()=>{let total=0;rows.querySelectorAll('[data-material-row]').forEach(r=>{const included=r.querySelector('[data-include]').checked,q=Number(r.querySelector('[data-qty]').value||0),price=Number(r.dataset.price||0);r.classList.toggle('hidden-material',!included);r.querySelector('[data-line]').textContent=money(included*q*price);if(included)total+=q*price});f.elements.center_price.value=(total/100).toFixed(2);$('#fixedKitTotal').textContent=money(total)};
 const loadRows=()=>{const program=f.elements.program.value,eligible=active.filter(x=>x.program==='School-wide'||x.program===program);rows.innerHTML=eligible.map((p,i)=>`<div class="kit-row" data-material-row data-id="${esc(p.id)}" data-price="${Number(p.center_price_paise||0)}"><div class="kit-item-no">${i+1}</div><label>Include<input data-include type="checkbox" checked></label><label style="grid-column:span 2">Material<input value="${esc(p.name)}" readonly></label><label>Qty<input data-qty type="number" min="1" step="1" value="1"></label><label>Class<input value="${esc(p.program)}" readonly></label><label>Unit price<input value="${(Number(p.center_price_paise||0)/100).toFixed(2)}" readonly></label><div class="kit-line-total" data-line></div></div>`).join('')||'<p class="empty">Create active common/class materials in Material Hub first.</p>';rows.querySelectorAll('input').forEach(x=>x.oninput=recalc);recalc()};
 f.elements.program.onchange=loadRows;loadRows();
 saveForm('#fixedKitForm','products',b=>{const picked=[...rows.querySelectorAll('[data-material-row]')].filter(r=>r.querySelector('[data-include]').checked);if(!picked.length)throw Error('Select at least one Material Hub item.');b.product_type='Kit';b.category='Complete kit';b.center_category='Student kits';b.unit='Kit';b.reorder_level=0;b.center_price_paise=Math.round(Number(b.center_price)*100);b.available_to_centers=true;b.components=picked.map(r=>({material_id:r.dataset.id,quantity:Number(r.querySelector('[data-qty]').value)}));delete b.center_price});
}

render=function(){
 if(!data.center_orders)return;
 const c=$('#content');
 if(tab==='materials'){renderMaterialHub(c);return}
 if(tab==='kits'){renderKitBuilder(c);return}
 legacySupplyRender();
};

if(token){
 $('#nav').innerHTML=tabs.map(([k,v,i])=>`<button data-tab="${k}"><span class="nav-icon" aria-hidden="true">${i}</span><span class="nav-label">${v}</span></button>`).join('');
 render();
}
