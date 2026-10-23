const gradePoints = { 'A+':4,'A':4,'A-':3.7,'B+':3.3,'B':3,'B-':2.7,'C+':2.3,'C':2,'C-':1.7,'D+':1.3,'D':1,'E':0 };
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const round2 = n => Math.sign(n)*Math.round((Math.abs(n)+Number.EPSILON)*100)/100;
const format2 = n => round2(n).toFixed(2);
// Remove the earlier demo-only browser records; Google Sheets is now the source of truth.
localStorage.removeItem('gradepath-courses');localStorage.removeItem('gradepath-history');
let courses = [];
let history = [];
let loadedRecordId = null;
let accessKey = sessionStorage.getItem('gradepath-access-key') || '';
function pointsFor(course){const raw=gradePoints[course.grade]??0;return course.repeat?Math.min(raw,2):raw}
function totals(list){return list.reduce((a,c)=>{if(c.nonGpa||gradePoints[c.grade]===undefined)return a;const cp=Number(c.credits)||0,gp=pointsFor(c);a.credits+=cp;a.quality+=gp*cp;return a},{credits:0,quality:0})}
function renderCourses(){
  $('courses').innerHTML=courses.length?`<div class="course-list">${courses.map((c,i)=>`<article class="course-card ${c.nonGpa?'excluded':''}"><div class="course-head"><input class="course-name" aria-label="Course name" placeholder="Course name" data-name="${i}" value="${esc(c.name)}"><button class="delete-course" aria-label="Remove course" data-delete="${i}">⌫</button></div><span class="course-tag">${esc(c.category||'Course')}</span><div class="course-fields"><div class="course-field"><label for="credit-${i}">Credit Points</label><select id="credit-${i}" data-credit="${i}"><option value="0" ${Number(c.credits)===0?'selected':''}>Select credits</option>${[1,2,3,4,5,6].map(n=>`<option value="${n}" ${Number(c.credits)===n?'selected':''}>${n.toFixed(1)} Credits</option>`).join('')}</select></div><div class="course-field"><label for="grade-${i}">Grade Point</label><select id="grade-${i}" data-grade="${i}" ${c.nonGpa?'disabled':''}><option value="" ${!c.grade?'selected':''}>Select grade</option>${Object.entries(gradePoints).map(([g,p])=>`<option value="${g}" ${c.grade===g?'selected':''}>${g} (${p.toFixed(2)})</option>`).join('')}</select></div><div class="course-field"><label for="year-${i}">Degree Year</label><select id="year-${i}" data-year="${i}">${[1,2,3,4].map(y=>`<option value="${y}" ${Number(c.year)===y?'selected':''}>Year ${y}</option>`).join('')}</select></div><div class="course-flags"><label><input type="checkbox" data-repeat="${i}" ${c.repeat?'checked':''} ${c.nonGpa?'disabled':''}> Repeat exam <span class="cap-note">cap C / 2.00</span></label><label><input type="checkbox" data-nongpa="${i}" ${c.nonGpa?'checked':''}> Non-GPA subject</label></div></div></article>`).join('')}</div>`:'<p class="empty-history">No course entries. Add a course to start this term.</p>';
  document.querySelectorAll('[data-credit]').forEach(el=>el.addEventListener('change',()=>{courses[el.dataset.credit].credits=Number(el.value);calculate()}));
  document.querySelectorAll('[data-grade]').forEach(el=>el.addEventListener('change',()=>{courses[el.dataset.grade].grade=el.value;calculate()}));
  document.querySelectorAll('[data-year]').forEach(el=>el.addEventListener('change',()=>{courses[el.dataset.year].year=Number(el.value);calculate()}));
  document.querySelectorAll('[data-name]').forEach(el=>el.addEventListener('change',()=>{courses[el.dataset.name].name=el.value}));
  document.querySelectorAll('[data-repeat]').forEach(el=>el.addEventListener('change',()=>{courses[el.dataset.repeat].repeat=el.checked;calculate()}));
  document.querySelectorAll('[data-nongpa]').forEach(el=>el.addEventListener('change',()=>{courses[el.dataset.nongpa].nonGpa=el.checked;renderCourses();calculate()}));
  document.querySelectorAll('[data-delete]').forEach(el=>el.addEventListener('click',()=>{courses.splice(Number(el.dataset.delete),1);renderCourses();calculate()}));
  $('course-count').textContent=courses.length;
}
function yearSummaries(){
  const records=history.filter(h=>Array.isArray(h.courses)&&h.id!==loadedRecordId);
  const list=[...records.flatMap(h=>h.courses),...courses];
  return [1,2,3,4].map(year=>{const t=totals(list.filter(c=>Number(c.year)===year));return {year,credits:t.credits,gpa:t.credits?t.quality/t.credits:null}});
}
function calculate(){
  const t=totals(courses),gpa=t.credits?t.quality/t.credits:null;
  $('gpa').textContent=gpa===null?'—':format2(gpa);$('credits').textContent=t.credits.toFixed(1);$('quality').textContent=format2(t.quality);$('scale-fill').style.width=`${gpa===null?0:Math.min(100,gpa/4*100)}%`;
  $('standing').textContent=gpa===null?'No GPA credits':gpa>=3.5?'Honours standing':gpa>=3?'Good standing':'Academic progress';
  const years=yearSummaries();const ready=years.every(y=>y.gpa!==null);const fgpa=ready?years.reduce((sum,y)=>sum+y.gpa*[.2,.2,.3,.3][y.year-1],0):null;
  $('fgpa').textContent=fgpa===null?'—':format2(fgpa);
  $('year-breakdown').innerHTML=years.map(y=>`<div class="year-tile"><span>Year ${y.year}<b>× ${[.2,.2,.3,.3][y.year-1].toFixed(2)}</b></span><strong>${y.gpa===null?'—':format2(y.gpa)}</strong><small>${y.credits.toFixed(1)} GPA credits</small></div>`).join('');
}
function renderHistory(){
  $('history').innerHTML=history.length?`<div class="history-list">${history.slice(0,20).map(h=>`<article class="history-item"><span class="history-icon">♧</span><div><div class="history-term">${esc(h.term)}</div><div class="history-credits">${Number(h.credits||0).toFixed(1)} GPA credits</div></div><div class="history-gpa">${Number(h.gpa||0).toFixed(2)} GPA<small>Saved</small></div><button class="load-record" data-load="${esc(h.id)}">Load</button></article>`).join('')}</div>`:'<p class="empty-history">No saved calculations yet. Save a term to add it here.</p>';
  $('history').querySelectorAll('[data-load]').forEach(button=>button.addEventListener('click',()=>loadRecord(button.dataset.load)));
}
let toastTimer;function toast(message){const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2300)}
async function apiRequest(method='GET',record){
  const response=await fetch('/api/records',{method,headers:{'Authorization':`Bearer ${accessKey}`,'Content-Type':'application/json'},...(record?{body:JSON.stringify({record})}:{})});
  const data=await response.json().catch(()=>({error:'The server returned an unreadable response.'}));
  if(!response.ok)throw new Error(data.error||`Request failed (${response.status}).`);
  return data;
}
function setConnection(message,connected=false){$('connection-status').textContent=message;$('connection-status').classList.toggle('connected',connected)}
async function connect(){
  accessKey=$('access-key').value.trim();if(!accessKey){setConnection('Enter the shared access key.');return}
  $('connect').disabled=true;setConnection('Connecting to Google Sheets…');
  try{sessionStorage.setItem('gradepath-access-key',accessKey);const data=await apiRequest();history=data.records||[];renderHistory();calculate();setConnection(`Connected · ${history.length} saved calculation${history.length===1?'':'s'} loaded.`,true)}
  catch(error){sessionStorage.removeItem('gradepath-access-key');accessKey='';setConnection(error.message);}
  finally{$('connect').disabled=false}
}
async function loadRecord(id){
  try{let data=await apiRequest();history=data.records||history;const record=history.find(item=>item.id===id);if(!record)return toast('That saved record is no longer available.');loadedRecordId=record.id;courses=(record.courses||[]).map(c=>({...c,year:Number(c.year)||1,repeat:Boolean(c.repeat),nonGpa:Boolean(c.nonGpa)}));$('semester').value=record.term;renderCourses();renderHistory();calculate();toast(`Loaded ${record.term}.`)}catch(error){setConnection(error.message);}
}
$('connect').addEventListener('click',connect);
$('access-key').addEventListener('keydown',event=>{if(event.key==='Enter')connect()});
$('add-course').addEventListener('click',()=>{courses.push({name:'',category:'',credits:0,grade:'',year:1,repeat:false,nonGpa:false});renderCourses();calculate();document.querySelector('.course-card:last-child .course-name').focus()});
$('save').addEventListener('click',async()=>{const term=$('semester').value.trim();if(!term){toast('Enter a semester or term name first.');$('semester').focus();return}if(courses.some(c=>!String(c.name||'').trim()||Number(c.credits)<=0||(!c.nonGpa&&!c.grade))){toast('Complete each course name, credit value, and GPA grade first.');return}const t=totals(courses),gpa=t.credits?t.quality/t.credits:null;if(gpa===null){toast('Add at least one GPA subject before saving.');return}if(!accessKey){toast('Connect to Google Sheets before saving.');$('access-key').focus();return}const record={id:loadedRecordId||undefined,term,credits:t.credits,gpa:Number(format2(gpa)),courses};$('save').disabled=true;try{const data=await apiRequest('POST',record);const saved=data.record;loadedRecordId=saved.id;history=[saved,...history.filter(h=>h.id!==saved.id)].sort((a,b)=>String(b.savedAt).localeCompare(String(a.savedAt)));renderHistory();calculate();setConnection(`Connected · ${history.length} saved calculation${history.length===1?'':'s'} loaded.`,true);toast('Semester saved to Google Sheets.')}catch(error){setConnection(error.message);toast('Could not save to Google Sheets.')}finally{$('save').disabled=false}});
$('reset').addEventListener('click',()=>{courses=[];loadedRecordId=null;renderCourses();calculate();toast('Current course entries cleared.')});
$('semester').addEventListener('input',()=>{if(loadedRecordId){const record=history.find(h=>h.id===loadedRecordId);if(record&&record.term!==$('semester').value)loadedRecordId=null}calculate()});
$('view-all').addEventListener('click',connect);
document.querySelectorAll('.bottom-nav a').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();if(a.textContent.includes('History'))document.querySelector('.history-section').scrollIntoView({behavior:'smooth'});else if(a.textContent.includes('Settings'))document.querySelector('.settings').scrollIntoView({behavior:'smooth'});else window.scrollTo({top:0,behavior:'smooth'})}));
if(accessKey)$('access-key').value=accessKey;
renderCourses();renderHistory();calculate();
if(accessKey)connect();
