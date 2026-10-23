const SHEET_NAME = 'Calculations';
const HEADERS = ['Record ID', 'Saved At (UTC)', 'Semester / Term', 'Semester GPA', 'GPA Credits', 'Courses JSON'];
const GRADE_POINTS = { 'A+':4, A:4, 'A-':3.7, 'B+':3.3, B:3, 'B-':2.7, 'C+':2.3, C:2, 'C-':1.7, 'D+':1.3, D:1, E:0 };

function doGet(e) {
  if (!authorized_(e && e.parameter && e.parameter.key)) return json_({ ok:false, error:'Access key is incorrect.' });
  try { return json_({ ok:true, records:listRecords_() }); }
  catch (error) { return json_({ ok:false, error:error.message }); }
}

function doPost(e) {
  let lock;
  try {
    const request = JSON.parse(e && e.postData && e.postData.contents || '{}');
    if (!authorized_(request.key)) return json_({ ok:false, error:'Access key is incorrect.' });
    const record = calculateRecord_(request.record);
    lock = LockService.getScriptLock();
    lock.waitLock(10000);
    const sheet = getSheet_();
    const values = sheet.getDataRange().getValues();
    const rowIndex = values.findIndex((row, index) => index > 0 && String(row[0]) === record.id);
    const row = [record.id, record.savedAt, record.term, record.gpa, record.credits, JSON.stringify(record.courses)];
    if (rowIndex > 0) sheet.getRange(rowIndex + 1, 1, 1, row.length).setValues([row]);
    else sheet.appendRow(row);
    return json_({ ok:true, record:record });
  } catch (error) {
    return json_({ ok:false, error:error.message || 'Could not save the record.' });
  } finally {
    if (lock && lock.hasLock()) lock.releaseLock();
  }
}

function authorized_(provided) {
  const expected = PropertiesService.getScriptProperties().getProperty('APP_ACCESS_KEY');
  return Boolean(expected) && typeof provided === 'string' && provided === expected;
}

function getSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error('Open this script from the target spreadsheet using Extensions → Apps Script.');
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  return sheet;
}

function listRecords_() {
  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  return sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues().filter(row => row[0]).map(row => {
    let courses = [];
    try { courses = JSON.parse(row[5] || '[]'); } catch (error) { courses = []; }
    return { id:String(row[0]), savedAt:String(row[1]), term:String(row[2]), gpa:Number(row[3]) || 0, credits:Number(row[4]) || 0, courses:Array.isArray(courses) ? courses : [] };
  }).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

function calculateRecord_(input) {
  if (!input || typeof input.term !== 'string' || !input.term.trim()) throw new Error('Enter a semester or term name.');
  if (!Array.isArray(input.courses) || input.courses.length > 100) throw new Error('A record must contain up to 100 courses.');
  const courses = input.courses.map((course, index) => {
    const grade = String(course.grade || '');
    const credits = Number(course.credits);
    if (!String(course.name || '').trim()) throw new Error('Course ' + (index + 1) + ' needs a name.');
    if (!Number.isFinite(credits) || credits <= 0 || credits > 100) throw new Error('Course ' + (index + 1) + ' has invalid credit points.');
    if (!course.nonGpa && !Object.prototype.hasOwnProperty.call(GRADE_POINTS, grade)) throw new Error('Course ' + (index + 1) + ' needs a valid grade.');
    return { name:String(course.name).slice(0,200), category:String(course.category || '').slice(0,80), credits:credits,
      grade:Object.prototype.hasOwnProperty.call(GRADE_POINTS, grade) ? grade : '', year:[1,2,3,4].includes(Number(course.year)) ? Number(course.year) : 1,
      repeat:Boolean(course.repeat), nonGpa:Boolean(course.nonGpa) };
  });
  let quality = 0, credits = 0;
  courses.forEach(course => {
    if (course.nonGpa) return;
    const points = course.repeat ? Math.min(GRADE_POINTS[course.grade], 2) : GRADE_POINTS[course.grade];
    quality += points * course.credits;
    credits += course.credits;
  });
  if (!credits) throw new Error('Add at least one GPA course before saving.');
  return { id:String(input.id || Utilities.getUuid()), savedAt:new Date().toISOString(), term:input.term.trim().slice(0,80),
    gpa:Math.round((quality / credits + Number.EPSILON) * 100) / 100, credits:credits, courses:courses };
}

function json_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
