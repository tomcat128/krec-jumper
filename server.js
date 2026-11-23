'use strict';
/*
 * KREC Jumper – kleiner Server ohne Abhängigkeiten. Er liefert das Spiel aus und führt die gemeinsame
 * Bestenliste (Top 100) in einer JSON-Datei.
 *
 *   GET  /api/scores                  → { scores: [{ name, score, at }] }   (beste zuerst)
 *   POST /api/scores { name, score }  → { rank, scores }                    (rank = Platz 1…100 oder null)
 *
 * Umgebung: PORT (Standard 8080), DATA_DIR (Standard ./data – dort liegt scores.json)
 * Start:    node server.js
 */
const http = require('http'), fs = require('fs'), path = require('path'), zlib = require('zlib'), crypto = require('crypto');

const PORT = Number(process.env.PORT) || 8080;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const FILE = path.join(DATA_DIR, 'scores.json');
const MAX_ENTRIES = 100, NAME_MAX = 12, SCORE_MAX = 9999999, BODY_MAX = 512, POSTS_PER_MINUTE = 20;

// ───────────────────────── Spieldateien ─────────────────────────
// Nur diese Dateien werden ausgeliefert – es gibt keinen Weg, über die Adresse an andere heranzukommen.
const TUNE = 'wir-vom-konstanzer-rec-(remastered).mp3';   // Titelmelodie
const FILES = { '/': 'index.html', '/index.html': 'index.html', '/game.js': 'game.js', '/levels.js': 'levels.js', '/logo.png': 'logo.png', ['/' + TUNE]: TUNE };
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.mp3': 'audio/mpeg' };
const PACKED = new Set(['.png', '.mp3']);                 // schon komprimiert – gzip lohnt nicht
const assets = new Map();
function asset(name) {
  const file = path.join(__dirname, name), mtime = fs.statSync(file).mtimeMs;
  let a = assets.get(name);
  if (!a || a.mtime !== mtime) {                          // geänderte Datei neu einlesen
    const body = fs.readFileSync(file), ext = path.extname(name);
    a = {
      mtime, body, type: TYPES[ext], gz: PACKED.has(ext) ? null : zlib.gzipSync(body),
      etag: `"${crypto.createHash('sha1').update(body).digest('hex').slice(0, 16)}"`,
    };
    assets.set(name, a);
  }
  return a;
}
function sendAsset(req, res, name) {
  const a = asset(name);
  // Immer beim Server nachfragen, damit eine neue Version sofort sichtbar ist
  const head = { 'Content-Type': a.type, 'Cache-Control': 'no-cache', ETag: a.etag, Vary: 'Accept-Encoding', 'X-Content-Type-Options': 'nosniff' };
  if (!a.gz) head['Accept-Ranges'] = 'bytes';
  if (req.headers['if-none-match'] === a.etag) { res.writeHead(304, head); res.end(); return; }
  // Teilabrufe (Range) – Browser holen Musik stückweise und spulen damit
  const range = !a.gz && (!req.headers['if-range'] || req.headers['if-range'] === a.etag) && /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (range && (range[1] || range[2])) {
    const size = a.body.length;
    let from = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    let to = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (from >= size || from > to) { res.writeHead(416, { 'Content-Range': `bytes */${size}` }); res.end(); return; }
    head['Content-Range'] = `bytes ${from}-${to}/${size}`;
    head['Content-Length'] = to - from + 1;
    res.writeHead(206, head);
    res.end(req.method === 'HEAD' ? undefined : a.body.subarray(from, to + 1));
    return;
  }
  const gz = a.gz && /\bgzip\b/.test(req.headers['accept-encoding'] || '');
  const body = gz ? a.gz : a.body;
  if (gz) head['Content-Encoding'] = 'gzip';
  head['Content-Length'] = body.length;
  res.writeHead(200, head);
  res.end(req.method === 'HEAD' ? undefined : body);
}

