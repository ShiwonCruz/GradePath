const crypto = require('node:crypto');

const SHEET_NAME = 'Calculations';
const SHEET_RANGE = `${SHEET_NAME}!A:F`;
const HEADERS = ['Record ID', 'Saved At (UTC)', 'Semester / Term', 'Semester GPA', 'GPA Credits', 'Courses JSON'];
const POINTS = { 'A+':4, A:4, 'A-':3.7, 'B+':3.3, B:3, 'B-':2.7, 'C+':2.3, C:2, 'C-':1.7, 'D+':1.3, D:1, E:0 };
let cachedToken = null;
let tokenExpiresAt = 0;

function reply(res, status, payload) {
  if (typeof res.status === 'function' && typeof res.json === 'function') return res.status(status).json(payload);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(payload));
}

function config() {
  const { GOOGLE_SHEETS_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, APP_ACCESS_KEY } = process.env;
  if (!GOOGLE_SHEETS_ID || !GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY || !APP_ACCESS_KEY) {
    throw new Error('Google Sheets is not configured. Set GOOGLE_SHEETS_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, and APP_ACCESS_KEY.');
  }
  return { spreadsheetId: GOOGLE_SHEETS_ID, email: GOOGLE_SERVICE_ACCOUNT_EMAIL, privateKey: GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'), appKey: APP_ACCESS_KEY };
}

function authorized(req, expected) {
  const supplied = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function base64url(value) { return Buffer.from(value).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_'); }

async function googleToken({ email, privateKey }) {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && tokenExpiresAt > now + 60) return cachedToken;
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(JSON.stringify({ iss: email, scope: 'https://www.googleapis.com/auth/spreadsheets', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  const unsigned = `${header}.${claims}`;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(unsigned), privateKey).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const assertion = `${unsigned}.${signature}`;
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error_description || data.error || 'Google authentication failed.');
  cachedToken = data.access_token;
  tokenExpiresAt = now + Number(data.expires_in || 3600);
  return cachedToken;
}

async function sheetsRequest(method, path, body, cfg) {
  const token = await googleToken(cfg);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(cfg.spreadsheetId)}/${path}`;
  const response = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.error && data.error.message;
    throw new Error(`Google Sheets API (${response.status}): ${message || 'request failed'}`);
  }
  return data;
}

async function readRows(cfg) {
  const path = `values/${encodeURIComponent(SHEET_RANGE)}?majorDimension=ROWS`;
  const data = await sheetsRequest('GET', path, null, cfg);
  const rows = data.values || [];
  if (!rows.length) {
    await sheetsRequest('PUT', `values/${encodeURIComponent(`${SHEET_NAME}!A1:F1`)}?valueInputOption=RAW`, { values: [HEADERS] }, cfg);
    return [];
  }
  return rows.slice(1).map((row, index) => ({
    id: row[0] || '', savedAt: row[1] || '', term: row[2] || '', gpa: Number(row[3] || 0), credits: Number(row[4] || 0),
    courses: parseCourses(row[5]), rowNumber: index + 2
  })).filter(record => record.id);
}

function parseCourses(value) {
  try { const parsed = JSON.parse(value || '[]'); return Array.isArray(parsed) ? parsed : []; }
  catch { return []; }
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
      const records = await readRows(cfg);
      records.sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
      return reply(res, 200, { records: records.map(({ rowNumber, ...record }) => record) });
    }
    const body = await readBody(req);
    const record = calculateRecord(body.record);
    const existing = (await readRows(cfg)).find(item => item.id === record.id);
    const row = [record.id, record.savedAt, record.term, record.gpa, record.credits, JSON.stringify(record.courses)];
    if (existing) {
      const target = `${SHEET_NAME}!A${existing.rowNumber}:F${existing.rowNumber}`;
      await sheetsRequest('PUT', `values/${encodeURIComponent(target)}?valueInputOption=RAW`, { values: [row] }, cfg);
    } else {
      await sheetsRequest('POST', `values/${encodeURIComponent(SHEET_RANGE)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, { values: [row] }, cfg);
    }
    return reply(res, 200, { record });
  } catch (error) {
    console.error('Google Sheets records error:', error.message);
    const message = error.message.startsWith('Google Sheets API') || error.message.includes('Google authentication')
      ? 'Google Sheets could not be reached. Check that the Sheets API is enabled, the spreadsheet is shared with the service account, and the Calculations tab exists.'
      : error.message;
    return reply(res, 500, { error: message });
  }
};
