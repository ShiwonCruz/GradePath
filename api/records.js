const crypto = require('node:crypto');
const POINTS = { 'A+':4, A:4, 'A-':3.7, 'B+':3.3, B:3, 'B-':2.7, 'C+':2.3, C:2, 'C-':1.7, 'D+':1.3, D:1, E:0 };

function reply(res, status, payload) {
  if (typeof res.status === 'function' && typeof res.json === 'function') return res.status(status).json(payload);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(payload));
}

function config() {
  const { GOOGLE_APPS_SCRIPT_URL, APP_ACCESS_KEY } = process.env;
  if (!GOOGLE_APPS_SCRIPT_URL || !APP_ACCESS_KEY) {
    throw new Error('Google Sheets is not configured. Set GOOGLE_APPS_SCRIPT_URL and APP_ACCESS_KEY.');
  }
  return { scriptUrl: GOOGLE_APPS_SCRIPT_URL, appKey: APP_ACCESS_KEY };
}

function authorized(req, expected) {
  const supplied = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function appsScriptRequest(cfg, method, record) {
  const url = new URL(cfg.scriptUrl);
  if (method === 'GET') url.searchParams.set('key', cfg.appKey);
  const response = await fetch(url, {
    method,
    headers: method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
    ...(method === 'POST' ? { body: JSON.stringify({ key: cfg.appKey, record }) } : {})
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data || data.ok === false) throw new Error(data && data.error || `Apps Script request failed (${response.status}).`);
  return data;
}

function calculateRecord(record) {
  if (!record || typeof record !== 'object' || typeof record.term !== 'string' || !record.term.trim()) throw new Error('Enter a semester or term name.');
  if (!Array.isArray(record.courses) || record.courses.length > 100) throw new Error('A record must contain up to 100 courses.');
  const courses = record.courses.map((course, index) => {
    const grade = String(course.grade || '');
    const credits = Number(course.credits);
    if (!String(course.name || '').trim()) throw new Error(`Course ${index + 1} needs a name.`);
    if (!Number.isFinite(credits) || credits <= 0 || credits > 100) throw new Error(`Course ${index + 1} has invalid credit points.`);
    if (!course.nonGpa && POINTS[grade] === undefined) throw new Error(`Course ${index + 1} has an invalid grade.`);
    return {
      name: String(course.name || '').slice(0, 200), category: String(course.category || '').slice(0, 80),
      credits, grade: POINTS[grade] === undefined ? 'A' : grade, year: [1,2,3,4].includes(Number(course.year)) ? Number(course.year) : 1,
      repeat: Boolean(course.repeat), nonGpa: Boolean(course.nonGpa)
    };
  });
  let quality = 0, credits = 0;
  for (const course of courses) {
    if (course.nonGpa) continue;
    const points = course.repeat ? Math.min(POINTS[course.grade], 2) : POINTS[course.grade];
    quality += points * course.credits;
    credits += course.credits;
  }
  if (!credits) throw new Error('Add at least one GPA course before saving.');
  const rounded = Math.round((quality / credits + Number.EPSILON) * 100) / 100;
  return { id: String(record.id || crypto.randomUUID()), savedAt: new Date().toISOString(), term: record.term.trim().slice(0, 80), gpa: rounded, credits, courses };
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let raw = '';
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

module.exports = async function records(req, res) {
  let cfg;
  try { cfg = config(); }
  catch (error) { return reply(res, 503, { error: error.message }); }
  if (!authorized(req, cfg.appKey)) return reply(res, 401, { error: 'Access key is incorrect.' });
  if (!['GET', 'POST'].includes(req.method)) return reply(res, 405, { error: 'Method not allowed.' });

  try {
    if (req.method === 'GET') {
      const data = await appsScriptRequest(cfg, 'GET');
      return reply(res, 200, { records: data.records || [] });
    }
    const body = await readBody(req);
    const record = calculateRecord(body.record);
    const data = await appsScriptRequest(cfg, 'POST', record);
    return reply(res, 200, { record: data.record || record });
  } catch (error) {
    console.error('Google Sheets records error:', error.message);
    const message = error.message.startsWith('Apps Script request failed')
      ? 'The Google Sheets script could not be reached. Check its deployment URL and access settings.' : error.message;
    return reply(res, 500, { error: message });
  }
};
