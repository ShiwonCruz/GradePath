const defaults = [
  { name: 'CS 201: Data Structures & Algorithms', category: 'Core Major', credits: 4, grade: 'A' },
  { name: 'MATH 240: Linear Algebra & Diff. Eq.', category: 'STEM Core', credits: 4, grade: 'A-' },
  { name: 'PHYS 150: University Physics I (w/ Lab)', category: 'Lab Science', credits: 4, grade: 'B+' },
  { name: 'ENG 102: Academic Writing & Rhetoric', category: 'General Ed', credits: 4, grade: 'A' }
];
const gradePoints = { 'A+':4,'A':4,'A-':3.7,'B+':3.3,'B':3,'B-':2.7,'C+':2.3,'C':2,'C-':1.7,'D+':1.3,'D':1,'F':0,'P':null,'NP':0 };
const storedCourses = localStorage.getItem('gradepath-courses');
let courses = storedCourses ? JSON.parse(storedCourses) : structuredClone(defaults);
let history = JSON.parse(localStorage.getItem('gradepath-history') || 'null') || [
  { term:'Fall 2024', credits:16, gpa:3.82, badge:'President’s List' },
  { term:'Spring 2024', credits:15, gpa:3.55, badge:'Dean’s List' },
  { term:'Fall 2023', credits:17, gpa:3.60, badge:'Dean’s List' },
  { term:'Spring 2023', credits:14, gpa:3.71, badge:'Dean’s List' }
];
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function renderCourses(){
  $('courses').innerHTML = `<div class="course-list">${courses.map((c,i)=>`<article class="course-card"><div class="course-head"><input class="course-name" aria-label="Course name" data-name="${i}" value="${esc(c.name)}"><button class="delete-course" aria-label="Remove ${esc(c.name)}" data-delete="${i}">▤</button></div><span class="course-tag">${esc(c.category || 'Course')}</span><div class="course-fields"><div class="course-field"><label for="credit-${i}">Credits</label><select id="credit-${i}" data-credit="${i}">${[1,2,3,4,5,6].map(n=>`<option value="${n}" ${Number(c.credits)===n?'selected':''}>${n.toFixed(1)} Credits</option>`).join('')}</select></div><div class="course-field"><label for="grade-${i}">Grade</label><select id="grade-${i}" data-grade="${i}">${Object.keys(gradePoints).map(g=>`<option value="${g}" ${c.grade===g?'selected':''}>${g}${gradePoints[g]===null?' (Pass)':` (${gradePoints[g].toFixed(1)})`}</option>`).join('')}</select></div></div></article>`).join('')}</div>`;
  document.querySelectorAll('[data-credit]').forEach(el=>el.addEventListener('change',()=>{courses[el.dataset.credit].credits=Number(el.value);persist();calculate()}));
  document.querySelectorAll('[data-grade]').forEach(el=>el.addEventListener('change',()=>{courses[el.dataset.grade].grade=el.value;persist();calculate()}));
  document.querySelectorAll('[data-name]').forEach(el=>el.addEventListener('change',()=>{courses[el.dataset.name].name=el.value;persist()}));
  document.querySelectorAll('[data-delete]').forEach(el=>el.addEventListener('click',()=>{courses.splice(Number(el.dataset.delete),1);persist();renderCourses();calculate()}));
  $('course-count').textContent=courses.length;
}
function calculate(){
  const scale=$('scale').value, weighted=$('weighted').checked;
  let qp=0,credits=0;
  for(const c of courses){const g=c.grade;let points=gradePoints[g];if(scale==='flat'&&points!==null)points=Math.max(0,Math.min(4,Math.floor(points+.5)));if(scale==='five'&&points!==null)points=Math.min(5,points+1);if(weighted&&['AP','Honors'].includes(c.category)&&points!==null)points=Math.min(5,points+1);if(points!==null){qp+=points*Number(c.credits);credits+=Number(c.credits)}}
  const gpa=credits?qp/credits:0, cap=scale==='five'||weighted?5:4;
  $('gpa').textContent=gpa.toFixed(2);$('max-gpa').textContent=cap.toFixed(2);$('credits').textContent=credits.toFixed(1);$('quality').textContent=qp.toFixed(1);$('scale-end').textContent=cap.toFixed(2);$('scale-fill').style.width=`${Math.min(100,gpa/cap*100)}%`; $('cumulative').textContent=((gpa*credits+3.60*64)/(credits+64||1)).toFixed(2);
  let standing=gpa>=3.8?'President’s List Standing':gpa>=3.5?'Dean’s List Standing':gpa>=3?'Good Academic Standing':'Keep Going';$('standing').textContent=standing;$('percentile').textContent=gpa>=3.8?'Top 5% Class Percentile':gpa>=3.5?'Top 10% Class Percentile':'Academic Progress';
}
function renderHistory(){ $('history').innerHTML=`<div class="history-list">${history.slice(0,4).map(h=>`<article class="history-item"><span class="history-icon">♧</span><div><div class="history-term">${esc(h.term)}</div><div class="history-credits">${h.credits} Credits Completed</div></div><div class="history-gpa">${Number(h.gpa).toFixed(2)} GPA<small>${esc(h.badge)}</small></div></article>`).join('')}</div>`; }
function persist(){localStorage.setItem('gradepath-courses',JSON.stringify(courses))}
let toastTimer;function toast(message){const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2300)}
$('add-course').addEventListener('click',()=>{courses.push({name:'New Course',category:'Course',credits:3,grade:'A'});persist();renderCourses();calculate();document.querySelector('.course-card:last-child .course-name').focus()});
$('save').addEventListener('click',()=>{const entry={term:$('semester').value,credits:Number($('credits').textContent),gpa:Number($('gpa').textContent),badge:Number($('gpa').textContent)>=3.8?'President’s List':Number($('gpa').textContent)>=3.5?'Dean’s List':'In Progress'};history=[entry,...history.filter(h=>h.term!==entry.term)].slice(0,12);localStorage.setItem('gradepath-history',JSON.stringify(history));renderHistory();toast('Term calculation saved to your history.')});
$('reset').addEventListener('click',()=>{courses=structuredClone(defaults);$('scale').value='standard';$('weighted').checked=false;persist();renderCourses();calculate();toast('Default courses restored.')});
$('scale').addEventListener('change',calculate);$('weighted').addEventListener('change',calculate);
$('view-all').addEventListener('click',()=>toast('Your latest saved terms are shown below.'));
document.querySelectorAll('.bottom-nav a').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();if(a.textContent.includes('History'))document.querySelector('.history-section').scrollIntoView({behavior:'smooth'});else if(a.textContent.includes('Settings'))document.querySelector('.settings').scrollIntoView({behavior:'smooth'});else window.scrollTo({top:0,behavior:'smooth'})}));
renderCourses();renderHistory();calculate();
