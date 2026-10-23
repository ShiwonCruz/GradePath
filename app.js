const defaults = [
  { name:'CS 201: Data Structures & Algorithms', category:'Core Major', credits:4, grade:'A', year:1, repeat:false, nonGpa:false },
  { name:'MATH 240: Linear Algebra & Diff. Eq.', category:'STEM Core', credits:4, grade:'A-', year:1, repeat:false, nonGpa:false },
  { name:'PHYS 150: University Physics I (w/ Lab)', category:'Lab Science', credits:4, grade:'B+', year:1, repeat:false, nonGpa:false },
  { name:'ENG 102: Academic Writing & Rhetoric', category:'General Ed', credits:4, grade:'A', year:1, repeat:false, nonGpa:false }
];
const gradePoints = { 'A+':4,'A':4,'A-':3.7,'B+':3.3,'B':3,'B-':2.7,'C+':2.3,'C':2,'C-':1.7,'D+':1.3,'D':1,'E':0 };
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const round2 = n => Math.sign(n)*Math.round((Math.abs(n)+Number.EPSILON)*100)/100;
const format2 = n => round2(n).toFixed(2);
const oldCourses = JSON.parse(localStorage.getItem('gradepath-courses') || 'null');
let courses = (oldCourses || structuredClone(defaults)).map(c=>({ ...c, year:Number(c.year)||1, repeat:Boolean(c.repeat), nonGpa:Boolean(c.nonGpa), grade:gradePoints[c.grade]===undefined?'A':c.grade }));
let history = JSON.parse(localStorage.getItem('gradepath-history') || '[]');
function pointsFor(course){const raw=gradePoints[course.grade]??0;return course.repeat?Math.min(raw,2):raw}
function totals(list){return list.reduce((a,c)=>{if(c.nonGpa)return a;const cp=Number(c.credits)||0,gp=pointsFor(c);a.credits+=cp;a.quality+=gp*cp;return a},{credits:0,quality:0})}
function currentGpa(){const t=totals(courses);return t.credits?t.quality/t.credits:null}
function renderCourses(){
  $('courses').innerHTML=`<div class="course-list">${courses.map((c,i)=>`<article class="course-card ${c.nonGpa?'excluded':''}"><div class="course-head"><input class="course-name" aria-label="Course name" data-name="${i}" value="${esc(c.name)}"><button class="delete-course" aria-label="Remove ${esc(c.name)}" data-delete="${i}">⌫</button></div><span class="course-tag">${esc(c.category||'Course')}</span><div class="course-fields"><div class="course-field"><label for="credit-${i}">Credit Points</label><select id="credit-${i}" data-credit="${i}">${[1,2,3,4,5,6].map(n=>`<option value="${n}" ${Number(c.credits)===n?'selected':''}>${n.toFixed(1)} Credits</option>`).join('')}</select></div><div class="course-field"><label for="grade-${i}">Grade Point</label><select id="grade-${i}" data-grade="${i}" ${c.nonGpa?'disabled':''}>${Object.entries(gradePoints).map(([g,p])=>`<option value="${g}" ${c.grade===g?'selected':''}>${g} (${p.toFixed(2)})</option>`).join('')}</select></div><div class="course-field"><label for="year-${i}">Degree Year</label><select id="year-${i}" data-year="${i}">${[1,2,3,4].map(y=>`<option value="${y}" ${Number(c.year)===y?'selected':''}>Year ${y}</option>`).join('')}</select></div><div class="course-flags"><label><input type="checkbox" data-repeat="${i}" ${c.repeat?'checked':''} ${c.nonGpa?'disabled':''}> Repeat exam <span class="cap-note">cap C / 2.00</span></label><label><input type="checkbox" data-nongpa="${i}" ${c.nonGpa?'checked':''}> Non-GPA subject</label></div></div></article>`).join('')}</div>`;
  document.querySelectorAll('[data-credit]').forEach(el=>el.addEventListener('change',()=>{courses[el.dataset.credit].credits=Number(el.value);persist();calculate()}));
  document.querySelectorAll('[data-grade]').forEach(el=>el.addEventListener('change',()=>{courses[el.dataset.grade].grade=el.value;persist();calculate()}));
  document.querySelectorAll('[data-year]').forEach(el=>el.addEventListener('change',()=>{courses[el.dataset.year].year=Number(el.value);persist();calculate()}));
  document.querySelectorAll('[data-name]').forEach(el=>el.addEventListener('change',()=>{courses[el.dataset.name].name=el.value;persist()}));
  document.querySelectorAll('[data-repeat]').forEach(el=>el.addEventListener('change',()=>{courses[el.dataset.repeat].repeat=el.checked;persist();calculate()}));
  document.querySelectorAll('[data-nongpa]').forEach(el=>el.addEventListener('change',()=>{courses[el.dataset.nongpa].nonGpa=el.checked;persist();renderCourses();calculate()}));
  document.querySelectorAll('[data-delete]').forEach(el=>el.addEventListener('click',()=>{courses.splice(Number(el.dataset.delete),1);persist();renderCourses();calculate()}));
  $('course-count').textContent=courses.length;
}
function yearSummaries(){
  const currentTerm=$('semester').value;
  const records=history.filter(h=>Array.isArray(h.courses)&&h.term!==currentTerm);
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
function renderHistory(){ $('history').innerHTML=`<div class="history-list">${history.slice(0,4).map(h=>`<article class="history-item"><span class="history-icon">♧</span><div><div class="history-term">${esc(h.term)}</div><div class="history-credits">${Number(h.credits||0).toFixed(1)} GPA credits</div></div><div class="history-gpa">${Number(h.gpa||0).toFixed(2)} GPA<small>${esc(h.badge||'Saved')}</small></div></article>`).join('')}</div>`; }
function persist(){localStorage.setItem('gradepath-courses',JSON.stringify(courses))}
let toastTimer;function toast(message){const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2300)}
$('add-course').addEventListener('click',()=>{courses.push({name:'New Course',category:'Course',credits:3,grade:'A',year:1,repeat:false,nonGpa:false});persist();renderCourses();calculate();document.querySelector('.course-card:last-child .course-name').focus()});
$('save').addEventListener('click',()=>{const t=totals(courses),gpa=t.credits?t.quality/t.credits:null;if(gpa===null){toast('Add at least one GPA subject before saving.');return}const entry={term:$('semester').value,credits:t.credits,gpa:Number(format2(gpa)),badge:gpa>=3.5?'Honours standing':gpa>=3?'Good standing':'Saved',courses:structuredClone(courses)};history=[entry,...history.filter(h=>h.term!==entry.term)].slice(0,20);localStorage.setItem('gradepath-history',JSON.stringify(history));renderHistory();calculate();toast('Semester saved and four-year GPA updated.')});
$('reset').addEventListener('click',()=>{courses=structuredClone(defaults);persist();renderCourses();calculate();toast('Default courses restored.')});
$('semester').addEventListener('change',calculate);
$('view-all').addEventListener('click',()=>toast('Your latest saved semesters are shown below.'));
document.querySelectorAll('.bottom-nav a').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();if(a.textContent.includes('History'))document.querySelector('.history-section').scrollIntoView({behavior:'smooth'});else if(a.textContent.includes('Settings'))document.querySelector('.settings').scrollIntoView({behavior:'smooth'});else window.scrollTo({top:0,behavior:'smooth'})}));
renderCourses();renderHistory();calculate();
