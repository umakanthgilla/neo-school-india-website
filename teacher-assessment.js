(()=>{
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const uniq=a=>[...new Set(a.filter(Boolean))];
const shuffle=a=>a.slice().sort(()=>Math.random()-.5);
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const classLabel=c=>[c?.program,c?.name&&c?.name!==c?.program?'Section '+c.name:'',c?.academic_year].filter(Boolean).join(' · ');

function completedRows(data){
 const feed=Array.isArray(data?.learning?.feed?.activities)?data.learning.feed.activities:[];
 const plans=Array.isArray(data?.learning?.plans?.plans)?data.learning.plans.plans:[];
 return feed.map(x=>{
   const p=plans.find(p=>p.id===x.plan_id);
   const l=p?.lessons?.find(l=>String(l.id)===String(x.lesson_id));
   return {...x,...(l||{})};
 });
}
function chapterOf(x){return String(x.chapter||x.unit||x.concept||'Topic').trim()}

window.renderNeoTeacherQuestionBank=function(area,{data,api,status,refresh}){
 const rows=completedRows(data),classes=data.classrooms||[],bank=data.question_bank||[];
 const classOpts=classes.map(c=>'<option value="'+esc(c.id)+'">'+esc(classLabel(c)||c.id)+'</option>').join('');
 area.innerHTML=
 '<div class="learning-welcome"><div><span class="eyebrow">MY TEACHING · QUESTION BANK</span><h2>Question Bank</h2><p>Questions are created only from lessons you personally marked complete. Review them, select the best ones and approve them for your own online tests.</p></div></div>'+
 '<section class="panel"><h3>Generate from my completed lessons</h3><div class="fields"><label>Classroom<select id="tqbClass"><option value="">Choose classroom…</option>'+classOpts+'</select></label><label>Subject<select id="tqbSubject"><option value="">Choose class first…</option></select></label><label>Difficulty<select id="tqbDifficulty"><option>Mixed</option><option>Basic</option><option>Medium</option><option>Hard</option></select></label></div><div id="tqbTopics" class="portal-card"><p>Select class and subject.</p></div><button type="button" id="tqbGenerate">Generate draft questions</button></section>'+
 '<section class="panel"><div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap"><div><h3 style="margin-bottom:4px">My question bank</h3><p style="margin:0">Compact review · select the questions you want · approve together.</p></div><div class="actions"><button type="button" id="tqbApprove">Approve selected</button><button type="button" class="secondary" id="tqbDraft">Return selected to draft</button></div></div><div class="fields" style="margin-top:14px"><label>Search<input id="tqbSearch" type="search" placeholder="Question, subject, chapter"></label><label>Status<select id="tqbStatus"><option value="">All</option><option>Draft</option><option>Approved</option></select></label><label>Difficulty<select id="tqbFilterDifficulty"><option value="">All</option><option>Basic</option><option>Medium</option><option>Hard</option></select></label></div><div id="tqbSummary" class="portal-system-note"><strong>0 selected</strong><span>Only your own questions are shown.</span></div><div id="tqbList"></div></section>';

 const cs=area.querySelector('#tqbClass'),ss=area.querySelector('#tqbSubject'),topicBox=area.querySelector('#tqbTopics');
 cs.onchange=()=>{const subs=uniq(rows.filter(x=>x.classroom_id===cs.value).map(x=>x.subject));ss.innerHTML='<option value="">Choose subject…</option>'+subs.map(x=>'<option>'+esc(x)+'</option>').join('');topicBox.innerHTML='<p>Choose subject.</p>'};
 ss.onchange=()=>{const topics=uniq(rows.filter(x=>x.classroom_id===cs.value&&x.subject===ss.value).map(chapterOf));topicBox.innerHTML=topics.length?'<label><input type="checkbox" id="tqbAllTopics"> Select all completed topics</label><div class="portal-grid">'+topics.map(t=>'<label class="portal-card"><input type="checkbox" data-tqb-topic value="'+esc(t)+'"> <strong>'+esc(t)+'</strong></label>').join('')+'</div>':'<p>No completed topics found.</p>';const all=topicBox.querySelector('#tqbAllTopics');if(all)all.onchange=()=>topicBox.querySelectorAll('[data-tqb-topic]').forEach(x=>x.checked=all.checked)};

 area.querySelector('#tqbGenerate').onclick=async e=>{
   const cid=cs.value,subject=ss.value,diff=area.querySelector('#tqbDifficulty').value,topics=[...topicBox.querySelectorAll('[data-tqb-topic]:checked')].map(x=>x.value);
   if(!cid||!subject||!topics.length)return status('Choose classroom, subject and at least one completed topic.');
   const source=rows.filter(x=>x.classroom_id===cid&&x.subject===subject&&topics.includes(chapterOf(x)));
   if(!source.length)return status('No completed lesson data found.');
   e.target.disabled=true;
   try{
     let count=0;const concepts=uniq(rows.filter(x=>x.classroom_id===cid&&x.subject===subject).map(chapterOf));
     for(const row of source.slice(0,20)){
       const chapter=chapterOf(row),levels=diff==='Mixed'?['Basic','Medium','Hard']:[diff];
       for(const level of levels){
         let type='Short Answer',question='',answer='',options=[];
         if(level==='Basic'){
           type='MCQ';question=row.objective?'Which topic best matches this learning objective: "'+row.objective+'"?':'Which topic was completed in this lesson?';answer=chapter;
           options=shuffle(uniq([chapter,...concepts.filter(x=>x!==chapter)])).slice(0,4);while(options.length<2)options.push('None of these');if(!options.includes(chapter))options[0]=chapter;
         }else if(level==='Medium'){
           question=row.question_1||row.question_2||('Explain '+chapter+' in your own words.');
         }else{
           question=row.question_3||row.question_2||('Apply '+chapter+' to a new example and explain your reasoning.');
         }
         await api('question-bank','POST',{request_id:crypto.randomUUID(),classroom_id:cid,subject,chapter,topic:row.concept||chapter,difficulty:level,question_type:type,question_text:question,options,correct_answer:answer,marks:level==='Hard'?2:1,source:'My completed curriculum',source_lesson_id:String(row.lesson_id||row.id||'')});
         count++;
       }
     }
     status('✓ '+count+' draft questions generated from your completed lessons.');await refresh();
   }catch(err){status(err.message);e.target.disabled=false}
 };

 const selected=new Set(),search=area.querySelector('#tqbSearch'),sf=area.querySelector('#tqbStatus'),df=area.querySelector('#tqbFilterDifficulty'),summary=area.querySelector('#tqbSummary');
 const filtered=()=>bank.filter(q=>{const term=search.value.trim().toLowerCase();return(!term||[q.question_text,q.subject,q.chapter,q.topic].join(' ').toLowerCase().includes(term))&&(!sf.value||q.status===sf.value)&&(!df.value||q.difficulty===df.value)});
 const sync=()=>summary.innerHTML='<strong>'+selected.size+' selected</strong><span>'+filtered().length+' of your questions shown.</span>';
 const draw=()=>{
   const list=filtered().slice(0,150);
   area.querySelector('#tqbList').innerHTML=list.length?'<div class="table-wrap"><table><thead><tr><th><input id="tqbAll" type="checkbox"></th><th>Level / Type</th><th>Question</th><th>Subject / Chapter</th><th>Marks</th><th>Status</th><th>Preview</th></tr></thead><tbody>'+list.map(q=>'<tr><td><input type="checkbox" data-tqb-select="'+esc(q.id)+'" '+(selected.has(q.id)?'checked':'')+'></td><td><span class="eyebrow">'+esc(q.difficulty)+'</span><br><small>'+esc(q.question_type)+'</small></td><td><b>'+esc(q.question_text.length>150?q.question_text.slice(0,150)+'…':q.question_text)+'</b></td><td>'+esc(q.subject)+'<br><small>'+esc(q.chapter)+'</small></td><td>'+esc(q.marks)+'</td><td><b>'+esc(q.status)+'</b></td><td><button class="secondary" type="button" data-tqb-view="'+esc(q.id)+'">View</button></td></tr><tr hidden data-tqb-detail="'+esc(q.id)+'"><td colspan="7"><div class="portal-card"><p><b>Full question:</b> '+esc(q.question_text)+'</p>'+(q.options?.length?'<p><b>Options:</b> '+q.options.map(esc).join(' · ')+'</p>':'')+'<p><b>Correct answer:</b> '+esc(q.correct_answer||'Teacher review')+'</p></div></td></tr>').join('')+'</tbody></table></div>':'<p class="portal-empty">No questions match these filters.</p>';
   area.querySelectorAll('[data-tqb-select]').forEach(x=>x.onchange=()=>{x.checked?selected.add(x.dataset.tqbSelect):selected.delete(x.dataset.tqbSelect);sync()});
   const all=area.querySelector('#tqbAll');if(all){const ids=list.map(x=>x.id);all.checked=ids.length&&ids.every(id=>selected.has(id));all.onchange=()=>{ids.forEach(id=>all.checked?selected.add(id):selected.delete(id));draw()}};
   area.querySelectorAll('[data-tqb-view]').forEach(b=>b.onclick=()=>{const d=area.querySelector('[data-tqb-detail="'+CSS.escape(b.dataset.tqbView)+'"]');d.hidden=!d.hidden;b.textContent=d.hidden?'View':'Hide'});sync();
 };
 async function batch(state){const ids=[...selected];if(!ids.length)return status('Select at least one question first.');try{for(const id of ids){const q=bank.find(x=>x.id===id);await api('question-bank/'+id,'PATCH',{status:state,question_text:q.question_text,correct_answer:q.correct_answer||'',marks:q.marks||1})}status('✓ '+ids.length+' question'+(ids.length===1?'':'s')+' '+(state==='Approved'?'approved':'returned to draft')+'.');await refresh()}catch(err){status(err.message)}}
 area.querySelector('#tqbApprove').onclick=()=>batch('Approved');area.querySelector('#tqbDraft').onclick=()=>batch('Draft');[search,sf,df].forEach(el=>el.addEventListener(el===search?'input':'change',draw));draw();
};

window.renderNeoTeacherOnlineTests=function(area,{data,api,status,refresh}){
 const bank=(data.question_bank||[]).filter(q=>q.status==='Approved'),tests=data.online_tests||[],attempts=data.online_test_attempts||[],classes=data.classrooms||[];
 const classOpts=classes.map(c=>'<option value="'+esc(c.id)+'">'+esc(classLabel(c)||c.id)+'</option>').join('');
 const pending=attempts.filter(x=>x.status==='Pending review');
 area.innerHTML=
 '<div class="learning-welcome"><div><span class="eyebrow">MY TEACHING · ONLINE TESTS</span><h2>Online Tests</h2><p>Create tests from your approved question bank, publish directly to your assigned class, and review short answers here.</p></div></div>'+
 '<div class="portal-grid"><article class="portal-card"><h3>My approved questions</h3><strong class="metric">'+bank.length+'</strong></article><article class="portal-card"><h3>My tests</h3><strong class="metric">'+tests.length+'</strong></article><article class="portal-card"><h3>Pending reviews</h3><strong class="metric">'+pending.length+'</strong></article></div>'+
 '<section class="panel"><h3>Create Online Test</h3><form id="ttestForm"><div class="fields"><label>Classroom<select name="classroom_id" id="ttestClass" required><option value="">Choose…</option>'+classOpts+'</select></label><label>Subject<select name="subject" id="ttestSubject" required><option value="">Choose class first…</option></select></label><label>Difficulty<select name="difficulty"><option>Mixed</option><option>Basic</option><option>Medium</option><option>Hard</option></select></label><label>No. of questions<input name="count" type="number" min="1" max="100" value="10"></label><label>Duration<input name="duration_minutes" type="number" min="5" max="180" value="20"></label><label>Attempts<input name="attempts_allowed" type="number" min="1" max="5" value="1"></label><label>Start date<input name="start_date" type="date" value="'+today()+'" required></label><label>Due date<input name="due_date" type="date" value="'+today()+'" required></label></div><label>Test title<input name="title" maxlength="180" required placeholder="Weekly test"></label><div id="ttestChapters" class="portal-card"><p>Choose class and subject.</p></div><label><input type="checkbox" name="show_result" checked> Show auto-evaluated result after submission</label><button type="submit">Publish Test</button></form></section>'+
 '<h3>My tests</h3><div class="portal-grid">'+(tests.map(t=>'<article class="portal-card"><span class="eyebrow">'+esc(t.status)+'</span><h3>'+esc(t.title)+'</h3><p>'+esc(t.subject)+' · '+esc((t.chapters||[]).join(', '))+'</p><p>'+esc((t.question_ids||[]).length)+' questions · '+esc(t.duration_minutes)+' min · '+esc(t.start_date)+' → '+esc(t.due_date)+'</p></article>').join('')||'<p class="portal-empty">You have not published a test yet.</p>')+'</div>'+
 '<h3>Short-answer review</h3><div id="ttestReviews">'+(pending.map(a=>{const short=(a.answers||[]).filter(ans=>bank.find(q=>q.id===ans.question_id)?.question_type==='Short Answer');return '<section class="portal-card"><span class="eyebrow">'+esc(a.test_title||'Online test')+'</span><h3>'+esc(a.student_name||a.student_id)+'</h3><p>Auto score: <b>'+esc(a.auto_score)+'/'+esc(a.total_marks)+'</b></p><form data-ttest-review="'+esc(a.id)+'">'+short.map((ans,i)=>{const q=bank.find(x=>x.id===ans.question_id),max=Number(ans.max_marks||q?.marks||1);return '<fieldset class="portal-card"><legend><b>Q'+(i+1)+'.</b> '+esc(q?.question_text||ans.question_id)+'</legend><p><b>Student answer:</b> '+esc(ans.response||'No answer')+'</p><label>Marks (0–'+max+')<input type="number" min="0" max="'+max+'" step="1" name="'+esc(ans.question_id)+'" required></label></fieldset>'}).join('')+'<button>Save review</button></form></section>'}).join('')||'<p class="portal-empty">No short-answer reviews pending.</p>')+'</div>';

 const cs=area.querySelector('#ttestClass'),ss=area.querySelector('#ttestSubject'),chap=area.querySelector('#ttestChapters');
 cs.onchange=()=>{const subs=uniq(bank.filter(q=>q.classroom_id===cs.value).map(q=>q.subject));ss.innerHTML='<option value="">Choose subject…</option>'+subs.map(s=>'<option>'+esc(s)+'</option>').join('');chap.innerHTML='<p>Choose subject.</p>'};
 ss.onchange=()=>{const chs=uniq(bank.filter(q=>q.classroom_id===cs.value&&q.subject===ss.value).map(q=>q.chapter));chap.innerHTML=chs.length?'<label><input type="checkbox" id="ttestAll"> Select all chapters</label><div class="portal-grid">'+chs.map(x=>'<label class="portal-card"><input type="checkbox" data-ttest-chapter value="'+esc(x)+'"> '+esc(x)+'</label>').join('')+'</div>':'<p>No approved questions for this subject.</p>';const all=chap.querySelector('#ttestAll');if(all)all.onchange=()=>chap.querySelectorAll('[data-ttest-chapter]').forEach(x=>x.checked=all.checked)};
 area.querySelector('#ttestForm').onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.target),b=Object.fromEntries(fd),chapters=[...chap.querySelectorAll('[data-ttest-chapter]:checked')].map(x=>x.value);if(!chapters.length)return status('Select at least one chapter.');const count=Math.max(1,Math.min(100,Number(b.count)||10)),pool=bank.filter(q=>q.classroom_id===b.classroom_id&&q.subject===b.subject&&chapters.includes(q.chapter));let picked=[];if(b.difficulty==='Mixed'){const bs=shuffle(pool.filter(q=>q.difficulty==='Basic')),ms=shuffle(pool.filter(q=>q.difficulty==='Medium')),hs=shuffle(pool.filter(q=>q.difficulty==='Hard'));picked=[...bs.slice(0,Math.ceil(count*.4)),...ms.slice(0,Math.ceil(count*.4)),...hs.slice(0,Math.max(1,Math.floor(count*.2)))];picked=uniq(picked.map(q=>q.id)).map(id=>pool.find(q=>q.id===id));if(picked.length<count)picked=[...picked,...shuffle(pool.filter(q=>!picked.some(x=>x.id===q.id))).slice(0,count-picked.length)]}else picked=shuffle(pool.filter(q=>q.difficulty===b.difficulty)).slice(0,count);if(!picked.length)return status('Not enough approved questions. Approve questions in My Question Bank first.');e.submitter.disabled=true;try{await api('online-tests','POST',{request_id:crypto.randomUUID(),title:b.title,classroom_id:b.classroom_id,subject:b.subject,chapters,difficulty:b.difficulty,question_ids:picked.map(q=>q.id),duration_minutes:Number(b.duration_minutes),attempts_allowed:Number(b.attempts_allowed),start_date:b.start_date,due_date:b.due_date,show_result:fd.has('show_result')});status('✓ Test published with '+picked.length+' questions.');await refresh()}catch(err){status(err.message);e.submitter.disabled=false}};
 area.querySelectorAll('[data-ttest-review]').forEach(form=>form.onsubmit=async e=>{e.preventDefault();const grades=Object.fromEntries(new FormData(form));e.submitter.disabled=true;try{const r=await api('online-test-review','POST',{attempt_id:form.dataset.ttestReview,grades});status('✓ Review saved. Final score '+r.final_score+'/'+r.total_marks+'.');await refresh()}catch(err){status(err.message);e.submitter.disabled=false}});
};
})();