// ───────────────────────── Bestenliste ─────────────────────────
const byRank = (a, b) => b.score - a.score || (a.at < b.at ? -1 : a.at > b.at ? 1 : 0);   // bei Gleichstand zählt, wer zuerst da war
const validScore = n => Number.isInteger(n) && n >= 1 && n <= SCORE_MAX;
// Namen: Großbuchstaben, Ziffern, Leerzeichen und . - ! – höchstens zwölf Zeichen
function cleanName(raw) {
  if (typeof raw !== 'string') return '';
  const s = raw.normalize('NFC').toLocaleUpperCase('de-DE').replace(/[^\p{L}\p{N} .\-!]/gu, '').replace(/\s+/g, ' ').trim();
  return Array.from(s).slice(0, NAME_MAX).join('').trim();
}
function loadScores() {
  try {
    const list = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!Array.isArray(list)) throw new Error('kein Array');
    return list
      .filter(e => e && validScore(e.score) && cleanName(e.name) === e.name && e.name && typeof e.at === 'string')
      .map(e => ({ name: e.name, score: e.score, at: e.at }))
      .sort(byRank).slice(0, MAX_ENTRIES);
  } catch (e) {
    if (e.code !== 'ENOENT') {                            // beschädigte Datei beiseitelegen statt überschreiben
      console.error(`Bestenliste unlesbar (${e.message}) – beginne mit leerer Liste.`);
      try { fs.renameSync(FILE, `${FILE}.defekt-${Date.now()}`); } catch (err) { /* egal */ }
    }
    return [];
  }
}
function saveScores() {                                   // erst daneben schreiben, dann austauschen – nie eine halbe Datei
  const data = JSON.stringify(scores, null, 1), tmp = `${FILE}.tmp`;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  try {
    fs.writeFileSync(tmp, data);
    fs.renameSync(tmp, FILE);
  } catch (e) {
    // Ist scores.json als einzelne Datei eingehängt, lässt sie sich nicht austauschen (EBUSY) und daneben oft nichts
    // anlegen (EACCES) – dann direkt hineinschreiben. Schlägt auch das fehl, gilt der ursprüngliche Fehler.
    try { fs.writeFileSync(FILE, data); } catch (e2) { throw e; }
    try { fs.unlinkSync(tmp); } catch (e3) { /* gab es nicht */ }
  }
}
let scores = loadScores();
// Gleich beim Start prüfen, ob sich die Bestenliste speichern lässt – sonst fällt es erst beim ersten Eintrag auf
try { saveScores(); } catch (e) {
  console.error(`ACHTUNG: Die Bestenliste lässt sich nicht speichern (${e.message}). Gehört ${DATA_DIR} dem Benutzer, unter dem der Server läuft?`);
}

function addScore(name, score) {
  const entry = { name, score, at: new Date().toISOString() };
  const next = scores.concat(entry).sort(byRank), idx = next.indexOf(entry);
  if (idx >= MAX_ENTRIES) return null;                    // hat nicht für die Top 100 gereicht
  const before = scores;
  scores = next.slice(0, MAX_ENTRIES);
  try { saveScores(); } catch (e) { scores = before; throw e; }
  return idx + 1;
}

// Einfache Bremse gegen Dauerfeuer: je Adresse nur eine Handvoll Einträge pro Minute
const posts = new Map();
function tooMany(ip) {
  const now = Date.now(), list = (posts.get(ip) || []).filter(t => now - t < 60000);
  if (list.length >= POSTS_PER_MINUTE) { posts.set(ip, list); return true; }
  list.push(now); posts.set(ip, list);
  if (posts.size > 5000) posts.clear();
  return false;
}

function sendJson(res, status, obj) {
  const body = Buffer.from(JSON.stringify(obj));
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Length': body.length, 'X-Content-Type-Options': 'nosniff' });
  res.end(body);
}
function readBody(req, cb) {
  let size = 0, done = false;
  const chunks = [];
  const finish = (err, text) => { if (!done) { done = true; cb(err, text); } };
  req.on('data', c => { size += c.length; if (size > BODY_MAX) { finish(new Error('zu groß')); req.destroy(); } else chunks.push(c); });
  req.on('end', () => finish(null, Buffer.concat(chunks).toString('utf8')));
  req.on('error', finish);
}

function handleScores(req, res) {
  if (req.method === 'GET' || req.method === 'HEAD') { sendJson(res, 200, { scores }); return; }
  if (req.method !== 'POST') { res.writeHead(405, { Allow: 'GET, POST' }); res.end(); return; }
  if (tooMany(req.socket.remoteAddress || '?')) { sendJson(res, 429, { error: 'Zu viele Einträge – bitte kurz warten.' }); return; }
  readBody(req, (err, text) => {
    if (err) { sendJson(res, 413, { error: 'Anfrage zu groß.' }); return; }
    let data;
    try { data = JSON.parse(text); } catch (e) { data = null; }
    const name = cleanName(data && data.name);
    if (!data || !name || !validScore(data.score)) { sendJson(res, 400, { error: 'Name oder Punktzahl ungültig.' }); return; }
    try { sendJson(res, 200, { rank: addScore(name, data.score), scores }); }
    catch (e) { console.error('Speichern fehlgeschlagen:', e.message); sendJson(res, 500, { error: 'Speichern fehlgeschlagen.' }); }
  });
}

const server = http.createServer((req, res) => {
  let pathname;
  // Vorgeschaltete Server (z. B. Caddy) schicken Sonderzeichen wie die Klammern im Namen der Titelmelodie als %28/%29 – deshalb entschlüsseln
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch (e) { res.writeHead(400); res.end(); return; }
  if (pathname === '/api/scores') { handleScores(req, res); return; }
  const name = FILES[pathname];
  if (!name) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Nicht gefunden'); return; }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { Allow: 'GET, HEAD' }); res.end(); return; }
  try { sendAsset(req, res, name); } catch (e) { console.error(e.message); res.writeHead(500); res.end(); }
});
server.listen(PORT, () => console.log(`KREC Jumper läuft auf Port ${PORT} – Bestenliste: ${FILE} (${scores.length} Einträge)`));
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 1500).unref(); });
