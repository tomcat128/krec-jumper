'use strict';
/* KREC Jumper – ein Rollkunstlauf-Jump-'n'-Run im Retro-Pixel-Look. Alles entsteht im Code; einziges Bild ist das Vereinswappen (logo.png). */
(() => {

// ───────────────────────── Konstanten ─────────────────────────
const TILE = 30, VIEW_W = 960, VIEW_H = 540, ROWS = 18;
const EMPTY = 0, GROUND = 1, BLOCK = 2, PLAT = 3;
const TAU = Math.PI * 2;

// Physik (Pixel und Sekunden)
const GRAVITY = 2300, JUMP_V = 780, JUMP_CUT = 280, MAX_FALL = 900;
const MAX_RUN = 290, ACC_GROUND = 1500, ACC_AIR = 1050, ACC_TURN = 2600, FRICTION = 800;
const COYOTE = 0.09, JUMP_BUF = 0.12;
const AXEL_V = 380, AXEL_MIN_H = 45;                     // Axel: kleiner Auftrieb, erst ab 1,5 Kacheln über dem Boden
const SPIN_MAX = 1.15, SPIN_MIN = 0.3, SPIN_CD = 0.4;
const PW = 20, PH = 54;
const STEP = 1 / 120;
const MAX_HEARTS = 3;

const INK = '#2b1740';
const LW = 480, LH = 270, PXS = 2, TPX = TILE / PXS;   // Pixelbild: 480×270, eine Kachel = 15 Pixel

const THEMES = {
  park: {
    song: 'park',
    sky: ['#3aa4e8', '#8fd6f5', '#e8f7c8'], orb: { x: 386, y: 44, r: 17, col: '#fff7c9', glow: '#ffe98a' },
    cloud: ['#ffffff', '#cfe9f7'], far: '#8fd3b0', farHi: '#b5e6c8', mid: '#4fb57e', midHi: '#7fd49f',
    midDark: '#2f8a5c', midDarkHi: '#3fa56f',
    top: '#ffe7a3', topHi: '#fff7dc', topSh: '#e2bf6e', body: '#c8815a', dark: '#a25c3a', light: '#dc9c74',
    block: '#f0b445', blockHi: '#ffe08f', blockDark: '#a86a14',
    plat: '#8b5a3c', platHi: '#be8a62', platDark: '#5d3a26', deco: 'trees', stars: false,
  },
  abend: {
    song: 'abend',
    sky: ['#2d2470', '#b84a86', '#ffae63'], orb: { x: 345, y: 160, r: 30, col: '#ffe59a', glow: '#ffc078' },
    cloud: ['#f4a3a8', '#c66f96'], far: '#7a4a98', farHi: '#9a66b4', mid: '#4f3078', midHi: '#6c4a98',
    midDark: '#33205a', midDarkHi: '#452c70',
    top: '#ffc9dc', topHi: '#fff0f5', topSh: '#e293b4', body: '#7c4a7c', dark: '#5a305e', light: '#96609a',
    block: '#f2875a', blockHi: '#ffc09c', blockDark: '#a8482a',
    plat: '#4a3470', platHi: '#8a6cb8', platDark: '#2c1e4a', deco: 'lamps', stars: false,
  },
  nacht: {
    song: 'nacht',
    sky: ['#05071e', '#111850', '#2a3490'], orb: { x: 395, y: 44, r: 14, col: '#f4f1ff', glow: '#8f9ae8' },
    cloud: ['#27307a', '#1b2360'], far: '#1c2468', farHi: '#2a3486', mid: '#12184c', midHi: '#1e2666',
    midDark: '#0a0f36', midDarkHi: '#141a4a',
    top: '#8ef3ff', topHi: '#eaffff', topSh: '#3fb8d8', body: '#262d6e', dark: '#191f52', light: '#353d88',
    block: '#5a68e0', blockHi: '#a3adff', blockDark: '#2f3a9c',
    plat: '#c04fd8', platHi: '#f3a6ff', platDark: '#7a2a90', deco: 'city', stars: true,
  },
};

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const hash = (a, b = 0) => { const h = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return h - Math.floor(h); };

// ───────────────────────── Level ─────────────────────────
const LEVEL_DEFS = globalThis.KJ_LEVELS || [];

function buildLevel(def) {
  const W = def.width, H = ROWS;
  const tiles = new Uint8Array(W * H);
  const lvl = {
    name: def.name, theme: THEMES[def.theme] || THEMES.park, par: def.par || 90,
    W, H, tiles, enemySpecs: [], stars: [], hearts: [], flags: [], signs: [], goal: null, spawn: null, arena: null,
  };
  const set = (x, y, t) => { if (x >= 0 && x < W && y >= 0 && y < H) tiles[y * W + x] = t; };
  const b = {
    ground(x0, x1, top = 15) { for (let x = x0; x <= x1; x++) for (let y = top; y < H; y++) set(x, y, GROUND); },
    block(x, y, w = 1, h = 1) { for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) set(x + i, y + j, BLOCK); },
    plat(x, y, w = 1) { for (let i = 0; i < w; i++) set(x + i, y, PLAT); },
    star(x, y) { lvl.stars.push({ x: (x + 0.5) * TILE, y: (y + 0.5) * TILE, got: false, ph: x * 0.7 }); },
    stars(x, y, n) { for (let i = 0; i < n; i++) b.star(x + i, y); },
    arc(x, y, n) { for (let i = 0; i < n; i++) b.star(x + i, y - Math.sin((i + 0.5) / n * Math.PI) * 1.5); },
    heart(x, y) { lvl.hearts.push({ x: (x + 0.5) * TILE, y: (y + 0.5) * TILE, got: false }); },
    cone(x, row) { lvl.enemySpecs.push({ type: 'cone', x, row }); },
    ball(x, row) { lvl.enemySpecs.push({ type: 'ball', x, row }); },
    bird(x, y, range = 3) { lvl.enemySpecs.push({ type: 'bird', x, y, range }); },
    flag(x, row) { lvl.flags.push({ x: (x + 0.5) * TILE, y: row * TILE, on: false, raise: 0 }); },
    sign(x, row, text) { lvl.signs.push({ x: (x + 0.5) * TILE, y: row * TILE, text }); },
    goal(x, row) { lvl.goal = { x: (x + 0.5) * TILE, y: row * TILE }; },
    arena(x0, x1, row = 15) { lvl.arena = { x0, x1, x: x0 * TILE, w: (x1 - x0) * TILE, y: row * TILE, cv: null, logo: false }; },
    spawn(x, row) { lvl.spawn = { x: x * TILE + (TILE - PW) / 2, y: row * TILE - PH }; },
  };
  def.build(b);
  if (!lvl.spawn) {
    let row = 15;
    for (let y = 0; y < H; y++) if (tiles[y * W + 2] === GROUND) { row = y; break; }
    b.spawn(2, row);
  }
  lvl.flags.sort((a, c) => a.x - c.x);
  return lvl;
}

function tileAt(lvl, tx, ty) {
  if (tx < 0 || tx >= lvl.W) return BLOCK;          // unsichtbare Wände am Levelrand
  if (ty < 0 || ty >= lvl.H) return EMPTY;
  return lvl.tiles[ty * lvl.W + tx];
}
const isSolid = t => t === GROUND || t === BLOCK;
// Abstand der Rollen zum nächsten Boden darunter (Infinity über einer Lücke)
function clearance(lvl, b) {
  const foot = b.y + b.h, x0 = Math.floor(b.x / TILE), x1 = Math.floor((b.x + b.w - 0.01) / TILE);
  for (let ty = Math.max(0, Math.ceil((foot - 0.01) / TILE)); ty < lvl.H; ty++) {
    for (let tx = x0; tx <= x1; tx++) if (tileAt(lvl, tx, ty) !== EMPTY) return ty * TILE - foot;
  }
  return Infinity;
}

// Bewegt einen Körper {x,y,w,h,vx,vy} und löst Kollisionen mit den Kacheln auf.
function moveBody(lvl, b, dt) {
  b.hitWall = 0;
  let nx = b.x + b.vx * dt;
  if (b.vx !== 0) {
    const dir = b.vx > 0 ? 1 : -1;
    const tx = Math.floor((dir > 0 ? nx + b.w : nx) / TILE);
    const y0 = Math.floor(b.y / TILE), y1 = Math.floor((b.y + b.h - 0.01) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      if (isSolid(tileAt(lvl, tx, ty))) {
        nx = dir > 0 ? tx * TILE - b.w - 0.001 : (tx + 1) * TILE + 0.001;
        b.vx = 0; b.hitWall = dir;
        break;
      }
    }
  }
  b.x = nx;

  const prevBottom = b.y + b.h;
  let ny = b.y + b.vy * dt;
  b.onGround = false;
  const x0 = Math.floor(b.x / TILE), x1 = Math.floor((b.x + b.w - 0.01) / TILE);
  if (b.vy >= 0) {
    const ty = Math.floor((ny + b.h) / TILE);
    for (let tx = x0; tx <= x1; tx++) {
      const t = tileAt(lvl, tx, ty);
      if (isSolid(t) || (t === PLAT && prevBottom <= ty * TILE + 0.01)) {
        ny = ty * TILE - b.h; b.vy = 0; b.onGround = true;
        break;
      }
    }
  } else {
    const ty = Math.floor(ny / TILE);
    for (let tx = x0; tx <= x1; tx++) {
      if (isSolid(tileAt(lvl, tx, ty))) { ny = (ty + 1) * TILE + 0.001; b.vy = 0; break; }
    }
  }
  b.y = ny;
}

// ───────────────────────── Ton ─────────────────────────
let actx = null, muted = false;
function audioInit() {
  if (actx) { if (actx.state === 'suspended') actx.resume(); return; }
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AC) return;
  try { actx = new AC(); } catch (e) { actx = null; }
}
function tone(f0, f1, dur, type = 'square', vol = 0.05, delay = 0) {
  if (!actx || muted) return;
  const t = actx.currentTime + delay;
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(actx.destination);
  o.start(t); o.stop(t + dur + 0.03);
}
const SFX = {
  jump: () => tone(360, 840, 0.17, 'square', 0.04),
  axel: () => { tone(560, 1320, 0.2, 'triangle', 0.06); tone(1120, 2200, 0.22, 'sine', 0.03, 0.05); },
  spin: () => { tone(300, 950, 0.28, 'triangle', 0.07); tone(600, 1500, 0.28, 'sine', 0.03, 0.04); },
  stomp: () => { tone(240, 70, 0.14, 'square', 0.07); tone(700, 1100, 0.1, 'triangle', 0.05, 0.05); },
  hit: () => { tone(520, 160, 0.16, 'sawtooth', 0.05); tone(900, 1400, 0.1, 'triangle', 0.05, 0.06); },
  star: () => { tone(1320, 1320, 0.07, 'triangle', 0.06); tone(1760, 1760, 0.14, 'triangle', 0.06, 0.07); },
  heart: () => { tone(660, 660, 0.1, 'triangle', 0.07); tone(880, 880, 0.1, 'triangle', 0.07, 0.1); tone(1320, 1320, 0.2, 'triangle', 0.07, 0.2); },
  hurt: () => tone(330, 90, 0.32, 'sawtooth', 0.07),
  fall: () => tone(500, 60, 0.5, 'triangle', 0.08),
  flag: () => { tone(523, 523, 0.09, 'square', 0.04); tone(659, 659, 0.09, 'square', 0.04, 0.09); tone(784, 784, 0.16, 'square', 0.04, 0.18); },
  win: () => [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, f, i === 6 ? 0.5 : 0.13, 'square', 0.045, i * 0.13)),
  over: () => [392, 330, 262, 196].forEach((f, i) => tone(f, f, 0.22, 'triangle', 0.07, i * 0.2)),
  card: () => tone(880, 1320, 0.09, 'triangle', 0.06),
};
function sfx(name) { const f = SFX[name]; if (f) f(); }
// Applaus: viele kurze Rauschstöße, jeder ein Händeklatschen; schwillt an und klingt wieder aus
const CLAP = { buf: null, out: null, bands: null };
function applause(dur, level = 1) {
  if (!actx || muted) return;
  if (!CLAP.buf) {
    const n = Math.floor(actx.sampleRate * 0.04), b = actx.createBuffer(1, n, actx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 2;
    CLAP.buf = b;
    CLAP.out = actx.createGain(); CLAP.out.connect(actx.destination);
    CLAP.bands = [900, 1400, 2100, 3000].map(f => {
      const q = actx.createBiquadFilter();
      q.type = 'bandpass'; q.frequency.value = f; q.Q.value = 0.9; q.connect(CLAP.out);
      return q;
    });
  }
  const t0 = actx.currentTime + 0.02, n = Math.round(dur * 40 * level);
  for (let i = 0; i < n; i++) {
    const k = Math.random(), env = Math.min(1, k / 0.12) * Math.min(1, (1 - k) / 0.35);
    const src = actx.createBufferSource(), g = actx.createGain();
    src.buffer = CLAP.buf; src.playbackRate.value = 0.8 + Math.random() * 0.6;
    g.gain.value = (0.13 + Math.random() * 0.2) * env * level;
    src.connect(g); g.connect(CLAP.bands[i % CLAP.bands.length]);
    src.start(t0 + k * dur);
  }
}
function loadMuted() { try { muted = localStorage.getItem('krec-jumper-muted') === '1'; } catch (e) { /* egal */ } }
function toggleMute() {
  muted = !muted;
  if (CLAP.out) CLAP.out.gain.value = muted ? 0 : 1;
  try { localStorage.setItem('krec-jumper-muted', muted ? '1' : '0'); } catch (e) { /* egal */ }
}

// ───────────────────────── Musik ─────────────────────────
// Drei kleine Walzer, einer je Kür – komplett aus Oszillatoren: Melodie, Bass auf der Eins, Akkorde auf Zwei
// und Drei, im zweiten Durchgang perlt eine Begleitung darüber. Schreibweise der Melodie: Note[:Schläge],
// „-" ist eine Pause, „|" trennt die Takte (nur zur Übersicht).
const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function noteHz(n) {
  const semi = SEMI[n[0]] + (n[1] === '#' ? 1 : n[1] === 'b' ? -1 : 0) + (+n[n.length - 1] + 1) * 12;
  return 440 * 2 ** ((semi - 69) / 12);
}
const CHORDS = {                                         // Basston, dann der Dreiklang für die Begleitung
  C: ['C3', 'E4', 'G4', 'C5'], G7: ['G3', 'F4', 'G4', 'B4'], Am: ['A3', 'E4', 'A4', 'C5'], F: ['F3', 'F4', 'A4', 'C5'],
  Dm: ['D3', 'F4', 'A4', 'D5'], E7: ['E3', 'E4', 'G#4', 'D5'], Gm: ['G3', 'G4', 'Bb4', 'D5'], A7: ['A3', 'E4', 'G4', 'C#5'],
  Bb: ['Bb3', 'F4', 'Bb4', 'D5'],
};
const SONG_SRC = {
  park: {                                                // Morgens im Park: heiter, C-Dur
    bpm: 172, chords: 'C C G7 G7 Am F Dm G7 C C G7 G7 F Dm G7 C',
    lead: 'G5 E5 G5 | C6:2 E6 | D6 B5 G5 | B5:2 A5 | C6 A5 C6 | F6:2 E6 | D6 C6 A5 | G5:2 - | '
        + 'G5 E5 G5 | C6:2 E6 | D6 F6 D6 | B5:2 G5 | A5 C6 F6 | E6 D6 C6 | B5 D6 B5 | C6:2 -',
  },
  abend: {                                               // Abendkür am Kanal: ruhiger, a-Moll
    bpm: 150, chords: 'Am Am Dm Dm E7 E7 Am Am F F C C Dm E7 Am Am',
    lead: 'A5:2 C6 | E6:2 C6 | D6:2 F6 | A5:3 | G#5 B5 E6 | D6:2 B5 | C6 B5 A5 | E5:2 - | '
        + 'F5 A5 C6 | F6:2 E6 | E6 C6 G5 | E6:2 D6 | D6 F6 A5 | G#5 B5 D6 | C6 A5 E5 | A5:2 -',
  },
  nacht: {                                               // Gala bei Nacht: schwungvoll, d-Moll
    bpm: 190, chords: 'Dm Dm Gm Gm A7 A7 Dm Dm Bb Bb F F Gm A7 Dm Dm',
    lead: 'D6 A5 F5 | A5:2 D6 | G5 Bb5 D6 | G6:2 F6 | E6 C#6 A5 | G5:2 A5 | F5 A5 D6 | F6:2 - | '
        + 'Bb5 D6 F6 | F6:2 D6 | A5 C6 F6 | C6:2 A5 | Bb5 D6 G6 | G6 E6 C#6 | D6 A5 F5 | D5:2 -',
  },
};
const VOICES = { lead: ['square', 0.026], bass: ['triangle', 0.075], chord: ['triangle', 0.024], arp: ['square', 0.009] };

function buildSong(src) {
  const ev = [], bars = src.chords.split(' '), beats = bars.length * 3;
  for (let pass = 0; pass < 2; pass++) {
    const t0 = pass * beats;
    bars.forEach((name, i) => {
      const ch = CHORDS[name].map(noteHz), t = t0 + i * 3;
      ev.push({ t, d: 0.9, hz: ch[0], v: 'bass' });
      for (const beat of [1, 2]) for (let k = 1; k < 4; k++) ev.push({ t: t + beat, d: 0.42, hz: ch[k], v: 'chord' });
      if (pass) [1, 2, 3, 2, 1, 2].forEach((k, j) => ev.push({ t: t + j * 0.5, d: 0.4, hz: ch[k] * 2, v: 'arp' }));
    });
    let t = t0;
    for (const tok of src.lead.split(/[\s|]+/)) {
      if (!tok) continue;
      const [n, d = '1'] = tok.split(':');
      if (n !== '-') ev.push({ t, d: +d * 0.92, hz: noteHz(n), v: 'lead' });
      t += +d;
    }
  }
  ev.sort((a, b) => a.t - b.t);
  return { spb: 60 / src.bpm, beats: beats * 2, ev };
}

const MUS = { key: null, song: null, i: 0, t0: 0, out: null, on: false, songs: {} };
function musicWant() {
  switch (G.state) {
    case 'title': return 'park';
    case 'win': return G.stateT > 1.8 ? 'park' : null;   // erst die Siegesfanfare ausklingen lassen
    case 'play': case 'pause': case 'finale': return G.lvl.theme.song;
    default: return null;                                // Zieleinlauf und Sturz haben ihre eigenen Klänge
  }
}
function musicNote(e, at, spb) {
  const [type, vol] = VOICES[e.v], dur = e.d * spb;
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(e.hz, at);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.linearRampToValueAtTime(vol, at + 0.012);
  g.gain.exponentialRampToValueAtTime(vol * 0.45, at + dur * 0.85);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g); g.connect(MUS.out);
  o.start(at); o.stop(at + dur + 0.03);
}
// Läuft in jedem Bild mit und legt die Noten der nächsten Fünftelsekunde auf die Zeitleiste des Audio-Kontexts
function musicTick() {
  if (!actx || actx.state !== 'running') return;
  const now = actx.currentTime, want = musicWant();
  if (!MUS.out) { MUS.out = actx.createGain(); MUS.out.gain.value = 0; MUS.out.connect(actx.destination); }
  if (want !== MUS.key) {
    MUS.key = want; MUS.i = 0; MUS.t0 = now + 0.12;
    MUS.song = want ? (MUS.songs[want] || (MUS.songs[want] = buildSong(SONG_SRC[want]))) : null;
  }
  const s = MUS.song, on = !!s && !muted && G.state !== 'pause';
  if (on !== MUS.on) { MUS.on = on; MUS.out.gain.setTargetAtTime(on ? 1 : 0, now, 0.03); }
  if (!s || G.state === 'pause') return;
  for (let n = 0; n < 48; n++) {
    const e = s.ev[MUS.i];
    let at = MUS.t0 + e.t * s.spb;
    if (at < now - 0.05) { MUS.t0 += now + 0.05 - at; at = now + 0.05; }   // nach Pause oder Tabwechsel wieder einfädeln
    if (at > now + 0.2) break;
    if (on) musicNote(e, at, s.spb);
    if (++MUS.i >= s.ev.length) { MUS.i = 0; MUS.t0 += s.beats * s.spb; }
  }
}

// ───────────────────────── Spielzustand ─────────────────────────
const input = { left: false, right: false, jump: false, spin: false, jumpPressed: false };
const NO_INPUT = { left: false, right: false, jump: false, spin: false, jumpPressed: false };
const GO_RIGHT = { left: false, right: true, jump: false, spin: false, jumpPressed: false };

const G = {
  state: 'title', stateT: 0, t: 0,
  levelIdx: 0, lvl: null, p: null, enemies: [], particles: [], popups: [],
  cam: 0, shake: 0, wipe: 0, toast: '', toastT: 0, hearts: MAX_HEARTS, score: 0, scoreAtStart: 0, best: 0,
  time: 0, starsGot: 0, checkpoint: null, marks: [], bonus: 0, sparkT: 0, fin: null, stale: null, lockT: 0, zoom: 1, zoomDx: 0, zoomY: 0,
};

function makePlayer(x, y) {
  return {
    x, y, w: PW, h: PH, vx: 0, vy: 0, onGround: false, hitWall: 0, facing: 1,
    coyote: 0, jumpBuf: 0, jumping: false, rotating: false, airRot: 0, axel: false, axelT: 0,
    spinning: false, spinT: 0, spinCd: 0, spinLock: false, spinCombo: 0,
    combo: 0, invuln: 0, stride: 0, dead: false, deadRot: 0,
    // nur für die Animation:
    turnK: 0, sitK: 0, spinYaw: 0, airT: 0, landT: 1, hurtT: 1,
  };
}

function makeEnemy(s) {
  const base = { type: s.type, vx: 0, vy: 0, dir: -1, t: s.x * 1.3, state: 'live', st: 0, rot: 0, spinDir: 1, turnK: 1, onGround: false, hitWall: 0, gone: false };
  if (s.type === 'bird') {
    return Object.assign(base, { w: 30, h: 20, x: (s.x + 0.5) * TILE - 15, y: s.y * TILE, x0: (s.x + 0.5) * TILE - 15, y0: s.y * TILE, range: s.range * TILE });
  }
  const w = s.type === 'cone' ? 24 : 28, h = 28;
  return Object.assign(base, { w, h, x: (s.x + 0.5) * TILE - w / 2, y: s.row * TILE - h });
}

function startLevel(idx) {
  G.levelIdx = idx;
  G.lvl = buildLevel(LEVEL_DEFS[idx]);
  G.enemies = G.lvl.enemySpecs.map(makeEnemy);
  G.hearts = MAX_HEARTS; G.time = 0; G.starsGot = 0;
  G.particles = []; G.popups = [];
  G.checkpoint = { x: G.lvl.spawn.x, y: G.lvl.spawn.y };
  G.stale = null; G.lockT = 0;
  G.p = makePlayer(G.checkpoint.x, G.checkpoint.y);
  G.cam = 0; G.shake = 0; G.wipe = 0.6; G.zoom = 1; G.zoomDx = 0;
  G.scoreAtStart = G.score;
  setState('play');
  input.jumpPressed = false;
}

function setState(s) { G.state = s; G.stateT = 0; }

function showTitle() {
  G.lvl = buildLevel(LEVEL_DEFS[0]);
  G.enemies = G.lvl.enemySpecs.map(makeEnemy);
  G.p = null; G.particles = []; G.popups = []; G.zoom = 1; G.zoomDx = 0;
  setState('title');
}

function loadBest() { try { G.best = +localStorage.getItem('krec-jumper-best') || 0; } catch (e) { G.best = 0; } }
function saveBest() {
  if (G.score <= G.best) return;
  G.best = G.score;
  try { localStorage.setItem('krec-jumper-best', String(G.best)); } catch (e) { /* egal */ }
}

// ───────────────────────── Spielerin ─────────────────────────
function endSpin(p) { p.spinning = false; p.spinCd = SPIN_CD; }

function stepPlayer(lvl, p, inp, dt) {
  const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
  p.coyote = p.onGround ? COYOTE : Math.max(0, p.coyote - dt);
  p.jumpBuf = inp.jumpPressed ? JUMP_BUF : Math.max(0, p.jumpBuf - dt);
  p.spinCd = Math.max(0, p.spinCd - dt);
  if (!inp.spin) p.spinLock = false;

  // Sitzpirouette: am Boden starten, solange ↓ gehalten wird (maximal SPIN_MAX)
  if (p.spinning) {
    p.spinT += dt;
    if (p.spinT >= SPIN_MAX) { endSpin(p); p.spinLock = true; }
    else if (!inp.spin && p.spinT >= SPIN_MIN) endSpin(p);
  } else if (inp.spin && !p.spinLock && p.onGround && p.spinCd <= 0) {
    p.spinning = true; p.spinT = 0; p.spinCombo = 0;
    sfx('spin');
  }

  // Rollen
  if (dir !== 0) {
    const turning = p.vx * dir < 0;
    const acc = p.spinning ? 420 : turning ? ACC_TURN : p.onGround ? ACC_GROUND : ACC_AIR;
    p.vx += dir * acc * dt;
    if (Math.abs(p.vx) > MAX_RUN) p.vx = Math.sign(p.vx) * MAX_RUN;
    if (!p.spinning) p.facing = dir;
  } else {
    const fr = (p.spinning ? 170 : p.onGround ? FRICTION : 220) * dt;
    p.vx = Math.abs(p.vx) <= fr ? 0 : p.vx - Math.sign(p.vx) * fr;
  }

  // Rittberger
  if (p.jumpBuf > 0 && p.coyote > 0) {
    p.vy = -JUMP_V; p.jumpBuf = 0; p.coyote = 0; p.onGround = false;
    p.jumping = true; p.rotating = true; p.airRot = 0; p.axel = false;
    if (p.spinning) endSpin(p);
    sfx('jump');
  } else if (inp.jumpPressed && p.rotating && !p.axel && !p.onGround && clearance(lvl, p) >= AXEL_MIN_H) {
    // Axel: weiter oben in der Luft noch einmal abdrücken – der Rittberger wird zum Axel
    p.axel = true; p.axelT = 0; p.jumping = false; p.jumpBuf = 0;
    p.vy = Math.min(p.vy, -AXEL_V);
    sfx('axel');
  }
  if (p.jumping && !inp.jump && p.vy < -JUMP_CUT) p.vy = -JUMP_CUT;   // kurzer Tastendruck = kleiner Sprung
  if (p.vy >= 0) p.jumping = false;

  p.vy = Math.min(MAX_FALL, p.vy + GRAVITY * dt);
  moveBody(lvl, p, dt);

  if (p.onGround) {
    p.jumping = false; p.rotating = false; p.axel = false;
    p.stride += Math.abs(p.vx) / MAX_RUN * 9 * dt;
  } else if (p.rotating) {
    p.airRot += 9.3 * dt;
    if (p.axel) p.axelT += dt;
  }
}

// Weiche Übergänge für die Darstellung: Umdrehen, In-die-Hocke-Gehen, Drehwinkel, Landung
function animatePlayer(p, dt) {
  p.turnK += clamp((p.facing > 0 ? 0 : 1) - p.turnK, -dt * 8, dt * 8);
  p.sitK += clamp((p.spinning ? 1 : 0) - p.sitK, -dt * 8, dt * 10);
  if (p.spinning) p.spinYaw += 14 * dt;
  else if (!p.onGround && p.rotating) p.spinYaw += (p.axel ? 15.5 : 10.2) * dt;
  else {                                                 // nach der Drehung zur Blickrichtung zurück
    let r = ((p.spinYaw % TAU) + TAU) % TAU;
    if (r > Math.PI) r -= TAU;
    p.spinYaw = r * Math.max(0, 1 - dt * 16);
  }
  p.airT = p.onGround ? 0 : p.airT + dt;
  p.landT += dt; p.hurtT += dt;
}

function addScore(n) { G.score += n; }
function popup(x, y, text, col = '#fff', size = 17) { G.popups.push({ x, y, text, col, size, t: 0 }); }
function burst(x, y, n, cols, speed = 220, kind = 'spark') {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, s = speed * (0.35 + Math.random() * 0.65);
    G.particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (kind === 'spark' ? 60 : 0),
      life: 0, max: 0.35 + Math.random() * 0.4, col: cols[i % cols.length],
      size: kind === 'spark' ? 3 + Math.random() * 3 : 3 + Math.random() * 4, kind,
    });
  }
}

function hurt(fromX) {
  const p = G.p;
  if (p.invuln > 0 || G.state !== 'play') return;
  G.hearts--; G.shake = 0.3; p.hurtT = 0;
  p.spinning = false; p.spinCd = SPIN_CD; p.jumping = false; p.rotating = false; p.axel = false;
  if (G.hearts <= 0) {
    p.dead = true; p.vy = -620; p.vx = 0;
    gameOver();
    return;
  }
  sfx('hurt');
  p.invuln = 1.6;
  p.vx = (p.x + p.w / 2 < fromX ? -1 : 1) * 250;
  p.vy = -400; p.onGround = false;
}

function gameOver() { sfx('over'); saveBest(); setState('over'); }

function respawn() {
  const cp = G.checkpoint;
  G.p = makePlayer(cp.x, cp.y);
  G.p.invuln = 1.5;
  G.cam = clamp(cp.x - VIEW_W * 0.42, 0, G.lvl.W * TILE - VIEW_W);
  // Wer beim Sturz noch gegengelenkt hat, soll nicht gleich wieder in die Lücke rollen: kurze Atempause,
  // und was schon vor dem Sturz gedrückt war, zählt erst wieder nach dem Loslassen.
  G.lockT = RESPAWN_LOCK;
  G.stale = { left: input.left, right: input.right, spin: input.spin };
}
const RESPAWN_LOCK = 0.5, HELD = { left: false, right: false, jump: false, spin: false, jumpPressed: false };
function playInput(dt) {
  const s = G.stale;
  if (!s) return input;
  G.lockT = Math.max(0, G.lockT - dt);
  for (const k of ['left', 'right', 'spin']) if (!input[k]) s[k] = false;
  const lock = G.lockT > 0;
  if (!lock && !s.left && !s.right && !s.spin) { G.stale = null; return input; }
  HELD.left = input.left && !s.left && !lock; HELD.right = input.right && !s.right && !lock; HELD.spin = input.spin && !s.spin && !lock;
  HELD.jump = input.jump && !lock; HELD.jumpPressed = input.jumpPressed && !lock;
  return HELD;
}

function finishLevel() {
  const lvl = G.lvl, total = lvl.stars.length;
  const sf = total ? G.starsGot / total : 1;
  const hf = clamp((G.hearts - 1) / (MAX_HEARTS - 1), 0, 1);
  const tf = clamp((lvl.par * 1.7 - G.time) / (lvl.par * 0.7), 0, 1);
  const base = 4.2 + sf * 1.0 + hf * 0.5 + tf * 0.3;      // 4,2 … 6,0 wie bei der alten Wertung
  G.marks = [0.6, -1, 1].map((d, i) => (base >= 5.95 ? 6 : Math.min(6, Math.round((base + d * 0.12 * hash(G.time, i)) * 10) / 10)));
  const timeBonus = Math.max(0, Math.round(lvl.par - G.time)) * 20;
  G.bonus = timeBonus + G.hearts * 300 + Math.round(G.marks.reduce((a, m) => a + m, 0) * 100);
  G.score += G.bonus;
  G.p.spinning = false;
  sfx('win');
  saveBest();
  setState('clear');
  if (lvl.arena) applause(6, 0.9);
  burst(partyX(), lvl.goal.y - 150, 40, ['#ffd23f', '#ff3f86', '#8ef3ff', '#ffffff'], 380);
}
// Wo Konfetti fliegt: am Zielbogen – oder in der Halle dort, wo die Läuferin steht
const partyX = () => (G.lvl.arena && G.p ? G.p.x + G.p.w / 2 : G.lvl.goal.x);

// Nach dem Zielbogen: Die Läuferin rollt aus (in der letzten Kür von selbst bis vor das Wertungsgericht),
// das Bild zoomt an sie heran und sie tanzt eine kleine Kür: Waage – Standpirouette – Rittberger – Schlusspose.
// In der Halle folgt die Verbeugung vor dem Wertungsgericht, das Publikum applaudiert. Erst danach kommen die Noten.
const FIN_STOP = 908, FIN_SPEED = 230, BOW_T = 2.3;       // Haltepunkt (Pixel ab Hallenanfang), Tempo, Dauer der Verbeugung
const DANCE_T = 3.9, DANCE_HOP = 2.45, DANCE_END = 3.1;   // Dauer des Tanzes, Absprung, Beginn der Schlusspose
const finPhase = name => (G.state === 'finale' && G.fin.phase === name);
function setFinPhase(name) { G.fin.phase = name; G.fin.t = 0; }
function startFinale() {
  const p = G.p;
  p.spinning = false; p.invuln = 0;
  G.fin = { phase: 'roll', t: 0 };
  setState('finale');
  if (G.lvl.arena) applause(5.5, 0.6);
}
function updateFinale(dt) {
  const p = G.p, lvl = G.lvl, f = G.fin, wasGround = p.onGround, pcx = p.x + p.w / 2;
  const stopX = lvl.arena ? lvl.arena.x + FIN_STOP : -Infinity;          // ohne Halle: einfach ausrollen
  const go = f.phase === 'roll' && pcx + p.vx * p.vx / (2 * FRICTION) < stopX && p.vx < FIN_SPEED;
  stepPlayer(lvl, p, go ? GO_RIGHT : NO_INPUT, dt);
  if (p.onGround && !wasGround && p.airT > 0.16) p.landT = 0;
  animatePlayer(p, dt);
  f.t += dt;
  if (f.phase === 'roll') {
    if ((p.onGround && p.vx === 0 && pcx + 12 >= stopX) || f.t > 12) {
      p.vx = 0; p.facing = 1; G.zoomY = p.y + p.h;
      setFinPhase('dance');
      if (lvl.arena) applause(DANCE_T + 1, 0.8);
    }
  } else if (f.phase === 'dance') {
    if (f.t >= DANCE_HOP && f.t - dt < DANCE_HOP && p.onGround) {        // der Sprung im Tanz ist ein echter Rittberger
      p.vy = -560; p.onGround = false; p.rotating = true; p.jumping = false; p.axel = false;
      sfx('jump');
    }
    if (f.t >= DANCE_END && f.t - dt < DANCE_END) { burst(p.x + p.w / 2, p.y + 14, 16, ['#ffd23f', '#ffffff', '#ff8fb8', '#8ef3ff'], 170); sfx('heart'); }
    if (f.t >= DANCE_T) {
      if (lvl.arena) { setFinPhase('bow'); applause(BOW_T + 1.5, 1); } else finishLevel();
    }
  } else if (f.t >= BOW_T) finishLevel();
}
function skipFinale() {                                  // ungeduldig? direkt zur Wertung
  const p = G.p, a = G.lvl.arena;
  if (a) {
    p.x = a.x + FIN_STOP - p.w / 2; p.y = a.y - p.h; p.vy = 0; p.onGround = true;
    G.cam = clamp(p.x - VIEW_W * 0.42, 0, G.lvl.W * TILE - VIEW_W);
  }
  p.vx = 0; p.facing = 1; p.rotating = false; p.axel = false; p.jumping = false;
  finishLevel();
}
// Die Figuren des Tanzes; d = Sekunden seit Beginn. k mischt die Pose über die Grundhaltung.
function danceMove(d, o) {
  if (d < 1.3) return { name: 'Waage', P: skaterPose('waage', o), k: smooth(Math.min((d - 0.1) / 0.3, (1.3 - d) / 0.2)), yaw: 0 };
  if (d < DANCE_HOP) {
    const u = (d - 1.3) / (DANCE_HOP - 1.3);
    return { name: 'Standpirouette', P: skaterPose('pir', o), k: smooth(Math.min(u * 7, (1 - u) * 7)), yaw: TAU * 3 * smooth(u), spin: true };
  }
  if (d < DANCE_END) return { name: 'Rittberger', P: null, k: 0, yaw: 0 };
  const k = smooth(Math.min((d - DANCE_END) / 0.22, (DANCE_T - d) / 0.25));
  return { name: 'Schlusspose', P: skaterPose('finish', o), k, yaw: -0.9 * k };
}

const COMBO_NAMES = ['Rittberger!', 'Doppelter Rittberger!', 'Dreifacher Rittberger!', 'Vierfacher Rittberger!!'];
const AXEL_NAMES = ['Axel!', 'Doppelaxel!', 'Dreifachaxel!', 'Vierfachaxel!!'];
const comboName = (names, n) => names[Math.min(n, names.length) - 1];

// ───────────────────────── Gegner ─────────────────────────
function updateEnemy(lvl, e, dt) {
  e.t += dt;
  e.turnK += clamp((e.dir > 0 ? 0 : 1) - e.turnK, -dt * 7, dt * 7);
  if (e.state === 'spun') {
    e.vy += GRAVITY * dt; e.x += e.vx * dt; e.y += e.vy * dt; e.rot += e.spinDir * 15 * dt;
    if (e.y > ROWS * TILE + 80) e.gone = true;
    return;
  }
  if (e.state === 'squash') { e.st += dt; if (e.st > 0.45) e.gone = true; return; }
  if (e.type === 'bird') {
    e.x += e.dir * 75 * dt;
    if (e.x > e.x0 + e.range) e.dir = -1; else if (e.x < e.x0 - e.range) e.dir = 1;
    e.y = e.y0 + Math.sin(e.t * 3) * 9;
    return;
  }
  e.vx = e.dir * (e.type === 'cone' ? 48 : 72);
  e.vy = Math.min(MAX_FALL, e.vy + GRAVITY * dt);
  moveBody(lvl, e, dt);
  if (e.hitWall) e.dir = -e.hitWall;
  else if (e.onGround) {                               // an Kanten umdrehen
    const px = e.dir > 0 ? e.x + e.w + 1 : e.x - 1;
    if (tileAt(lvl, Math.floor(px / TILE), Math.floor((e.y + e.h + 2) / TILE)) === EMPTY) e.dir = -e.dir;
  }
  if (e.y > ROWS * TILE + 80) e.gone = true;
}

// ───────────────────────── Update ─────────────────────────
function updatePlay(dt) {
  const p = G.p, lvl = G.lvl;
  G.time += dt;
  const wasGround = p.onGround, wasSpinning = p.spinning, wasAxel = p.axel;
  stepPlayer(lvl, p, playInput(dt), dt);
  p.invuln = Math.max(0, p.invuln - dt);
  const pcx = p.x + p.w / 2, pby = p.y + p.h;

  if (p.onGround && !wasGround) {
    p.combo = 0;
    if (p.airT > 0.16) p.landT = 0;                      // Auslauf-Pose nach einem Sprung
    burst(pcx, pby, 4, ['#ffffff'], 70, 'dust');
  }
  animatePlayer(p, dt);
  if (p.onGround && !p.spinning && Math.abs(p.vx) > 240 && Math.random() < dt * 10) {
    G.particles.push({ x: pcx - p.facing * 8, y: pby - 2, vx: -p.facing * 30, vy: -20, life: 0, max: 0.3, col: '#ffffff', size: 3, kind: 'dust' });
  }
  if (p.spinning) {
    G.sparkT -= dt;
    if (G.sparkT <= 0) {
      G.sparkT = 0.035;
      const a = Math.random() * TAU;
      G.particles.push({ x: pcx + Math.cos(a) * 24, y: pby - 12 + Math.sin(a) * 7, vx: Math.cos(a) * 60, vy: -50 - Math.random() * 60, life: 0, max: 0.4, col: Math.random() < 0.5 ? '#ffd23f' : '#ffffff', size: 3 + Math.random() * 2, kind: 'spark' });
    }
  } else if (wasSpinning && p.onGround) {
    burst(pcx, pby, 3, ['#ffffff'], 60, 'dust');
  }
  if (p.axel) {                                          // Axel: Glitzerstoß beim Abdrücken, danach ein Schweif
    if (!wasAxel) { burst(pcx, pby - 8, 12, ['#8ef3ff', '#ffffff', '#ff8fb8'], 190); G.sparkT = 0; }
    G.sparkT -= dt;
    if (G.sparkT <= 0) {
      G.sparkT = 0.03;
      G.particles.push({ x: pcx + (Math.random() - 0.5) * 22, y: p.y + 8 + Math.random() * (p.h - 12), vx: -p.vx * 0.2, vy: 30, life: 0, max: 0.38, col: Math.random() < 0.6 ? '#8ef3ff' : '#ffffff', size: 3 + Math.random() * 2, kind: 'spark' });
    }
  }

  // Gegner
  for (const e of G.enemies) {
    updateEnemy(lvl, e, dt);
    if (e.state !== 'live') continue;
    const axelHit = p.axel && e.type === 'bird';         // im Axel erwischt man Tauben aus jeder Richtung
    const pad = p.spinning ? 9 : axelHit ? 5 : 0, padY = axelHit ? 5 : 0;
    if (p.x - pad < e.x + e.w && p.x + p.w + pad > e.x && p.y - padY < e.y + e.h && pby + padY > e.y) {
      const ecx = e.x + e.w / 2, ecy = e.y + e.h / 2;
      if (p.spinning) {
        e.state = 'spun'; e.spinDir = ecx >= pcx ? 1 : -1; e.vx = e.spinDir * 250; e.vy = -540;
        p.spinCombo++;
        addScore(200 * p.spinCombo);
        popup(ecx, e.y - 12, p.spinCombo > 1 ? `Sitzpirouette ×${p.spinCombo}!` : 'Sitzpirouette!', '#8ef3ff');
        burst(ecx, ecy, 10, ['#8ef3ff', '#ffffff', '#ffd23f']);
        sfx('hit');
      } else if (p.vy > 0 && pby - e.y < 20 && e.type !== 'ball') {
        e.state = 'squash';
        p.combo++;
        p.vy = input.jump ? -JUMP_V * 0.96 : -500;
        addScore((p.axel ? 300 : 200) * p.combo);
        popup(ecx, e.y - 12, comboName(p.axel ? AXEL_NAMES : COMBO_NAMES, p.combo), p.axel ? '#8ef3ff' : '#ffd23f');
        p.jumping = false; p.rotating = true; p.airRot = 0; p.axel = false;   // neuer Rittberger – der nächste Axel ist wieder frei
        burst(ecx, e.y, 10, ['#ffd23f', '#ffffff', '#ff3f86']);
        sfx('stomp');
      } else if (axelHit) {
        e.state = 'spun'; e.spinDir = ecx >= pcx ? 1 : -1; e.vx = e.spinDir * 280; e.vy = -420;
        p.combo++;
        p.vy = Math.min(p.vy, -300);
        addScore(300 * p.combo);
        popup(ecx, e.y - 12, comboName(AXEL_NAMES, p.combo), '#8ef3ff');
        burst(ecx, ecy, 12, ['#8ef3ff', '#ffffff', '#ffd23f']);
        sfx('hit');
      } else {
        if (e.type === 'ball' && p.invuln <= 0 && p.vy > 0 && pby - e.y < 20) popup(ecx, e.y - 12, 'Autsch – nur mit Pirouette!', '#ff9aa8', 14);
        hurt(ecx);
        if (G.state !== 'play') return;
      }
    }
  }
  if (G.enemies.some(e => e.gone)) G.enemies = G.enemies.filter(e => !e.gone);

  // Sterne, Herzen, Fahnen
  const pcy = p.y + p.h / 2;
  for (const s of lvl.stars) {
    if (!s.got && Math.abs(s.x - pcx) < 21 && Math.abs(s.y - pcy) < 36) {
      s.got = true; G.starsGot++; addScore(100);
      burst(s.x, s.y, 6, ['#ffd23f', '#fff6c4'], 150);
      sfx('star');
    }
  }
  for (const h of lvl.hearts) {
    if (!h.got && Math.abs(h.x - pcx) < 22 && Math.abs(h.y - pcy) < 36) {
      h.got = true;
      if (G.hearts < MAX_HEARTS) { G.hearts++; popup(h.x, h.y - 16, '+1 Herz', '#ff7a9c'); }
      else { addScore(500); popup(h.x, h.y - 16, '+500', '#ff7a9c'); }
      burst(h.x, h.y, 10, ['#ff3f6e', '#ffc2d1'], 170);
      sfx('heart');
    }
  }
  for (const f of lvl.flags) {
    if (!f.on && Math.abs(f.x - pcx) < 24 && pby > f.y - 100 && p.y < f.y) {
      for (const g of lvl.flags) if (g.x <= f.x) g.on = true;
      G.checkpoint = { x: f.x - PW / 2, y: f.y - PH };
      popup(f.x, f.y - 84, 'Rücksetzpunkt!', '#ffffff');
      burst(f.x, f.y - 60, 10, ['#ff3f86', '#ffd23f', '#ffffff'], 170);
      sfx('flag');
    }
  }

  // Ziel
  const goal = lvl.goal;
  if (goal && pcx >= goal.x - 6 && pby <= goal.y + 6 && pby > goal.y - 5 * TILE) { startFinale(); return; }

  // In die Lücke gefallen
  if (p.y > ROWS * TILE + 50) {
    G.hearts--; G.shake = 0.25;
    if (G.hearts <= 0) { p.dead = true; gameOver(); }
    else { sfx('fall'); respawn(); }
  }
}

function updateCamera(dt) {
  const p = G.p;
  if (!p || p.dead) return;
  const target = clamp(p.x + p.w / 2 - VIEW_W * 0.42 + p.facing * 46, 0, G.lvl.W * TILE - VIEW_W);
  G.cam += (target - G.cam) * Math.min(1, dt * 5.5);
}

function update(dt) {
  G.t += dt; G.stateT += dt;
  const lvl = G.lvl;
  switch (G.state) {
    case 'play':
      updatePlay(dt);
      updateCamera(dt);
      break;
    case 'finale':
      updateFinale(dt);
      for (const e of G.enemies) updateEnemy(lvl, e, dt);
      updateCamera(dt);
      break;
    case 'clear':
      stepPlayer(lvl, G.p, NO_INPUT, dt);
      animatePlayer(G.p, dt);
      for (const e of G.enemies) updateEnemy(lvl, e, dt);
      updateCamera(dt);
      if (G.stateT < 2.4 && Math.random() < dt * 14) burst(partyX() + (Math.random() - 0.5) * 220, lvl.goal.y - 90 - Math.random() * 120, 5, ['#ffd23f', '#ff3f86', '#8ef3ff', '#ffffff'], 160);
      for (let i = 0; i < 3; i++) { const tt = 1.0 + i * 0.4; if (G.stateT >= tt && G.stateT - dt < tt) sfx('card'); }
      break;
    case 'over': {
      const p = G.p;
      p.vy = Math.min(MAX_FALL, p.vy + GRAVITY * dt); p.y += p.vy * dt; p.deadRot += 9 * dt;
      for (const e of G.enemies) updateEnemy(lvl, e, dt);
      break;
    }
    case 'title':
      G.cam = 200 + (Math.sin(G.t * 0.12 - 1.5) + 1) * 0.5 * Math.min(1600, lvl.W * TILE - VIEW_W - 200);
      for (const e of G.enemies) updateEnemy(lvl, e, dt);
      break;
    default: break;                                     // pause, win: Welt steht still
  }
  if (G.state !== 'pause') {
    for (const q of G.particles) {
      q.life += dt; q.x += q.vx * dt; q.y += q.vy * dt;
      q.vy += (q.kind === 'spark' ? 420 : -30) * dt; q.vx *= 1 - 2.2 * dt;
    }
    if (G.particles.length) G.particles = G.particles.filter(q => q.life < q.max);
    for (const q of G.popups) { q.t += dt; q.y -= 34 * dt; }
    if (G.popups.length) G.popups = G.popups.filter(q => q.t < 1.1);
    G.shake = Math.max(0, G.shake - dt);
    // Zoom: beim Tanz ganz heran, bei der Verbeugung etwas weiter mit dem Wertungsgericht im Bild
    const zt = finPhase('dance') ? 2 : finPhase('bow') ? 1.5 : 1, dxT = finPhase('bow') ? 46 : 0, zk = Math.min(1, dt * 4.5);
    G.zoom = Math.abs(zt - G.zoom) < 0.01 ? zt : G.zoom + (zt - G.zoom) * zk;
    G.zoomDx += (dxT - G.zoomDx) * zk;
    G.wipe = Math.max(0, G.wipe - dt); G.toastT = Math.max(0, G.toastT - dt);
    for (const f of lvl.flags) if (f.on) f.raise = Math.min(1, f.raise + dt * 3);
  }
  input.jumpPressed = false;
}

// Enter / Leertaste / Tippen in Menüs
function confirm() {
  switch (G.state) {
    case 'title': G.score = 0; startLevel(0); break;
    case 'pause': setState('play'); break;
    case 'over': if (G.stateT > 0.9) { G.score = G.scoreAtStart; startLevel(G.levelIdx); } break;
    case 'finale': if (G.stateT > 0.6) skipFinale(); break;
    case 'clear':
      if (G.stateT > 2.4) {
        if (G.levelIdx + 1 < LEVEL_DEFS.length) startLevel(G.levelIdx + 1);
        else { setState('win'); sfx('win'); }
      }
      break;
    case 'win': if (G.stateT > 1) showTitle(); break;
    default: break;
  }
}
function togglePause() {
  if (G.state === 'play') setState('pause');
  else if (G.state === 'pause') setState('play');
}

// ───────────────────────── Pixel-Grundlagen ─────────────────────────
// Gezeichnet wird auf 480×270 Pixel (1 Bildpixel = 2 Welt-Einheiten) und dann hart hochskaliert.
function makeCanvas(w, h) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; return cv; }
function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
const INK_RGB = hexRgb(INK);
const wpx = v => Math.floor(v / PXS);
function R(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(x, y, w, h); }
function disc(c, cx, cy, r, col) {
  c.fillStyle = col;
  for (let dy = -r; dy <= r; dy++) { const w = Math.floor(Math.sqrt(r * r - dy * dy) + 0.35); c.fillRect(cx - w, cy + dy, w * 2 + 1, 1); }
}
// Macht aus einer Zeichnung harte Pixel und legt optional eine dunkle Kontur darum
function pix(w, h, draw, outline = true) {
  const cv = makeCanvas(w, h), c = cv.getContext('2d');
  draw(c);
  const im = c.getImageData(0, 0, w, h), d = im.data, src = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) src[i] = d[i * 4 + 3] > 127 ? 1 : 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (src[i]) { d[i * 4 + 3] = 255; continue; }
    d[i * 4 + 3] = 0;
    if (outline && ((x > 0 && src[i - 1]) || (x < w - 1 && src[i + 1]) || (y > 0 && src[i - w]) || (y < h - 1 && src[i + w]))) {
      d[i * 4] = INK_RGB[0]; d[i * 4 + 1] = INK_RGB[1]; d[i * 4 + 2] = INK_RGB[2]; d[i * 4 + 3] = 255;
    }
  }
  c.putImageData(im, 0, 0);
  return cv;
}
// Pixelbild aus Textzeilen, z. B. ['.#.', '###'] mit Farbtabelle {'#': '#fff'}
function pmap(rows, pal, outline = true) {
  const o = outline ? 1 : 0;
  return pix(rows[0].length + 2 * o, rows.length + 2 * o, c => {
    rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (pal[r[x]]) R(c, x + o, y + o, 1, 1, pal[r[x]]); });
  }, outline);
}

// ───────────────────────── Pixelschrift (5×7, nur Großbuchstaben) ─────────────────────────
const GLYPH_SRC = {
  A: '.###.|#...#|#...#|#####|#...#|#...#|#...#', B: '####.|#...#|#...#|####.|#...#|#...#|####.',
  C: '.###.|#...#|#....|#....|#....|#...#|.###.', D: '####.|#...#|#...#|#...#|#...#|#...#|####.',
  E: '#####|#....|#....|####.|#....|#....|#####', F: '#####|#....|#....|####.|#....|#....|#....',
  G: '.###.|#...#|#....|#.###|#...#|#...#|.###.', H: '#...#|#...#|#...#|#####|#...#|#...#|#...#',
  I: '.###.|..#..|..#..|..#..|..#..|..#..|.###.', J: '..###|...#.|...#.|...#.|...#.|#..#.|.##..',
  K: '#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#', L: '#....|#....|#....|#....|#....|#....|#####',
  M: '#...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#', N: '#...#|##..#|#.#.#|#..##|#...#|#...#|#...#',
  O: '.###.|#...#|#...#|#...#|#...#|#...#|.###.', P: '####.|#...#|#...#|####.|#....|#....|#....',
  Q: '.###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#', R: '####.|#...#|#...#|####.|#.#..|#..#.|#...#',
  S: '.####|#....|#....|.###.|....#|....#|####.', T: '#####|..#..|..#..|..#..|..#..|..#..|..#..',
  U: '#...#|#...#|#...#|#...#|#...#|#...#|.###.', V: '#...#|#...#|#...#|#...#|#...#|.#.#.|..#..',
  W: '#...#|#...#|#...#|#.#.#|#.#.#|##.##|#...#', X: '#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#',
  Y: '#...#|#...#|.#.#.|..#..|..#..|..#..|..#..', Z: '#####|....#|...#.|..#..|.#...|#....|#####',
  0: '.###.|#...#|#..##|#.#.#|##..#|#...#|.###.', 1: '..#..|.##..|..#..|..#..|..#..|..#..|.###.',
  2: '.###.|#...#|....#|...#.|..#..|.#...|#####', 3: '####.|....#|....#|.###.|....#|....#|####.',
  4: '...#.|..##.|.#.#.|#..#.|#####|...#.|...#.', 5: '#####|#....|####.|....#|....#|#...#|.###.',
  6: '.###.|#....|#....|####.|#...#|#...#|.###.', 7: '#####|....#|...#.|..#..|..#..|..#..|..#..',
  8: '.###.|#...#|#...#|.###.|#...#|#...#|.###.', 9: '.###.|#...#|#...#|.####|....#|....#|.###.',
  '.': '.....|.....|.....|.....|.....|.....|..#..', ',': '.....|.....|.....|.....|.....|..#..|.#...',
  '!': '..#..|..#..|..#..|..#..|..#..|.....|..#..', '?': '.###.|#...#|....#|...#.|..#..|.....|..#..',
  ':': '.....|.....|..#..|.....|.....|..#..|.....', '-': '.....|.....|.....|.###.|.....|.....|.....',
  '–': '.....|.....|.....|#####|.....|.....|.....', '+': '.....|..#..|..#..|#####|..#..|..#..|.....',
  '/': '....#|....#|...#.|..#..|.#...|#....|#....', '(': '..#..|.#...|.#...|.#...|.#...|.#...|..#..',
  ')': '..#..|...#.|...#.|...#.|...#.|...#.|..#..', "'": '..#..|..#..|.....|.....|.....|.....|.....',
  '·': '.....|.....|.....|..#..|.....|.....|.....', '×': '.....|#...#|.#.#.|..#..|.#.#.|#...#|.....',
  '←': '.....|..#..|.#...|#####|.#...|..#..|.....', '→': '.....|..#..|...#.|#####|...#.|..#..|.....',
  '↓': '..#..|..#..|..#..|#.#.#|.###.|..#..|.....', '↑': '.....|..#..|.###.|#.#.#|..#..|..#..|..#..',
  '▲': '.....|..#..|..#..|.###.|.###.|#####|.....', '★': '..#..|..#..|#####|.###.|.###.|##.##|#...#',
  '♥': '.....|.#.#.|#####|#####|.###.|..#..|.....',
};
const GLYPHS = {};
for (const ch of Object.keys(GLYPH_SRC)) {
  const rows = GLYPH_SRC[ch].split('|');
  let x0 = 5, x1 = -1;
  for (const r of rows) for (let x = 0; x < r.length; x++) if (r[x] === '#') { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
  GLYPHS[ch] = { w: x1 - x0 + 1, rows: rows.map(r => r.slice(x0, x1 + 1)) };
}
GLYPHS[' '] = { w: 3, rows: Array(7).fill('...') };
for (const [u, b] of [['Ä', 'A'], ['Ö', 'O'], ['Ü', 'U']]) GLYPHS[u] = { w: 5, rows: GLYPHS[b].rows, dots: true };   // Punkte sitzen über der Zeile

function textW(str, scale = 1) {
  let w = 0;
  for (const ch of str) w += (GLYPHS[ch] || GLYPHS[' ']).w + 1;
  return Math.max(0, w - 1) * scale;
}
const textCache = new Map();
function textSprite(str, scale, col, outline, grad) {
  const key = `${str}|${scale}|${col}|${outline}|${grad ? grad.join() : ''}`;
  let cv = textCache.get(key);
  if (cv) return cv;
  if (textCache.size > 600) textCache.clear();
  const t = outline ? (scale >= 3 ? 2 : 1) : 0, sh = outline ? (scale >= 4 ? 2 : scale >= 2 ? 1 : 0) : 0;
  let up = 0;
  for (const ch of str) if (GLYPHS[ch] && GLYPHS[ch].dots) up = 2 * scale;
  const tw = textW(str, scale), W = Math.max(1, tw + 2 * t + sh), H = 7 * scale + 2 * t + sh + up;
  const mask = new Uint8Array(W * H);
  let gx = 0;
  for (const ch of str) {
    const g = GLYPHS[ch] || GLYPHS[' '];
    if (g.dots) for (const x of [1, 3]) for (let j = 0; j < scale; j++) for (let i = 0; i < scale; i++) mask[(t + j) * W + t + (gx + x) * scale + i] = 1;
    for (let r = 0; r < 7; r++) for (let x = 0; x < g.w; x++) {
      if (g.rows[r][x] !== '#') continue;
      for (let j = 0; j < scale; j++) for (let i = 0; i < scale; i++) mask[(t + up + r * scale + j) * W + t + (gx + x) * scale + i] = r + 1;
    }
    gx += g.w + 1;
  }
  cv = makeCanvas(W, H);
  const c = cv.getContext('2d'), im = c.createImageData(W, H), d = im.data;
  const rgb = hexRgb(col), gr = grad ? grad.map(hexRgb) : null, ol = outline ? hexRgb(outline) : null;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, m = mask[i];
    let p = null;
    if (m) p = gr ? gr[m - 1] : rgb;
    else if (ol) {
      for (let dy = -t - sh; dy <= t && !p; dy++) for (let dx = -t - sh; dx <= t; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < W && yy < H && mask[yy * W + xx]) { p = ol; break; }
      }
    }
    if (p) { d[i * 4] = p[0]; d[i * 4 + 1] = p[1]; d[i * 4 + 2] = p[2]; d[i * 4 + 3] = 255; }
  }
  c.putImageData(im, 0, 0);
  cv.t = t; cv.tw = tw; cv.up = up;
  textCache.set(key, cv);
  return cv;
}
// o: { scale, col, align: 'left'|'center'|'right', outline: Farbe oder null, grad: 7 Zeilenfarben }
function drawText(c, str, x, y, o = {}) {
  str = String(str).toUpperCase();
  const cv = textSprite(str, o.scale || 1, o.col || '#ffffff', o.outline === undefined ? INK : o.outline, o.grad);
  let dx = x;
  if (o.align === 'center') dx = x - (cv.tw >> 1); else if (o.align === 'right') dx = x - cv.tw;
  c.drawImage(cv, Math.round(dx) - cv.t, Math.round(y) - cv.t - cv.up);
  return cv.tw;
}

// ───────────────────────── Mini-3D → Pixel-Sprites ─────────────────────────
// Figuren bestehen aus Kugeln und Kapseln im Raum (f = vorn, u = oben, s = Seite). Sie werden mit
// Tiefenpuffer und drei Helligkeitsstufen in ein kleines Pixelbild gerendert – so dreht sich die
// Läuferin bei Rittberger und Sitzpirouette wirklich um die eigene Achse.
const PAL = [[0, 0, 0]], M = {};
function defMat(name, hi, base, sh) { M[name] = PAL.length; PAL.push(hexRgb(hi), hexRgb(base), hexRgb(sh)); }
defMat('skin', '#ffe3c8', '#f6bb92', '#cf8562');
defMat('tights', '#fbd3b4', '#eba57e', '#bd7355');
defMat('hair', '#a85a30', '#6f3520', '#431d13');
defMat('dress', '#ff8fb8', '#ff3f86', '#b5175a');
defMat('gold', '#fff5ad', '#ffd23f', '#c48c14');
defMat('boot', '#ffffff', '#e4e8f6', '#a4abca');
defMat('wheel', '#8ff5e6', '#19c7b5', '#0b7d76');
defMat('ink', INK, INK, INK);
defMat('white', '#ffffff', '#ffffff', '#d8dcec');
defMat('cone', '#ffb066', '#ff7a1a', '#c44a08');
defMat('coneBase', '#f0661a', '#d9480f', '#96300a');
defMat('ball', '#a27cf0', '#7446d8', '#4a2a9c');
defMat('spike', '#5a3396', '#35185f', '#200d3d');
defMat('tip', '#f1e6ff', '#f1e6ff', '#c9b6f0');
defMat('bird', '#c3cee0', '#93a1b8', '#66738c');
defMat('birdDark', '#8794ab', '#5d6a80', '#3f4a5e');
defMat('beak', '#ffc35a', '#ff9f1a', '#c26a08');
defMat('neck', '#9be6bf', '#5fc795', '#3a8f69');
const C_INK = M.ink + 1, C_WHITE = M.white;
const LX = -0.45, LY = -0.62, LZ = 0.64;                 // Licht von links oben vorn

function makeRaster(size, ox, oy) {
  const cv = makeCanvas(size, size), c = cv.getContext('2d');
  return { size, ox, oy, cv, c, img: c.createImageData(size, size), col: new Uint8Array(size * size), z: new Float32Array(size * size), id: new Uint8Array(size * size), cy: 1, sy: 0, cr: 1, sr: 0, roll: false, pivot: 0 };
}
let RS = null;
function rasters() { return RS || (RS = { skater: makeRaster(48, 24, 40), enemy: makeRaster(36, 18, 28) }); }

function rsBegin(rs, yaw, roll, pivot) {
  rs.col.fill(0); rs.z.fill(-1e9);
  rs.cy = Math.cos(yaw); rs.sy = Math.sin(yaw);
  rs.roll = !!roll; rs.cr = Math.cos(roll || 0); rs.sr = Math.sin(roll || 0); rs.pivot = pivot;
}
function rsT(rs, p) {
  let X = p[0] * rs.cy + p[2] * rs.sy, Y = p[1];
  const Z = -p[0] * rs.sy + p[2] * rs.cy;
  if (rs.roll) { const x = X, y = Y - rs.pivot; X = x * rs.cr - y * rs.sr; Y = x * rs.sr + y * rs.cr + rs.pivot; }
  return [rs.ox + X, rs.oy - Y, Z];
}
function splat(rs, X, Y, Z, rx, ry, m, id) {
  const S = rs.size;
  const x0 = Math.max(0, Math.floor(X - rx)), x1 = Math.min(S - 1, Math.ceil(X + rx));
  const y0 = Math.max(0, Math.floor(Y - ry)), y1 = Math.min(S - 1, Math.ceil(Y + ry));
  for (let py = y0; py <= y1; py++) {
    const dy = (py + 0.5 - Y) / ry, dy2 = dy * dy;
    if (dy2 > 1) continue;
    for (let px = x0; px <= x1; px++) {
      const dx = (px + 0.5 - X) / rx, d2 = dx * dx + dy2;
      if (d2 > 1) continue;
      const nz = Math.sqrt(1 - d2), z = Z + nz * rx, i = py * S + px;
      if (z <= rs.z[i]) continue;
      const l = dx * LX + dy * LY + nz * LZ;
      rs.z[i] = z; rs.id[i] = id; rs.col[i] = m + (l > 0.72 ? 0 : l > 0.16 ? 1 : 2);
    }
  }
}
function rsSph(rs, p, r, m, id, ry) { const q = rsT(rs, p); splat(rs, q[0], q[1], q[2], r, ry || r, m, id); }
function rsCap(rs, a, b, ra, rb, m, id) {
  const A = rsT(rs, a), B = rsT(rs, b);
  const n = Math.max(1, Math.ceil(Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]) / 0.55));
  for (let i = 0; i <= n; i++) {
    const k = i / n, r = ra + (rb - ra) * k;
    splat(rs, A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k, A[2] + (B[2] - A[2]) * k, r, r, m, id);
  }
}
// Einzelne Pixel (Augen …) auf der Oberfläche; nur sichtbar, wenn sie zur Kamera zeigen
function rsDecal(rs, p, cells, id) {
  const q = rsT(rs, p), S = rs.size, bx = Math.floor(q[0]), by = Math.floor(q[1]), z = q[2] + 0.7;
  for (const [dx, dy, col] of cells) {
    const x = bx + dx, y = by + dy;
    if (x < 0 || y < 0 || x >= S || y >= S) continue;
    const i = y * S + x;
    if (rs.col[i] && z >= rs.z[i]) { rs.col[i] = col; rs.z[i] = z; rs.id[i] = id; }
  }
}
function rsFinish(rs, flash) {
  const S = rs.size, col = rs.col, z = rs.z, id = rs.id, d = rs.img.data;
  const darken = k => { const c = col[k]; col[k] = c - ((c - 1) % 3) + 2; };
  for (let y = 0; y < S - 1; y++) for (let x = 0; x < S - 1; x++) {     // Schattenkante, wo ein Körperteil vor einem anderen liegt
    const i = y * S + x;
    if (!col[i]) continue;
    for (const j of [i + 1, i + S]) {
      if (!col[j] || id[i] === id[j]) continue;
      const dz = z[i] - z[j];
      if (dz > 1.5) darken(j); else if (dz < -1.5) darken(i);
    }
  }
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = y * S + x, o = i * 4, c = col[i];
    if (c) {
      const p = flash ? [255, 255, 255] : PAL[c];
      d[o] = p[0]; d[o + 1] = p[1]; d[o + 2] = p[2]; d[o + 3] = 255;
    } else if ((x > 0 && col[i - 1]) || (x < S - 1 && col[i + 1]) || (y > 0 && col[i - S]) || (y < S - 1 && col[i + S])) {
      d[o] = INK_RGB[0]; d[o + 1] = INK_RGB[1]; d[o + 2] = INK_RGB[2]; d[o + 3] = 255;
    } else d[o + 3] = 0;
  }
  rs.c.putImageData(rs.img, 0, 0);
  return rs.cv;
}

const vadd = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const vmad = (a, b, k) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const vnorm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
// Knie/Ellbogen zwischen a und b; pole gibt an, wohin das Gelenk zeigt
function ik3(a, b, l1, l2, pole) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], len = Math.hypot(dx, dy, dz) || 0.001;
  const L = Math.min(len, l1 + l2 - 0.01), u = [dx / len, dy / len, dz / len];
  const x = (l1 * l1 - l2 * l2 + L * L) / (2 * L), h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
  const pd = pole[0] * u[0] + pole[1] * u[1] + pole[2] * u[2];
  const p = vnorm([pole[0] - u[0] * pd, pole[1] - u[1] * pd, pole[2] - u[2] * pd]);
  return [a[0] + u[0] * x + p[0] * h, a[1] + u[1] * x + p[1] * h, a[2] + u[2] * x + p[2] * h];
}

// ───────────────────────── Rollkunstläuferin: Posen ─────────────────────────
// Koordinaten in Sprite-Pixeln: [vorn, oben, Seite]. „a" = Bein/Arm zur Kamera, „b" = dahinter.
function skaterPose(name, o) {
  const t = o.t || 0;
  switch (name) {
    case 'skate': {
      const a = Math.sin(o.stride || 0), lean = o.lean || 0;
      return {
        hip: [0, 12.8 + Math.abs(a) * 0.5, 0], chest: [1.2 + lean * 0.9, 19.1 + Math.abs(a) * 0.4, 0], head: [0.9, 4.1, 0],
        fa: [a * 3.8, 3.2 + Math.max(0, -a) * 2.4, 1.5 + Math.max(0, -a)], fb: [-a * 3.8, 3.2 + Math.max(0, a) * 2.4, -1.5 - Math.max(0, a)],
        da: [1, Math.min(0, a) * 0.5, 0], db: [1, Math.min(0, -a) * 0.5, 0],
        ha: [1 - a * 3.4, 14.6, 3.5], hb: [1 + a * 3.4, 14.6, -3.5], flare: 0.15,
      };
    }
    case 'takeoff': return {
      hip: [0, 13.8, 0], chest: [0.2, 20.4, 0], head: [0.2, 4.2, 0], fa: [0.2, 3.2, 0.6], fb: [1.8, 5.6, -0.8],
      da: [1, -0.5, 0], db: [1, -0.4, 0], ha: [2.6, 25, 2.8], hb: [2.6, 25, -2.8], flare: 0.3,
    };
    case 'air': return {                                   // Rittberger: Arme an die Brust, Beine gekreuzt
      hip: [0, 13.6, 0], chest: [0.1, 20.2, 0], head: [0.2, 4.2, 0], fa: [0.4, 3.6, 0.5], fb: [-0.2, 5.4, -0.4],
      da: [1, -0.25, 0], db: [1, -0.4, 0], ha: [1.9, 18.8, 1.1], hb: [1.9, 17.9, -1.1], flare: 0.85,
    };
    case 'axelKick': return {                              // Abdruck zum Axel: Spielbein schwingt nach vorn oben durch
      hip: [0, 13.6, 0], chest: [-0.4, 20.2, 0], head: [0.2, 4.2, 0], fa: [-1.2, 3.0, 0.5], fb: [6.2, 9.0, -0.8],
      da: [1, -0.5, 0], db: [0.9, 0.45, 0], ha: [3.6, 25.4, 3.4], hb: [3.6, 25.4, -3.4], flare: 0.5,
    };
    case 'axel': return {                                  // Axel: ganz eng zusammengezogen, schnelle Drehung
      hip: [0, 13.8, 0], chest: [0, 20.6, 0], head: [0.2, 4.2, 0], fa: [0.3, 3.4, 0.4], fb: [0, 4.8, -0.3],
      da: [1, -0.35, 0], db: [1, -0.5, 0], ha: [1.5, 20.2, 0.5], hb: [1.5, 19.2, -0.5], flare: 1,
    };
    case 'open': return {                                  // Öffnen vor der Landung
      hip: [0, 13.4, 0], chest: [0.5, 20, 0], head: [0.3, 4.2, 0], fa: [0.3, 3.4, 0.4], fb: [-5, 5.6, -0.6],
      da: [1, 0, 0], db: [0.8, -0.6, 0], ha: [4.6, 19.6, 4.2], hb: [-3.6, 19.6, -4.6], flare: 0.6,
    };
    case 'land': return {                                  // Auslauf: Spielbein nach hinten gestreckt
      hip: [0.2, 12.0, 0], chest: [1.8, 18.3, 0], head: [0.8, 4.1, 0], fa: [0.5, 3.2, 0.4], fb: [-8.3, 7.6, -0.6],
      da: [1, 0, 0], db: [0.75, -0.65, 0], ha: [7.2, 18.4, 5.2], hb: [-5.2, 18.8, -6.2], flare: 0.45,
    };
    case 'fall': return {
      hip: [0, 13.4, 0], chest: [-0.3, 19.8, 0], head: [0.2, 4.2, 0], fa: [1.8, 4.4, 1.7], fb: [-2, 3.6, -1.7],
      da: [1, -0.3, 0], db: [1, 0.2, 0], ha: [1.4, 24.6, 5], hb: [-0.6, 24.6, -5], flare: 0.7,
    };
    case 'sit': return {                                   // Sitzpirouette: tief in der Hocke, Spielbein gestreckt
      hip: [-1.6, 7.6, 0], chest: [1.7, 12.7, 0], head: [1.5, 3.8, 0], fa: [0, 3.2, 0.2], fb: [8.6, 6.4, -0.9],
      da: [1, 0, 0], db: [1, 0.35, 0], ha: [6.4, 9.6, 1.2], hb: [6.8, 9.0, -1.8], flare: 1,
    };
    case 'waage': return {                                 // Waage: Oberkörper vor, Spielbein gestreckt nach hinten oben
      hip: [0, 13.2, 0], chest: [5.4, 16.4, 0], head: [3.6, 2.2, 0], fa: [0.2, 3.2, 0.4], fb: [-9.2, 15.5, -0.6],
      da: [1, 0, 0], db: [-0.95, 0.3, 0], ha: [11.5, 18, 2.6], hb: [0, 19.5, -6], flare: 0.3,
    };
    case 'pir': return {                                   // Standpirouette: aufrecht, Arme über dem Kopf, Spielfuß am Knie
      hip: [0, 13.6, 0], chest: [0, 20.2, 0], head: [0.2, 4.2, 0], fa: [0.2, 3.2, 0.3], fb: [1.6, 8.2, -0.6],
      da: [1, 0, 0], db: [0.6, -0.8, 0], ha: [0.6, 27.6, 1.4], hb: [0.6, 27.6, -1.4], flare: 1,
    };
    case 'finish': return {                                // Schlusspose: ein Arm hoch, einer zur Seite, Fuß aufgestellt
      hip: [0, 13.2, 0], chest: [-0.3, 19.8, 0], head: [0.2, 4.3, 0], fa: [0, 3.2, 0.6], fb: [4.6, 3.6, -2.8],
      da: [1, 0, 0], db: [1, -0.35, 0], ha: [1.0, 27.4, 3.4], hb: [0.6, 20.6, -8], flare: 0.5,
    };
    case 'bow': return {                                   // Verbeugung: Oberkörper vor, Arme nach hinten oben gestreckt
      hip: [-1.0, 12.9, 0], chest: [3.9, 17.2, 0], head: [3.4, 2.4, 0], fa: [0.6, 3.2, 1.0], fb: [-4.2, 3.4, -1.0],
      da: [1, 0, 0], db: [0.9, -0.3, 0], ha: [-3.2, 20.2, 5], hb: [-3.2, 20.2, -5], flare: 0.2,
    };
    case 'win': {
      const w = Math.sin(t * 6) * 0.8;
      return {
        hip: [0, 13.2, 0], chest: [0, 19.8, 0], head: [0.2, 4.2, 0], fa: [0, 3.2, 0.5], fb: [-8.3, 8.4, -1],
        da: [1, 0, 0], db: [0.7, -0.7, 0], ha: [1.2, 26.6 + w, 4.4], hb: [1.2, 26.6 - w, -4.4], flare: 0.4,
      };
    }
    default: {
      const b = Math.sin(t * 2.4) * 0.35;
      return {
        hip: [0, 13.2 + b, 0], chest: [0.2, 19.6 + b * 1.6, 0], head: [0.3, 4.2, 0], fa: [0.4, 3.2, 1.5], fb: [-0.4, 3.2, -1.5],
        da: [1, 0, 0], db: [1, 0, 0], ha: [0.8, 13.8 + b, 3.5], hb: [0.8, 13.8 + b, -3.5], flare: 0.1,
      };
    }
  }
}
function mixPose(a, b, k) {
  if (k <= 0) return a;
  if (k >= 1) return b;
  const o = {};
  for (const key of Object.keys(a)) {
    const x = a[key], y = b[key];
    o[key] = typeof x === 'number' ? x + (y - x) * k : [x[0] + (y[0] - x[0]) * k, x[1] + (y[1] - x[1]) * k, x[2] + (y[2] - x[2]) * k];
  }
  return o;
}
const smooth = k => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };

// Rendert die Läuferin in ihr Sprite. yaw: 0 = schaut nach rechts, -90° = zur Kamera, 180° = links.
function renderSkater(P, yaw, roll, flash, tail, lag) {
  const rs = rasters().skater;
  rsBegin(rs, yaw, roll, 14);
  const hip = P.hip, chest = P.chest, H = vadd(chest, P.head), F = P.flare;
  for (const side of [-1, 1]) {
    const foot = side > 0 ? P.fa : P.fb, dir = vnorm(side > 0 ? P.da : P.db), id = side > 0 ? 2 : 1;
    const hp = [hip[0], hip[1], side * 1.3];
    const knee = ik3(hp, foot, 5.4, 5.4, [1, 0.3, side * 0.2]);
    rsCap(rs, hp, knee, 1.65, 1.4, M.tights, id);
    rsCap(rs, knee, foot, 1.35, 1.2, M.tights, id);
    const d = dir[1], n = vnorm([-dir[0] * d, 1 - d * d, -dir[2] * d]);   // „oben" am Rollschuh
    rsCap(rs, vmad(vmad(foot, dir, -0.5), n, -0.2), vmad(vmad(foot, dir, 1.9), n, -0.7), 1.5, 1.35, M.boot, id);
    rsSph(rs, vmad(foot, n, 1.0), 1.4, M.boot, id);
    for (const w of [-0.9, 1.9]) for (const zz of [-0.8, 0.8]) rsSph(rs, vadd(vmad(vmad(foot, dir, w), n, -2.25), [0, 0, zz]), 1.05, M.wheel, id);
    rsSph(rs, vmad(vmad(foot, dir, 3.1), n, -1.5), 0.8, M.dress, id);
  }
  // Rumpf, Röckchen (fliegt bei Drehungen nach außen), Gürtel
  rsCap(rs, [hip[0], hip[1] + 0.6, 0], chest, 2.5, 2.7, M.dress, 3);
  rsSph(rs, [hip[0] - lag, hip[1] - 0.9 + F * 0.5, 0], 4.3 + F * 1.9, M.dress, 3, 1.0);
  rsSph(rs, [hip[0] - lag * 0.5, hip[1] + 0.2, 0], 3.7 + F * 1.0, M.dress, 3, 1.1);
  rsSph(rs, [hip[0], hip[1] + 1.3, 0], 3.1 + F * 0.3, M.dress, 3, 1.2);
  rsSph(rs, vadd(vmad(hip, [chest[0] - hip[0], chest[1] - hip[1], 0], 0.42), [0, 0, 0]), 2.85, M.gold, 3, 0.55);
  for (const side of [-1, 1]) {
    const hand = side > 0 ? P.ha : P.hb, id = side > 0 ? 5 : 4;
    const shd = [chest[0], chest[1] + 0.5, side * 2.6];
    const el = ik3(shd, hand, 4, 4, [-0.7, -0.6, side * 0.9]);
    rsSph(rs, shd, 1.45, M.dress, 3);
    rsCap(rs, shd, el, 1.1, 1.0, M.skin, id);
    rsCap(rs, el, hand, 1.0, 0.95, M.skin, id);
    rsSph(rs, hand, 1.2, M.skin, id);
  }
  // Kopf mit Pferdeschwanz
  rsSph(rs, vadd(chest, [0.2, 2.5, 0]), 1.2, M.skin, 6);
  rsSph(rs, vadd(H, [0.5, 0, 0]), 3.15, M.skin, 6);
  rsSph(rs, vadd(H, [-0.55, 0.45, 0]), 3.5, M.hair, 7);
  rsSph(rs, vadd(H, [1.6, 2.3, 0]), 1.8, M.hair, 7);
  const B = vadd(H, [-2.7, 2.6, 0]), td = vnorm(tail);
  rsSph(rs, B, 1.2, M.gold, 8);
  rsCap(rs, vmad(B, td, 1.3), vmad(B, td, 3.4), 1.55, 1.35, M.hair, 7);
  rsCap(rs, vmad(B, td, 3.4), vadd(vmad(B, td, 5.4), [0, -0.7, 0]), 1.35, 0.8, M.hair, 7);
  for (const s of [-1, 1]) rsDecal(rs, vadd(H, [3.2, 0.9, s * 1.9]), [[0, 0, C_INK], [0, 1, C_INK]], 6);
  return rsFinish(rs, flash);
}

// Wählt Pose und Blickrichtung aus dem Spielzustand und zeichnet die Läuferin
function drawPlayer(c, cam) {
  const p = G.p;
  if (!p) return;
  const blink = p.invuln > 0 && G.state === 'play';
  if (blink && p.hurtT > 0.12 && Math.floor(p.invuln * 15) % 2 === 0) return;
  const px = wpx(p.x + p.w / 2) - cam, py = wpx(p.y + p.h);
  const o = { t: G.t, stride: p.stride, lean: clamp(p.vx * p.facing / MAX_RUN, -1, 1) };
  const speed = Math.abs(p.vx) / MAX_RUN;
  let P, yaw = -Math.PI * p.turnK + p.spinYaw, roll = 0, danceSpin = 0;
  if (p.dead) { P = skaterPose('fall', o); roll = p.deadRot; }
  else {
    if (!p.onGround) {
      if (p.rotating) {
        P = mixPose(skaterPose(p.axel ? 'axel' : 'air', o), skaterPose('open', o), clamp((p.vy - 140) / 380, 0, 1));
        if (p.axel && p.axelT < 0.16) P = mixPose(skaterPose('axelKick', o), P, smooth(p.axelT / 0.16));
        else if (p.airT < 0.1) P = mixPose(skaterPose('takeoff', o), P, p.airT / 0.1);
      } else P = skaterPose('fall', o);
    } else {
      P = skaterPose(speed > 0.09 ? 'skate' : 'idle', o);
      if (p.landT < 0.34) P = mixPose(skaterPose('land', o), P, smooth((p.landT - 0.12) / 0.22));
    }
    if (p.sitK > 0) P = mixPose(P, skaterPose('sit', o), smooth(p.sitK));
    if (finPhase('dance') && p.onGround) {                 // die kleine Kür nach dem Ziel
      const d = danceMove(G.fin.t, o);
      if (d.P) P = mixPose(P, d.P, d.k);
      yaw += d.yaw; danceSpin = d.spin ? d.k : 0;
    }
    if (finPhase('bow')) {                                 // runter, halten, wieder aufrichten
      const b = G.fin.t, k = smooth(Math.min(b / 0.45, (BOW_T - 0.3 - b) / 0.45));
      P = mixPose(P, skaterPose('bow', o), k);
      yaw -= 0.4 * k;                                      // leicht zum Bild gedreht, damit man die Verbeugung sieht
    }
    if (G.state === 'clear' && p.onGround) {
      const k = smooth(G.stateT * 2.5);
      P = mixPose(P, skaterPose('win', o), k);
      yaw += (-0.9 + 1.8 * p.turnK) * k;                  // dreht sich zum Publikum
    }
  }
  // Pferdeschwanz und Rock reagieren auf Tempo, Fallen und Drehung
  const spin = Math.max(p.sitK, danceSpin, !p.onGround && p.rotating ? 1 : 0);
  const tail = [-0.45 - speed * 0.7 - spin * 0.6, -0.9 + (p.onGround ? 0 : clamp(p.vy / 600, -0.5, 1.7)) + spin * 0.85, 0];
  const cv = renderSkater(P, yaw, roll, blink && p.hurtT < 0.12, tail, o.lean * 1.1);

  // Schatten am Boden
  if (!p.dead) {
    const gy = groundBelow(G.lvl, p.x + p.w / 2, p.y + p.h);
    if (gy !== null) { const hgt = (gy - (p.y + p.h)) / PXS; drawShadow(c, px, wpx(gy), clamp(6 - hgt / 9, 2, 6)); }
  }
  // Glitzerkranz bei Drehungen – hintere Hälfte hinter der Figur, vordere davor
  const ring = spin > 0.3 && !p.dead
    ? (p.sitK > 0.3 ? { y: py - 4, r: 15, n: 6, col: '#ffd23f' } : p.axel ? { y: py - 17, r: 14, n: 8, col: '#8ef3ff' } : { y: py - 15, r: 10, n: 4, col: '#ffd23f' })
    : null;
  const sparkle = front => {
    for (let i = 0; i < ring.n; i++) {
      const a = (p.spinYaw + (danceSpin ? G.t * 12 : 0)) * 0.7 + i * TAU / ring.n, s = Math.sin(a);
      if ((s > 0) !== front) continue;
      const x = px + Math.round(Math.cos(a) * ring.r), y = ring.y + Math.round(s * 3);
      const col = i % 2 ? '#ffffff' : ring.col;
      R(c, x, y, 1, 1, col);
      if (front) { R(c, x - 1, y, 3, 1, col); R(c, x, y - 1, 1, 3, col); }
    }
  };
  if (ring) sparkle(false);
  c.drawImage(cv, px - 24, py - 40);
  if (ring) sparkle(true);
}

function groundBelow(lvl, x, footY) {
  const tx = Math.floor(x / TILE);
  for (let ty = Math.max(0, Math.floor(footY / TILE)); ty < Math.floor(footY / TILE) + 8; ty++) if (tileAt(lvl, tx, ty)) return ty * TILE;
  return null;
}
function drawShadow(c, px, py, w) {
  w = Math.round(w);
  c.globalAlpha = 0.3; c.fillStyle = INK;
  c.fillRect(px - w, py, w * 2, 1); c.fillRect(px - w + 1, py + 1, w * 2 - 2, 1);
  c.globalAlpha = 1;
}

// ───────────────────────── Gegner ─────────────────────────
const EYE = (fwd, dizzy) => dizzy
  ? [[0, 0, C_INK], [1, 0, C_INK], [0, 1, C_WHITE], [1, 1, C_WHITE], [0, 2, C_INK], [1, 2, C_INK]]
  : [[0, 0, C_INK], [1, 0, C_INK], [0, 1, C_WHITE], [1, 1, C_WHITE], [0, 2, C_WHITE], [1, 2, C_WHITE], [fwd ? 1 : 0, 2, C_INK]];

function renderEnemy(e) {
  const rs = rasters().enemy, live = e.state === 'live', spun = e.state === 'spun';
  if (e.type === 'cone') {
    const step = live ? Math.sin(e.t * 11) : 0;
    rsBegin(rs, -0.5 - (Math.PI - 1.0) * e.turnK + (spun ? e.rot : 0), spun ? e.rot * 0.7 : step * 0.08, 6);
    for (const s of [-1, 1]) rsSph(rs, [step * s * 1.5 + 0.5, 0.9 + Math.max(0, step * s) * 0.9, s * 2.3], 1.7, M.ink, 1, 1.0);
    rsSph(rs, [0, 2.6, 0], 6.0, M.coneBase, 2, 1.15);
    for (let u = 3.3; u <= 13.7; u += 0.6) rsSph(rs, [0, u, 0], 4.4 - (u - 3.3) / 10.4 * 3.6, u > 8.6 && u < 11 ? M.white : M.cone, 3, 0.9);
    for (const s of [-1, 1]) rsDecal(rs, [2.72, 7.6, s * 1.86], EYE(rs.cy >= 0, !live), 4);
  } else if (e.type === 'ball') {
    rsBegin(rs, spun ? e.rot : 0, 0, 7);
    const C = [0, 7, 0], a0 = spun ? e.rot * 1.4 : -e.x / 14;
    rsSph(rs, C, 5.3, M.ball, 2);
    const spike = d => { rsCap(rs, vmad(C, d, 4.4), vmad(C, d, 7.5), 1.35, 0.4, M.spike, 3); rsSph(rs, vmad(C, d, 7.3), 0.75, M.tip, 3); };
    for (let i = 0; i < 8; i++) spike([Math.cos(a0 + i * TAU / 8), Math.sin(a0 + i * TAU / 8), 0]);
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) { const a = a0 + (i + 0.5) * TAU / 4; spike([Math.cos(a) * 0.72, Math.sin(a) * 0.72, s * 0.69]); }
    for (const s of [-1, 1]) rsDecal(rs, [s * 2 + e.dir * 0.6 - 0.5, 9, 5.2], EYE(e.dir > 0, !live), 4);
  } else {                                               // Taube
    rsBegin(rs, -0.4 - (Math.PI - 0.8) * e.turnK + (spun ? e.rot : 0), spun ? e.rot * 0.6 : 0, 6);
    const flap = live ? Math.sin(e.t * 15) : 0.5;
    rsCap(rs, [-4, 5.2, 0], [-7.4, 6.2, 0], 1.6, 0.8, M.birdDark, 1);
    rsCap(rs, [-2.2, 5, 0], [1.8, 5.6, 0], 2.9, 3.1, M.bird, 2);
    rsSph(rs, [2.9, 6.5, 0], 2.4, M.neck, 2);
    rsSph(rs, [4.1, 8.1, 0], 2.5, M.bird, 4);
    rsCap(rs, [6, 7.9, 0], [8.2, 7.3, 0], 1.0, 0.45, M.beak, 5);
    for (const s of [-1, 1]) {
      const mid = [-0.6, 6.8 + flap * 2.6, s * 5];
      rsCap(rs, [0.4, 6.6, s * 2.2], mid, 1.8, 1.4, M.birdDark, 6);
      rsCap(rs, mid, [-1.8, 6.6 + flap * 5.4, s * 8], 1.4, 0.7, M.birdDark, 6);
    }
    for (const s of [-1, 1]) rsDecal(rs, [5.5, 9.2, s * 2.1], [[0, 0, live ? C_INK : C_WHITE]], 4);
  }
  return rsFinish(rs, false);
}

function drawEnemy(c, e, cam) {
  const px = wpx(e.x + e.w / 2) - cam, py = wpx(e.y + e.h);
  if (px < -30 || px > LW + 30) return;
  const cv = renderEnemy(e);
  if (e.state === 'squash') {
    if (e.st > 0.3 && Math.floor(e.st * 30) % 2) return;
    const k = clamp(e.st / 0.08, 0, 1), h = Math.round(28 * (1 - 0.7 * k)), w = Math.round(36 * (1 + 0.35 * k));
    c.drawImage(cv, 0, 0, 36, 28, px - (w >> 1), py - h, w, h);
    return;
  }
  if (e.state === 'live' && e.type !== 'bird') drawShadow(c, px, py, 5);
  c.drawImage(cv, px - 18, py - 28);
}

// ───────────────────────── Hintergrund und Kacheln ─────────────────────────
function buildSky(th) {
  const cv = makeCanvas(LW, LH), c = cv.getContext('2d'), im = c.createImageData(LW, LH), d = im.data;
  const s = th.sky.map(hexRgb), bands = 12, bh = LH / bands;
  const at = k => {
    k = clamp(k, 0, 1);
    const a = k < 0.6 ? s[0] : s[1], b = k < 0.6 ? s[1] : s[2], f = k < 0.6 ? k / 0.6 : (k - 0.6) / 0.4;
    return [Math.round(a[0] + (b[0] - a[0]) * f), Math.round(a[1] + (b[1] - a[1]) * f), Math.round(a[2] + (b[2] - a[2]) * f)];
  };
  const orb = th.orb, oc = hexRgb(orb.col), og = hexRgb(orb.glow);
  for (let y = 0; y < LH; y++) {
    const b = Math.floor(y / bh), f = (y - b * bh) / bh, A = at(b / (bands - 1)), B = at((b + 1) / (bands - 1));
    for (let x = 0; x < LW; x++) {
      let p = f > 0.75 ? ((x + y) % 2 ? A : B) : f > 0.5 ? ((x + 2 * y) % 4 ? A : B) : A;   // gerasterte Farbstreifen
      const dist = Math.hypot(x + 0.5 - orb.x, y + 0.5 - orb.y);
      if (dist < orb.r) p = oc;
      else if (dist < orb.r * 1.45) { if ((x + y) % 2 === 0) p = og; }
      else if (dist < orb.r * 2.0) { if ((x + 2 * y) % 4 === 0) p = og; }
      const o = (y * LW + x) * 4;
      d[o] = p[0]; d[o + 1] = p[1]; d[o + 2] = p[2]; d[o + 3] = 255;
    }
  }
  c.putImageData(im, 0, 0);
  if (th.stars) for (let i = 0; i < 90; i++) R(c, Math.floor(hash(i, 1) * LW), Math.floor(hash(i, 2) * 170), 1, 1, hash(i, 5) > 0.6 ? '#ffffff' : '#8f9ae8');
  return cv;
}
function buildCloud(th, i) {
  const w = [46, 62, 34][i], h = 20;
  const el = [[w / 2, 13, w / 2 - 1, 5], [w * 0.32, 9, w * 0.2, 6], [w * 0.62, 8, w * 0.24, 7]];
  const inside = (x, y) => el.some(([cx, cy, rx, ry]) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1);
  return pix(w, h, c => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (inside(x, y)) R(c, x, y, 1, 1, inside(x, y + 2) ? th.cloud[0] : th.cloud[1]);
  }, false);
}
function buildTree(th, s) {
  const w = Math.round(46 * s), h = Math.round(58 * s), cx = w >> 1, q = v => Math.round(v * s);
  return pix(w, h, c => {
    R(c, cx - q(2), q(32), q(4) + 1, h - q(32), th.midDark);
    disc(c, cx, q(19), q(15), th.midDark); disc(c, cx - q(11), q(28), q(10), th.midDark); disc(c, cx + q(11), q(27), q(11), th.midDark);
    disc(c, cx - q(4), q(14), q(8), th.midDarkHi); disc(c, cx - q(13), q(25), q(5), th.midDarkHi); disc(c, cx + q(9), q(22), q(6), th.midDarkHi);
  }, false);
}
function buildGlow(r, col) {
  return pix(r * 2 + 1, r * 2 + 1, c => {
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      const dd = Math.hypot(x, y);
      if (dd < r * 0.5 ? (x + y) % 2 === 0 : dd < r && (x + 2 * y + 400) % 4 === 0) R(c, x + r, y + r, 1, 1, col);
    }
  }, false);
}
function buildTiles(th) {
  const mk = (h, draw) => { const cv = makeCanvas(TPX, h); draw(cv.getContext('2d')); return cv; };
  const body = v => c => {
    R(c, 0, 0, 15, 15, th.body);
    for (let i = 0; i < 6; i++) {
      const x = Math.floor(hash(v * 7 + i, 1) * 13), y = Math.floor(hash(v * 7 + i, 2) * 13) + 1;
      R(c, x, y, 2, 1, th.dark);
      if (i < 2) R(c, (x + 6) % 14, (y + 5) % 14, 1, 1, th.light);
    }
  };
  const top = v => c => {
    body(v)(c);
    R(c, 0, 0, 15, 1, th.topHi); R(c, 0, 1, 15, 2, th.top); R(c, 0, 3, 15, 1, th.topSh); R(c, 0, 4, 15, 1, th.dark);
    R(c, 14, 1, 1, 2, th.topSh);
  };
  return {
    body: [0, 1, 2, 3].map(v => mk(15, body(v))), top: [0, 1, 2, 3].map(v => mk(15, top(v))),
    block: mk(15, c => {
      R(c, 0, 0, 15, 15, INK);
      for (const [x, y] of [[0, 0], [14, 0], [0, 14], [14, 14]]) c.clearRect(x, y, 1, 1);
      R(c, 1, 1, 13, 13, th.block); R(c, 1, 1, 13, 1, th.blockHi); R(c, 1, 1, 1, 13, th.blockHi);
      R(c, 1, 13, 13, 1, th.blockDark); R(c, 13, 1, 1, 13, th.blockDark);
      ['..#..', '#####', '.###.', '.#.#.'].forEach((r, y) => { for (let x = 0; x < 5; x++) if (r[x] === '#') R(c, 5 + x, 5 + y, 1, 1, th.blockDark); });
    }),
    plat: mk(6, c => {
      R(c, 0, 0, 15, 1, th.platHi); R(c, 0, 1, 15, 3, th.plat); R(c, 0, 4, 15, 1, th.platDark); R(c, 0, 5, 15, 1, INK);
      R(c, 2, 2, 1, 1, th.platHi); R(c, 12, 2, 1, 1, th.platHi); R(c, 14, 1, 1, 3, th.platDark);
    }),
  };
}
function assets(th) {
  if (th._a) return th._a;
  return (th._a = {
    sky: buildSky(th), clouds: [0, 1, 2].map(i => buildCloud(th, i)), tiles: buildTiles(th),
    trees: [buildTree(th, 1), buildTree(th, 0.72)], glow: buildGlow(16, th.orb.col),
  });
}

function drawBackground(c, th, camW, t) {
  const A = assets(th), cam = camW / PXS;
  c.drawImage(A.sky, 0, 0);
  if (th.stars) for (let i = 0; i < 16; i++) if (Math.sin(t * (1 + hash(i, 3) * 2) + i * 2) > 0.2) R(c, Math.floor(hash(i, 11) * LW), Math.floor(hash(i, 12) * 150), 1, 1, '#ffffff');
  for (let i = 0; i < 6; i++) {
    const cl = A.clouds[i % 3], span = LW + 160;
    const x = (((hash(i, 8) * span - cam * 0.07 - t * (1.5 + i * 0.5)) % span) + span) % span - 80;
    c.drawImage(cl, Math.round(x), 16 + Math.floor(hash(i, 9) * 78));
  }
  if (th.deco === 'city') {                              // Scheinwerfer der Gala
    c.fillStyle = '#9fe9ff'; c.globalAlpha = 0.1;
    for (let i = 0; i < 3; i++) {
      const bx = 90 + i * 150 - Math.floor(cam * 0.1) % 150, sl = Math.tan(Math.sin(t * 0.5 + i * 2.1) * 0.5);
      for (let y = 20; y < 236; y += 2) { const h = 236 - y, w = Math.max(1, Math.round(h * 0.16)); c.fillRect(Math.round(bx + h * sl - w / 2), y, w, 2); }
    }
    c.globalAlpha = 1;
  }
  const farY = wx => Math.round(172 + Math.sin(wx * 0.008) * 19 + Math.sin(wx * 0.022 + 1) * 8);
  const midY = wx => Math.round(209 + Math.sin(wx * 0.012 + 2) * 11 + Math.sin(wx * 0.034) * 4.5);
  const camF = Math.floor(cam * 0.18), camM = Math.floor(cam * 0.42);
  for (let x = 0; x < LW; x += 2) { const y = farY(x + camF); R(c, x, y, 2, LH - y, th.far); R(c, x, y, 2, 2, th.farHi); }
  if (th.deco === 'city') {
    const i0 = Math.floor(camM / 37) - 1;
    for (let i = i0; i < i0 + 16; i++) {
      const bx = i * 37 - camM, bw = 23 + Math.floor(hash(i, 4) * 13), bh = 45 + Math.floor(hash(i, 5) * 90);
      R(c, bx, 236 - bh, bw, bh + 40, th.midDark); R(c, bx, 236 - bh, 1, bh, th.midDarkHi);
      for (let r = 0; r < Math.floor(bh / 9) - 1; r++) for (let q = 0; q < Math.floor(bw / 6) - 1; q++) {
        if (hash(i * 31 + r, q) > 0.58) R(c, bx + 4 + q * 6, 236 - bh + 5 + r * 9, 2, 4, hash(i + r, q * 7) > 0.5 ? '#ffd86b' : '#6fd6ea');
      }
    }
  }
  for (let x = 0; x < LW; x += 2) { const y = midY(x + camM); R(c, x, y, 2, LH - y, th.mid); R(c, x, y, 2, 2, th.midHi); }
  if (th.deco !== 'city') {
    const i0 = Math.floor(camM / 85) - 1;
    for (let i = i0; i < i0 + 9; i++) {
      const wx = i * 85 + Math.floor(hash(i, 11) * 45), x = wx - camM, y = midY(wx) + 3;
      if (th.deco === 'lamps' && i % 2 === 0) {            // Laternen am Kanal
        c.drawImage(A.glow, x - 16, y - 69);
        R(c, x - 1, y - 48, 2, 50, th.midDark); R(c, x - 4, y - 50, 8, 2, th.midDark);
        R(c, x - 2, y - 55, 4, 4, '#fff1c2'); R(c, x - 1, y - 56, 2, 6, '#fff1c2');
      } else {
        const tr = A.trees[hash(i, 12) > 0.5 ? 0 : 1];
        c.drawImage(tr, x - (tr.width >> 1), y - tr.height + 2);
      }
    }
  }
}

function drawTiles(c, lvl, cam) {
  const th = lvl.theme, T = assets(th).tiles, W = lvl.W, A = lvl.arena;
  const RT = A ? (rinkTiles || (rinkTiles = buildTiles(RINK))) : null;
  const x0 = Math.max(0, Math.floor(cam / TPX) - 1), x1 = Math.min(W - 1, Math.floor((cam + LW) / TPX) + 1);
  for (let ty = 0; ty < lvl.H; ty++) for (let tx = x0; tx <= x1; tx++) {
    const t = lvl.tiles[ty * W + tx];
    if (!t) continue;
    const x = tx * TPX - cam, y = ty * TPX;
    if (t === GROUND) {
      const rink = A && tx >= A.x0 && tx < A.x1, S = rink ? RT : T, dark = rink ? RINK.dark : th.dark;   // in der Halle: Beton
      const isTop = ty === 0 || lvl.tiles[(ty - 1) * W + tx] !== GROUND, v = Math.floor(hash(tx, ty) * 4);
      c.drawImage(isTop ? S.top[v] : S.body[v], x, y);
      const y0 = isTop ? 4 : 0;
      if (tx > 0 && lvl.tiles[ty * W + tx - 1] !== GROUND) { R(c, x, y, 1, 15, INK); R(c, x + 1, y + y0, 1, 15 - y0, dark); }
      if (tx < W - 1 && lvl.tiles[ty * W + tx + 1] !== GROUND) { R(c, x + 14, y, 1, 15, INK); R(c, x + 13, y + y0, 1, 15 - y0, dark); }
    } else if (t === BLOCK) c.drawImage(T.block, x, y);
    else c.drawImage(T.plat, x, y);
  }
}

// ───────────────────────── Vereinswappen ─────────────────────────
const LOGO = { img: null, ready: false, cache: new Map() };
function loadLogo() {
  if (typeof Image === 'undefined') return;
  const img = new Image();
  img.onload = () => { LOGO.ready = img.naturalWidth > 0; LOGO.cache.clear(); };
  img.src = 'logo.png';
  LOGO.img = img;
}
// Das Wappen wird stufenweise halbiert – so bleibt es auch im kleinen Pixelbild sauber
function logoSprite(size) {
  if (!LOGO.ready) return null;
  let cv = LOGO.cache.get(size);
  if (cv) return cv;
  let src = LOGO.img, w = src.naturalWidth, h = src.naturalHeight;
  const th = Math.max(1, Math.round(size * h / w));
  do {
    const last = w / 2 < size, nw = last ? size : Math.ceil(w / 2), nh = last ? th : Math.ceil(h / 2);
    cv = makeCanvas(nw, nh);
    const c = cv.getContext('2d');
    c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    c.drawImage(src, 0, 0, nw, nh);
    src = cv; w = nw; h = nh;
  } while (w > size);
  LOGO.cache.set(size, cv);
  return cv;
}
function drawLogo(c, x, y, size) {
  const cv = logoSprite(size);
  if (cv) { c.drawImage(cv, x, y); return; }
  // Ersatz, solange logo.png noch lädt oder fehlt
  const band = Math.round(size * 0.3);
  R(c, x + 3, y + 3, size - 6, size - 12, INK); R(c, x + 4, y + 4, size - 8, size - 14, '#ffffff'); R(c, x + 4, y + 4, size - 8, band, '#c8102e');
  drawText(c, 'KREC', x + size / 2, y + 4 + (band - 7 >> 1), { col: '#ffffff', outline: null, align: 'center' });
  drawText(c, '1953', x + size / 2, y + band + 12, { col: INK, outline: null, align: 'center' });
}

// ───────────────────────── Rollsportanlage am Tannenhof ─────────────────────────
// Das Ziel der letzten Kür: die teiloffene Halle des KREC – Bogendach auf Stahlstützen, bunte Rückwand,
// braune Bande, Anzeigetafel und heller Betonboden mit roter Mittellinie. Maße in Bildpixeln.
const HALL = { wall: 86, eave: 128, rise: 24, bay: 120, over: 12, board: 11 };
const HALL_COLS = ['#e6d274', '#86a8dc', '#e8ab94', '#b3cbea'];
const HALL_SEATS = [[14, 106], [130, 232], [245, 261], [339, 352], [370, 430]];   // orange Tribünen (x von … bis), je drei Reihen
const JUDGES = [[516, '#2f3a6c', '#6f3520'], [544, '#7a2a4a', '#e9e2d0'], [572, '#35505a', '#431d13']];   // x, Jacke, Haar
const CROWD = ['#ff3f86', '#19c7b5', '#ffd23f', '#7446d8', '#ffffff', '#ff7a1a', '#3aa4e8'];
const RINK = Object.assign({}, THEMES.nacht, { top: '#d9dce6', topHi: '#f6f7fb', topSh: '#a3a8bd', body: '#6d728c', dark: '#565b76', light: '#878ca6' });
let rinkTiles = null;

function buildArena(a) {
  const w = wpx(a.w), o = HALL.over, H = HALL.eave + HALL.rise + 10;
  const cv = makeCanvas(w + o * 2, H), c = cv.getContext('2d');
  const roofY = x => { const k = (x + o) / (w + 2 * o); return H - HALL.eave - Math.round(HALL.rise * 4 * k * (1 - k)); };
  const wt = H - HALL.wall, bt = H - HALL.board, half = HALL.wall / 2;
  c.translate(o, 0);

  // Rückwand: bunte Felder aus Betonsteinen
  for (let x = 0, i = 0; x < w; x += 60, i++) {
    const pw = Math.min(60, w - x);
    R(c, x, wt, pw, half, HALL_COLS[i % 4]); R(c, x, wt + half, pw, half, HALL_COLS[(i + 2) % 4]);
  }
  c.globalAlpha = 0.1; c.fillStyle = INK;
  for (let y = wt + 8, r = 0; y < bt; y += 8, r++) { c.fillRect(0, y, w, 1); for (let x = (r % 2) * 8; x < w; x += 16) c.fillRect(x, y - 7, 1, 7); }
  c.globalAlpha = 1;
  R(c, 0, wt - 1, w, 1, INK); R(c, 0, wt, w, 2, '#f4f1e6');

  // Schilder, Wappen, Anzeigetafel
  const board = (cx, y, bw, bh, col) => { R(c, cx - bw / 2 - 1, y - 1, bw + 2, bh + 2, INK); R(c, cx - bw / 2, y, bw, bh, col); };
  board(180, wt + 5, 102, 28, '#fffaf0');
  drawText(c, 'Rollsportanlage', 180, wt + 9, { col: INK, outline: null, align: 'center' });
  drawText(c, 'am Tannenhof', 180, wt + 21, { col: '#c8102e', outline: null, align: 'center' });
  board(544, wt + 5, 96, 15, '#fffaf0');
  drawText(c, 'KREC · seit 1953', 544, wt + 9, { col: '#c8102e', outline: null, align: 'center' });
  board(300, wt + 5, 70, 68, '#221a44');
  drawLogo(c, 268, wt + 7, 64);
  board(420, wt + 8, 66, 36, '#1a1420');
  drawText(c, 'Heim', 392, wt + 11, { col: '#9aa2b8', outline: null });
  drawText(c, 'Gast', 448, wt + 11, { col: '#9aa2b8', outline: null, align: 'right' });

  // Sitze, davor die Bande
  for (let r = 2; r >= 0; r--) for (const [s0, s1] of HALL_SEATS) for (let x = s0 + r * 3; x < s1; x += 7) { const y = bt - 7 - r * 8; R(c, x, y, 5, 7, '#f08a24'); R(c, x, y, 5, 1, '#ffb866'); }
  R(c, 0, bt - 1, w, 1, INK); R(c, 0, bt, w, HALL.board, '#5b3626'); R(c, 0, bt, w, 2, '#8a5a3a'); R(c, 0, H - 2, w, 2, '#43261a');
  for (let x = 20; x < w; x += 20) R(c, x, bt + 2, 1, HALL.board - 2, '#43261a');

  // Hallenlampen, Bogendach aus Wellplatten, Träger und Stützen
  const glow = buildGlow(13, '#fff1c2');
  for (let x = 60; x < w; x += HALL.bay) c.drawImage(glow, x - 13, roofY(x) + 5);
  for (let x = -o; x < w + o; x++) {
    const y = roofY(x);
    R(c, x, y - 1, 1, 13, INK);
    R(c, x, y, 1, 11, ((x % 3) + 3) % 3 === 0 ? '#6d7492' : '#4a506c'); R(c, x, y, 1, 2, '#8a92b0'); R(c, x, y + 8, 1, 3, '#30354e');
    if (x >= 0 && x < w) { R(c, x, y + 12, 1, 2, '#8f95ad'); R(c, x, y + 14, 1, 1, INK); }
  }
  R(c, -o - 1, roofY(-o) - 1, 1, 13, INK); R(c, w + o, roofY(w + o - 1) - 1, 1, 13, INK);
  for (let x = 0; x <= w; x += HALL.bay) {
    const px = clamp(x - 2, 0, w - 4), top = roofY(x) + 14;
    R(c, px - 1, top, 6, H - top, INK); R(c, px, top, 4, H - top, '#8f95ad'); R(c, px, top, 1, H - top, '#c9cee0'); R(c, px + 3, top, 1, H - top, '#646a84');
  }
  for (let x = 60; x < w; x += HALL.bay) { const y = roofY(x) + 15; R(c, x - 4, y - 1, 9, 4, INK); R(c, x - 3, y, 7, 2, '#fffbe6'); R(c, x - 2, y + 2, 5, 1, '#ffe08a'); }
  return cv;
}

function drawArena(c, lvl, cam) {
  const a = lvl.arena;
  if (!a) return;
  const x = wpx(a.x) - cam, w = wpx(a.w), gy = wpx(a.y);
  if (x > LW + 20 || x + w < -20) return;
  if (!a.cv || a.logo !== LOGO.ready) { a.cv = buildArena(a); a.logo = LOGO.ready; }
  c.drawImage(a.cv, x - HALL.over, gy - a.cv.height);
  // Publikum auf der Tribüne: wippt mit – und applaudiert im Abspann
  const t = G.t, cheer = G.state === 'finale' || G.state === 'clear' || G.state === 'win', bt = gy - HALL.board;
  for (let r = 2; r >= 0; r--) for (const [s0, s1] of HALL_SEATS) for (let sx = s0 + r * 3; sx < s1; sx += 7) {
    const h = hash(sx, 3 + r * 5);
    if (h < 0.3) continue;
    const up = cheer ? Math.round(Math.abs(Math.sin(t * 7 + h * 40)) * 2) : (Math.floor(t * 1.5 + h * 9) % 5 === 0 ? 1 : 0);
    const px = x + sx, base = bt - r * 8, py = base - 10 - up, skin = h > 0.7 ? '#f6bb92' : '#d99a72';
    R(c, px - 1, py - 1, 7, 11 + up, INK);
    R(c, px, py + 4, 5, 6 + up, CROWD[Math.floor(h * 97) % CROWD.length]);
    R(c, px + 1, py, 3, 4, skin); R(c, px + 1, py, 3, 1, h > 0.55 ? '#6f3520' : '#f0c64a');
    if (cheer) {                                         // Hände über dem Kopf: auseinander – zusammen
      if (Math.floor(t * 9 + h * 20) % 2) { R(c, px - 1, py - 3, 2, 3, skin); R(c, px + 4, py - 3, 2, 3, skin); }
      else R(c, px + 1, py - 4, 3, 3, skin);
    }
  }
  drawJudges(c, x, gy);
  // Die Anzeigetafel zeigt die Laufzeit
  drawText(c, fmtTime(G.time), x + 420, gy - HALL.wall + 24, { scale: 2, col: '#ff9f1a', outline: null, align: 'center' });
}
// Das Wertungsgericht sitzt am Tisch vor der Bande. Bei der Verbeugung klatscht es, danach zeigt es die Noten.
function drawJudges(c, x, gy) {
  const clear = G.state === 'clear' || G.state === 'win', T = G.state === 'clear' ? G.stateT : 99;
  const clap = G.state === 'finale' && G.fin.phase !== 'roll';
  JUDGES.forEach(([jx, coat, hair], i) => {
    const px = x + jx, up = clear ? clamp((T - 1.0 - i * 0.4) / 0.2, 0, 1) : 0;
    if (up > 0) {                                        // Wertungstafel am Stiel
      const cy = gy - 42 - Math.round(up * 11);
      R(c, px - 1, cy + 12, 2, 14, '#a8703c');
      R(c, px - 11, cy - 1, 22, 14, INK); R(c, px - 10, cy, 20, 12, '#fffaf0');
      drawText(c, fmtMark(G.marks[i]), px, cy + 3, { col: G.marks[i] >= 5.95 ? '#ff3f86' : INK, outline: null, align: 'center' });
    }
    R(c, px - 7, gy - 29, 14, 14, INK); R(c, px - 6, gy - 28, 12, 13, coat); R(c, px - 1, gy - 28, 2, 5, '#fffaf0');
    R(c, px - 4, gy - 38, 8, 10, INK); R(c, px - 3, gy - 37, 6, 8, '#f6bb92'); R(c, px - 3, gy - 37, 6, 2, hair);
    R(c, px - 2, gy - 33, 1, 1, INK); R(c, px + 1, gy - 33, 1, 1, INK);
    if (clap) { const o = Math.floor(G.t * 8 + i) % 2; R(c, px - 3 - o, gy - 22, 3, 3, '#f6bb92'); R(c, px + o, gy - 22, 3, 3, '#f6bb92'); }
  });
  const tx = x + 496, tw = 96;                           // Tisch mit Tuch
  R(c, tx - 1, gy - 17, tw + 2, 17, INK); R(c, tx, gy - 16, tw, 2, '#e6dcc8'); R(c, tx, gy - 14, tw, 14, '#fffaf0'); R(c, tx, gy - 3, tw, 3, '#c8102e');
  drawText(c, 'Wertungsgericht', tx + tw / 2, gy - 12, { col: INK, outline: null, align: 'center' });
}
// Bahnmarkierung wie auf der echten Lauffläche: rote Mittellinie, blaue Kreise
function drawArenaFloor(c, lvl, cam) {
  const a = lvl.arena;
  if (!a) return;
  const mx = wpx(a.x + a.w / 2) - cam, y = wpx(a.y);
  R(c, mx - 1, y + 1, 3, 2, '#e0383f');
  for (const d of [-200, -160, 160, 200]) R(c, mx + d, y + 1, 4, 1, '#4f86d9');
}

// ───────────────────────── Sterne, Schilder, Ziel ─────────────────────────
let SP = null;
function sprites() {
  if (SP) return SP;
  const starRows = ['.....y.....', '.....y.....', '....wyy....', '....wyy....', 'ywwwyyyyyyy', '.ywyyyyyyd.', '..yyyyyyd..', '..yyyyyyd..', '.yyyy.yydd.', '.yyy...ydd.', '.y.......d.'];
  const heartRows = ['.##.##.', '#w#####', '#######', '#######', '.#####.', '..###..', '...#...'];
  SP = {
    star: pmap(starRows, { y: '#ffd23f', w: '#fff6c4', d: '#e09a10' }),
    starBack: pmap(starRows, { y: '#e8a51c', w: '#ffd23f', d: '#b87808' }),
    heart: pmap(heartRows, { '#': '#ff3f6e', w: '#ffc2d1' }),
    heartOff: pmap(heartRows, { '#': '#5b4a7c', w: '#5b4a7c' }),
    sign: pix(16, 24, c => {
      R(c, 7, 11, 2, 13, '#7a4a2a');
      R(c, 1, 1, 14, 10, '#ffe9b0'); R(c, 1, 10, 14, 1, '#e0b872');
      GLYPHS['?'].rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (r[x] === '#') R(c, 6 + x, 2 + y, 1, 1, '#ff3f86'); });
    }),
    medal: pix(46, 66, c => {
      for (let i = 0; i < 26; i++) { R(c, 8 + Math.round(i * 0.42), i, 9, 1, '#ff3f86'); R(c, 29 - Math.round(i * 0.42), i, 9, 1, '#8ef3ff'); }
      disc(c, 23, 44, 20, '#c48c14'); disc(c, 23, 43, 19, '#ffd23f'); disc(c, 23, 43, 14, '#ffb400'); disc(c, 21, 41, 13, '#ffe680');
      ['.....y.....', '.....y.....', '....yyy....', '....yyy....', 'yyyyyyyyyyy', '.yyyyyyyyy.', '..yyyyyyy..', '..yyyyyyy..', '.yyyy.yyyy.', '.yyy...yyy.', '.y.......y.']
        .forEach((r, y) => { for (let x = 0; x < r.length; x++) if (r[x] === 'y') R(c, 12 + x * 2, 32 + y * 2, 2, 2, '#fffbe0'); });
    }),
  };
  return SP;
}

function drawDeco(c, lvl, cam) {
  const S = sprites(), t = G.t;
  for (const s of lvl.signs) { const x = wpx(s.x) - cam; if (x > -20 && x < LW + 20) c.drawImage(S.sign, x - 8, wpx(s.y) - 24); }
  // Rücksetzpunkte: Wimpel steigt am Mast hoch
  for (const f of lvl.flags) {
    const x = wpx(f.x) - cam, y = wpx(f.y);
    if (x < -30 || x > LW + 30) continue;
    R(c, x - 1, y - 42, 3, 42, INK); R(c, x, y - 41, 1, 41, '#e8e6f2'); R(c, x - 1, y - 45, 3, 3, INK); R(c, x, y - 44, 1, 1, '#ffd23f');
    const fy = y - 22 - Math.round(f.raise * 17), wave = f.on && Math.floor(t * 6) % 2 ? 1 : 0;
    for (let i = 0; i < 9; i++) {
      const w = Math.round(13 * (1 - Math.abs(i - 4) / 4.6));
      R(c, x + 2, fy + i - 1, w + 1, 3, INK);
    }
    for (let i = 0; i < 9; i++) {
      const w = Math.round(13 * (1 - Math.abs(i - 4) / 4.6));
      R(c, x + 2, fy + i + (w > 8 ? wave : 0), w, 1, f.on ? (i < 4 ? '#ff8fb8' : '#ff3f86') : (i < 4 ? '#c9c6d6' : '#a9a6b8'));
    }
  }
  // Zielbogen mit Siegertreppchen
  const g = lvl.goal;
  if (g) {
    const x = wpx(g.x) - cam, y = wpx(g.y);
    if (x > -120 && x < LW + 60) {
      for (const px of [x - 26, x + 22]) {
        R(c, px - 1, y - 74, 5, 74, INK);
        for (let i = 0; i < 10; i++) R(c, px, y - 73 + i * 7 + (i ? 0 : 0), 3, 7, i % 2 ? '#ffffff' : '#ff3f86');
      }
      R(c, x - 30, y - 82, 60, 16, INK);
      for (let i = 0; i < 8; i++) for (let j = 0; j < 2; j++) R(c, x - 28 + i * 7, y - 81 + j * 7, 7, 7, (i + j) % 2 ? '#ffffff' : '#1b1030');
      drawText(c, 'ZIEL', x, y - 94 + (Math.floor(t * 3) % 2), { col: '#ffd23f', align: 'center' });
      const px = x + 56;
      if (!lvl.arena) {                                    // Siegertreppchen – in der Halle wartet stattdessen das Wertungsgericht
        for (const [dx, h, col, sh, n] of [[-17, 12, '#cfd5e2', '#9aa2b8', '2'], [0, 19, '#ffd23f', '#c48c14', '1'], [17, 8, '#d89255', '#a0612c', '3']]) {
          R(c, px + dx - 9, y - h - 1, 18, h + 1, INK); R(c, px + dx - 8, y - h, 16, h, col); R(c, px + dx + 6, y - h, 2, h, sh);
          if (h > 9) drawText(c, n, px + dx - 1, y - h + 2, { col: INK, outline: null, align: 'center' });
        }
        c.drawImage(S.star, px - 6, y - 36 + Math.round(Math.sin(t * 2.5) * 2));
      }
    }
  }
  // Sterne drehen sich wie Münzen
  for (const s of lvl.stars) {
    if (s.got) continue;
    const x = wpx(s.x) - cam;
    if (x < -10 || x > LW + 10) continue;
    const k = Math.cos(Math.floor((t * 2.6 + s.ph) * 4) / 4 * 2), w = Math.max(3, Math.round(13 * Math.abs(k)));
    const y = wpx(s.y) + (Math.floor(t * 3 + s.ph) % 2);
    c.drawImage(k >= 0 ? S.star : S.starBack, 0, 0, 13, 13, x - (w >> 1), y - 6, w, 13);
  }
  for (const h of lvl.hearts) {
    if (h.got) continue;
    const x = wpx(h.x) - cam, big = Math.floor(t * 4) % 2;
    c.drawImage(S.heart, 0, 0, 9, 9, x - 4 - big, wpx(h.y) - 4 - big + Math.round(Math.sin(t * 2.5) * 1.5), 9 + big * 2, 9 + big * 2);
  }
}

function drawSignBubbles(c, lvl, cam) {
  const p = G.p;
  if (!p || G.state !== 'play') return;
  for (const s of lvl.signs) {
    if (Math.abs(s.x - (p.x + p.w / 2)) > 100) continue;
    const str = s.text.toUpperCase(), w = textW(str) + 12, sx = wpx(s.x) - cam;
    const x = clamp(sx - (w >> 1), 4, LW - w - 4), y = wpx(s.y) - 52;
    R(c, x - 1, y, w + 2, 15, INK); R(c, x, y - 1, w, 17, INK);
    R(c, x, y, w, 15, '#fffaf0'); R(c, x, y + 13, w, 2, '#e6dcc8');
    for (let i = 0; i < 4; i++) { R(c, sx - 4 + i, y + 16 + i, 9 - i * 2, 1, INK); if (i < 3) R(c, sx - 3 + i, y + 15 + i, 7 - i * 2, 1, i ? '#e6dcc8' : '#e6dcc8'); }
    drawText(c, str, x + 6, y + 4, { col: INK, outline: null });
  }
}

function drawWorld(c) {
  const lvl = G.lvl;
  let cam = Math.floor(G.cam / PXS), oy = 0;
  drawBackground(c, lvl.theme, G.cam, G.t);
  if (G.shake > 0) { cam += Math.round((Math.random() - 0.5) * G.shake * 14); oy = Math.round((Math.random() - 0.5) * G.shake * 14); }
  c.save(); c.translate(0, oy);
  drawArena(c, lvl, cam);
  drawTiles(c, lvl, cam);
  drawArenaFloor(c, lvl, cam);
  drawDeco(c, lvl, cam);
  for (const e of G.enemies) drawEnemy(c, e, cam);
  drawPlayer(c, cam);
  for (const q of G.particles) {
    const k = q.life / q.max, x = wpx(q.x) - cam, y = wpx(q.y);
    if (q.kind === 'spark') {
      R(c, x, y, 1, 1, q.col);
      if (k < 0.6) { R(c, x - 1, y, 3, 1, q.col); R(c, x, y - 1, 1, 3, q.col); }
      if (k < 0.25 && q.size > 4.5) { R(c, x - 2, y, 5, 1, q.col); R(c, x, y - 2, 1, 5, q.col); }
    } else if (k < 0.5) R(c, x, y, 2, 2, q.col); else R(c, x, y, 1, 1, q.col);
  }
  for (const q of G.popups) {
    if (q.t > 0.85 && Math.floor(q.t * 30) % 2) continue;
    const str = q.text.toUpperCase(), half = (textW(str) >> 1) + 4;
    drawText(c, str, clamp(wpx(q.x) - cam, half, LW - half), wpx(q.y), { col: q.col, align: 'center' });
  }
  drawSignBubbles(c, lvl, cam);
  c.restore();
}

// ───────────────────────── Anzeige und Menüs ─────────────────────────
const fmtTime = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const fmtMark = m => m.toFixed(1).replace('.', ',');
const GOLD = ['#fff6c4', '#fff6c4', '#ffe066', '#ffd23f', '#ffb400', '#f08c00', '#d96a00'];
const PINK = ['#ffd6e6', '#ffd6e6', '#ff8fb8', '#ff5c98', '#ff3f86', '#d81f66', '#a8104a'];
const blinkOn = () => Math.floor(G.t * 2.5) % 2 === 0;

function drawHud(c) {
  const p = G.p, lvl = G.lvl, S = sprites();
  for (let i = 0; i < MAX_HEARTS; i++) c.drawImage(i < G.hearts ? S.heart : S.heartOff, 6 + i * 11, 5);
  c.drawImage(S.star, 43, 3);
  drawText(c, `${G.starsGot}/${lvl.stars.length}`, 59, 6);
  // Schwung für die Pirouette
  let m = 1;
  if (p.spinning) m = 1 - p.spinT / SPIN_MAX; else if (p.spinCd > 0) m = 1 - p.spinCd / SPIN_CD;
  R(c, 6, 18, 42, 7, INK);
  const col = p.spinning ? '#8ef3ff' : m < 1 ? '#7a86a8' : '#19c7b5';
  for (let i = 0; i < 8; i++) R(c, 7 + i * 5, 19, 4, 5, i < Math.ceil(m * 8 - 0.01) ? col : '#3d2a5c');
  drawText(c, 'Pirouette', 52, 18);
  drawText(c, String(G.score).padStart(6, '0'), LW - 6, 5, { scale: 2, align: 'right' });
  drawText(c, fmtTime(G.time), LW - 6, 24, { col: '#ffe9b0', align: 'right' });

  if (G.state === 'play' && G.stateT < 2.6 && G.stateT > 0.5 && (G.stateT < 2.2 || Math.floor(G.stateT * 20) % 2)) {
    drawText(c, `Kür ${G.levelIdx + 1}`, LW / 2, 70, { col: '#ffd23f', align: 'center' });
    drawText(c, lvl.name, LW / 2, 84, { scale: 2, align: 'center' });
  }
  if (G.toastT > 0) drawText(c, G.toast, LW / 2, LH - 16, { col: '#8ef3ff', align: 'center' });
}

function dim(c, a) { c.globalAlpha = a; R(c, 0, 0, LW, LH, '#160c2c'); c.globalAlpha = 1; }

// Eine Zeile mit Tasten ['k', '←'] und Beschriftungen ['t', 'Rollen'], mittig gesetzt
function legendRow(c, y, items) {
  const ws = items.map(([kind, s]) => textW(s.toUpperCase()) + (kind === 'k' ? 6 : 0));
  let x = Math.round((LW - ws.reduce((a, w, i) => a + w + (items[i][0] === 'k' ? 3 : 12), -12)) / 2);
  items.forEach(([kind, s], i) => {
    if (kind === 'k') {
      R(c, x, y - 2, ws[i], 12, INK); R(c, x + 1, y - 1, ws[i] - 2, 9, '#fffaf0'); R(c, x + 1, y + 7, ws[i] - 2, 1, '#cfc4ae');
      drawText(c, s, x + 3, y, { col: INK, outline: null });
    } else drawText(c, s, x, y);
    x += ws[i] + (kind === 'k' ? 3 : 12);
  });
}

function drawTitle(c) {
  dim(c, 0.5);
  const t = G.t, title = 'KREC JUMPER';
  let x = Math.round((LW - textW(title, 5)) / 2);
  for (let i = 0; i < title.length; i++) {
    const ch = title[i], w = textW(ch, 5);
    if (ch !== ' ') drawText(c, ch, x, 14 + Math.round(Math.sin(t * 2.4 + i * 0.55) * 2), { scale: 5, col: '#ffd23f', grad: i < 4 ? GOLD : PINK });
    x += w + 5;
  }
  drawText(c, 'Die große Rollkunstlauf-Kür', LW / 2, 57, { align: 'center' });
  for (const lx of [94, LW - 94]) {                      // Vereinswappen links und rechts der Vorführung
    drawLogo(c, lx - 32, 84, 64);
    drawText(c, 'Konstanzer Roll-', lx, 152, { align: 'center' });
    drawText(c, 'und Eissportclub', lx, 162, { align: 'center' });
  }

  // Vorführung: rollen – Rittberger – Axel – Sitzpirouette
  const ph = t % 8, cx = LW / 2, gy = 162, o = { t, stride: t * 8, lean: 0.8 };
  let label, P, yaw = 0, h = 0, tail = [-1.1, -0.5, 0];
  if (ph < 2.4) { P = skaterPose('skate', o); label = 'Rollen'; }
  else if (ph < 3.6) {
    const k = (ph - 2.4) / 1.2;
    h = Math.round(Math.sin(k * Math.PI) * 5);
    P = mixPose(skaterPose('air', o), skaterPose('open', o), clamp((k - 0.75) * 4, 0, 1));
    yaw = smooth(k) * TAU * 2; tail = [-1, 0.2, 0]; label = 'Rittberger';
  } else if (ph < 5.2) {
    const k = (ph - 3.6) / 1.6;
    h = Math.round(Math.sin(k * Math.PI) * 6);
    P = mixPose(skaterPose('axel', o), skaterPose('open', o), clamp((k - 0.8) * 5, 0, 1));
    if (k < 0.16) P = mixPose(skaterPose('axelKick', o), P, smooth(k / 0.16));
    yaw = smooth(k) * TAU * 3; tail = [-1, 0.3, 0]; label = 'Axel';
  } else {
    const k = ph - 5.2;
    P = mixPose(skaterPose('idle', o), skaterPose('sit', o), smooth(Math.min(k * 6, (2.8 - k) * 6)));
    yaw = k * 13; tail = [-1, 0, 0]; label = 'Sitzpirouette';
  }
  c.globalAlpha = 0.35; R(c, cx - 30, gy - 1, 60, 3, INK); R(c, cx - 24, gy + 2, 48, 2, INK); c.globalAlpha = 1;
  c.drawImage(renderSkater(P, yaw, 0, false, tail, 0.8), 0, 0, 48, 48, cx - 72, gy - 120 - h * 3, 144, 144);
  drawText(c, label, cx, gy + 10, { col: '#8ef3ff', align: 'center' });

  if (blinkOn()) drawText(c, isTouch ? 'Tippen zum Start' : 'Enter drücken zum Start', cx, 190, { col: '#ffd23f', align: 'center', scale: 2 });
  if (isTouch) {
    legendRow(c, 212, [['k', '← →'], ['t', 'Rollen'], ['k', 'A'], ['t', 'Rittberger – auf Gegner springen']]);
    legendRow(c, 227, [['k', 'A'], ['t', 'nochmal in der Luft: Axel – trifft Tauben auch seitlich']]);
    legendRow(c, 242, [['k', 'B'], ['t', 'Sitzpirouette – Gegner wegdrehen']]);
  } else {
    legendRow(c, 212, [['k', '←'], ['k', '→'], ['t', 'Rollen'], ['k', 'Leertaste'], ['t', 'Rittberger – auf Gegner springen']]);
    legendRow(c, 227, [['k', 'Leertaste'], ['t', 'nochmal in der Luft: Axel – trifft Tauben auch seitlich']]);
    legendRow(c, 242, [['k', '↓'], ['t', 'Sitzpirouette – Gegner wegdrehen'], ['k', 'P'], ['t', 'Pause'], ['k', 'M'], ['t', 'Ton'], ['k', 'R'], ['t', 'Neustart']]);
  }
  drawText(c, 'Gamepad: Steuerkreuz · A Sprung/Axel · B Pirouette · Start Pause', cx, 257, { col: '#c9b6f0', align: 'center' });
  if (G.best > 0) drawText(c, `Bestleistung ${G.best}`, LW - 6, 4, { col: '#ffe9b0', align: 'right' });
}

function drawClear(c) {
  const T = G.stateT, lvl = G.lvl;
  if (T < 0.7) return;
  const hall = !!lvl.arena, y0 = hall ? 234 : 160;         // in der Halle bleibt die Szene frei, die Zahlen stehen unten
  dim(c, clamp(Math.floor((T - 0.7) / 0.1) * 0.12, 0, hall ? 0.24 : 0.48));
  drawText(c, 'Kür gelungen!', LW / 2, 20, { scale: 3, align: 'center', grad: GOLD });
  drawText(c, lvl.name, LW / 2, 50, { align: 'center' });
  for (let i = 0; i < 3; i++) {
    const k = clamp((T - 1.0 - i * 0.4) / 0.2, 0, 1);
    if (k <= 0) continue;
    const x = LW / 2 + (i - 1) * 74, y = 68 + Math.round((1 - k) * 30), best = G.marks[i] >= 5.95;
    R(c, x - 2, y + 40, 4, 40, INK); R(c, x - 1, y + 40, 2, 40, '#a8703c');
    R(c, x - 28, y - 1, 56, 44, INK); R(c, x - 29, y, 58, 42, INK);
    R(c, x - 27, y + 1, 54, 40, '#fffaf0'); R(c, x - 27, y + 38, 54, 3, '#e0d6c0');
    drawText(c, fmtMark(G.marks[i]), x, y + 10, { scale: 3, col: best ? '#ff3f86' : INK, outline: null, align: 'center' });
  }
  if (T > 2.2) {
    c.globalAlpha = hall ? 0.7 : 0.55; R(c, 0, y0 - 7, LW, hall ? 43 : 59, '#160c2c'); c.globalAlpha = 1;
    if (hall) {
      drawText(c, `★ ${G.starsGot}/${lvl.stars.length}   Zeit ${fmtTime(G.time)}   ♥ ${G.hearts}`, LW / 2 - 8, y0 - 3, { align: 'right' });
      drawText(c, `Bonus +${G.bonus}   Punkte ${G.score}`, LW / 2 + 8, y0 - 3, { col: '#ffd23f' });
    } else {
      drawText(c, `★ ${G.starsGot}/${lvl.stars.length}     Zeit ${fmtTime(G.time)}     ♥ ${G.hearts}`, LW / 2, y0, { align: 'center' });
      drawText(c, `Bonus +${G.bonus}     Punkte ${G.score}`, LW / 2, y0 + 14, { col: '#ffd23f', align: 'center' });
    }
    if (blinkOn()) drawText(c, G.levelIdx + 1 >= LEVEL_DEFS.length ? 'Weiter zur Siegerehrung' : 'Weiter zur nächsten Kür', LW / 2, hall ? y0 + 12 : y0 + 34, { align: 'center', scale: 2 });
  }
}

function drawWin(c) {
  dim(c, 0.66);
  const t = G.t, S = sprites();
  c.drawImage(S.medal, LW / 2 - 23, 14 + Math.round(Math.sin(t * 2) * 2));
  drawText(c, 'Goldmedaille!', LW / 2, 92, { scale: 4, align: 'center', grad: GOLD });
  drawText(c, 'Du hast alle Küren gemeistert.', LW / 2, 132, { align: 'center' });
  drawText(c, `Punkte ${G.score}`, LW / 2, 150, { scale: 2, align: 'center' });
  drawText(c, G.score >= G.best ? 'Neue Bestleistung!' : `Bestleistung ${G.best}`, LW / 2, 172, { col: '#8ef3ff', align: 'center' });
  for (const s of [-1, 1]) {
    const cv = renderSkater(skaterPose('win', { t: t + s }), s > 0 ? -Math.PI + 0.9 : -0.9, 0, false, [-0.6, -0.8, 0], 0);
    c.drawImage(cv, 0, 0, 48, 48, LW / 2 + s * 150 - 60, 120, 120, 120);
  }
  if (G.stateT > 1 && blinkOn()) drawText(c, 'Zurück zum Start', LW / 2, 232, { align: 'center', scale: 2 });
}

// Würfel-Blende beim Levelstart
function drawWipe(c) {
  if (G.wipe <= 0) return;
  const k = G.wipe / 0.6;
  c.fillStyle = INK;
  for (let gy = 0; gy < 9; gy++) for (let gx = 0; gx < 16; gx++) {
    const s = Math.round(30 * clamp(k * 2.2 - (gx + gy) / 24 * 1.2, 0, 1));
    if (s > 0) c.fillRect(gx * 30 + 15 - (s >> 1), gy * 30 + 15 - (s >> 1), s, s);
  }
}

// Zeichnet die Welt – beim Tanz nach dem Ziel als vergrößerten Ausschnitt rund um die Läuferin
let zoomCv = null;
function drawScene(c) {
  const z = G.zoom, p = G.p;
  if (z <= 1.001 || !p) { drawWorld(c); return; }
  const cv = zoomCv || (zoomCv = makeCanvas(LW, LH)), wc = cv.getContext('2d');
  wc.imageSmoothingEnabled = false;
  drawWorld(wc);
  const w = LW / z, h = LH / z;
  const fx = wpx(p.x + p.w / 2) - Math.floor(G.cam / PXS) + G.zoomDx, fy = wpx(G.zoomY);
  c.drawImage(cv, Math.round(clamp(fx - w / 2, 0, LW - w)), Math.round(clamp(fy - h * 0.74, 0, LH - h)), w, h, 0, 0, LW, LH);
}

function render(c) {
  c.imageSmoothingEnabled = false;
  drawScene(c);
  switch (G.state) {
    case 'title': drawTitle(c); break;
    case 'play': drawHud(c); break;
    case 'pause':
      drawHud(c); dim(c, 0.6);
      drawText(c, 'Pause', LW / 2, 96, { scale: 5, align: 'center', grad: GOLD });
      drawText(c, isTouch ? 'Tippen – weiter' : 'P oder Enter – weiter      R – Kür neu starten', LW / 2, 148, { col: '#ffe9b0', align: 'center' });
      break;
    case 'over':
      drawHud(c); dim(c, clamp(Math.floor(G.stateT / 0.15) * 0.12, 0, 0.6));
      drawText(c, 'Gestürzt!', LW / 2, 90, { scale: 5, align: 'center', grad: PINK });
      drawText(c, 'Kopf hoch, Krönchen richten, weiterlaufen.', LW / 2, 140, { align: 'center' });
      if (G.stateT > 0.9 && blinkOn()) drawText(c, 'Nochmal versuchen', LW / 2, 164, { col: '#ffd23f', align: 'center', scale: 2 });
      break;
    case 'finale':                                         // beim Tanz statt der Anzeige nur der Name der Figur
      if (G.fin.phase === 'roll') drawHud(c);
      else drawText(c, G.fin.phase === 'bow' ? 'Verbeugung' : danceMove(G.fin.t, {}).name, LW / 2, LH - 26, { scale: 2, col: '#8ef3ff', align: 'center' });
      break;
    case 'clear': drawHud(c); drawClear(c); break;
    case 'win': drawWin(c); break;
    default: break;
  }
  drawWipe(c);
  if (muted) drawText(c, 'Ton aus', 6, LH - 10);
}

// ───────────────────────── Eingabe: Tastatur, Touch, Gamepad ─────────────────────────
const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  Space: 'jump', ArrowUp: 'jump', KeyW: 'jump',
  ArrowDown: 'spin', KeyS: 'spin', KeyX: 'spin', ShiftLeft: 'spin', ShiftRight: 'spin',
};
let isTouch = false;
function press(k) {
  if (k === 'jump') {
    if (G.state !== 'play') { confirm(); input.jump = true; return; }
    if (!input.jump) input.jumpPressed = true;
  }
  input[k] = true;
}
function release(k) { input[k] = false; }
// Jede Quelle (0 Tastatur, 1 Touch, 2 Gamepad) hält ihre Tasten getrennt, damit sie sich nicht gegenseitig loslassen
const held = { left: 0, right: 0, jump: 0, spin: 0 };
function setKey(src, k, on) {
  const before = held[k];
  held[k] = on ? before | (1 << src) : before & ~(1 << src);
  if (!before && held[k]) press(k); else if (before && !held[k]) release(k);
}
function clearSource(src) { for (const k of Object.keys(held)) setKey(src, k, false); }
function restartLevel() {
  if (G.state === 'play' || G.state === 'pause') { G.score = G.scoreAtStart; startLevel(G.levelIdx); }
}

// Gamepad: Steuerkreuz/Stick = rollen, A/Y = Sprung (in der Luft: Axel), B/X/Schultertasten/unten = Pirouette, Start = Pause
const pad = { start: false, select: false, any: false };
function pollGamepads() {
  if (typeof navigator === 'undefined' || !navigator.getGamepads) return;
  let l = false, r = false, j = false, s = false, start = false, select = false, any = false;
  for (const gp of navigator.getGamepads()) {
    if (!gp || !gp.connected) continue;
    const b = i => !!(gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.5));
    const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
    any = true;
    l = l || b(14) || ax < -0.4; r = r || b(15) || ax > 0.4;
    j = j || b(0) || b(3);
    s = s || b(1) || b(2) || b(4) || b(5) || b(6) || b(7) || b(13) || ay > 0.65;
    start = start || b(9); select = select || b(8);
  }
  if (!any) { if (pad.any) clearSource(2); pad.any = false; return; }
  if (!pad.any) { G.toast = 'Gamepad verbunden'; G.toastT = 3; }
  pad.any = true;
  if (l || r || j || s || start) audioInit();
  setKey(2, 'left', l); setKey(2, 'right', r); setKey(2, 'jump', j); setKey(2, 'spin', s);
  if (start && !pad.start) { if (G.state === 'play' || G.state === 'pause') togglePause(); else confirm(); }
  if (select && !pad.select) restartLevel();
  pad.start = start; pad.select = select;
}

function boot() {
  const canvas = document.getElementById('game'), screen = document.getElementById('screen');
  const ctx = canvas.getContext('2d');
  canvas.width = LW; canvas.height = LH;

  const setTouch = () => { if (!isTouch) { isTouch = true; document.body.classList.add('touch'); resize(); } };
  function resize() {
    const dpr = window.devicePixelRatio || 1, portrait = window.innerHeight > window.innerWidth;
    const availH = isTouch && portrait ? window.innerHeight * 0.52 : window.innerHeight;
    const fit = Math.min(window.innerWidth / LW, availH / LH) * dpr;       // Geräte-Pixel pro Spielpixel
    const whole = Math.floor(fit);
    const s = (whole >= 1 && whole / fit >= 0.86 ? whole : fit) / dpr;      // möglichst ganzzahlig = gleichmäßige Pixel
    canvas.style.width = Math.round(LW * s) + 'px'; canvas.style.height = Math.round(LH * s) + 'px';
    if (screen) {
      screen.classList.toggle('scan', Number.isInteger(s) && s >= 3);
      screen.style.setProperty('--px', s + 'px');
    }
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);
  if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) setTouch();
  window.addEventListener('touchstart', setTouch, { passive: true });
  resize();

  window.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = KEYMAP[e.code];
    if (k || e.code === 'Enter') e.preventDefault();
    if (e.repeat) return;
    audioInit();
    if (k) setKey(0, k, true);
    else if (e.code === 'Enter' || e.code === 'NumpadEnter') confirm();
    else if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
    else if (e.code === 'KeyM') toggleMute();
    else if (e.code === 'KeyR') restartLevel();
  });
  window.addEventListener('keyup', e => { const k = KEYMAP[e.code]; if (k) setKey(0, k, false); });
  window.addEventListener('blur', () => {
    clearSource(0); clearSource(1);
    document.querySelectorAll('#touch .on').forEach(b => b.classList.remove('on'));
    if (G.state === 'play') setState('pause');
  });
  window.addEventListener('gamepaddisconnected', () => { G.toast = 'Gamepad getrennt'; G.toastT = 3; });

  canvas.addEventListener('pointerdown', e => { e.preventDefault(); audioInit(); if (G.state !== 'play') confirm(); });

  // Touch: Der Daumen darf zwischen den Knöpfen eines Feldes gleiten, ohne abzusetzen
  const fingers = new Map();                             // pointerId → gedrückter Knopf
  const touchBtn = e => { const el = document.elementFromPoint(e.clientX, e.clientY); return el && el.closest ? el.closest('#touch [data-k]') : null; };
  const refreshTouch = () => {
    const down = new Set([...fingers.values()].filter(Boolean));
    document.querySelectorAll('#touch [data-k]').forEach(b => { b.classList.toggle('on', down.has(b)); });
    for (const k of Object.keys(held)) setKey(1, k, [...down].some(b => b.dataset.k === k));
  };
  document.querySelectorAll('#touch .pad').forEach(padEl => {
    const move = e => { if (!fingers.has(e.pointerId)) return; e.preventDefault(); const b = touchBtn(e); if (fingers.get(e.pointerId) !== b) { fingers.set(e.pointerId, b); refreshTouch(); } };
    const up = e => { if (fingers.delete(e.pointerId)) refreshTouch(); };
    padEl.addEventListener('pointerdown', e => {
      e.preventDefault(); setTouch(); audioInit();
      try { padEl.setPointerCapture(e.pointerId); } catch (err) { /* egal */ }
      fingers.set(e.pointerId, touchBtn(e)); refreshTouch();
    });
    padEl.addEventListener('pointermove', move);
    padEl.addEventListener('pointerup', up);
    padEl.addEventListener('pointercancel', up);
    padEl.addEventListener('contextmenu', e => e.preventDefault());
  });
  const pauseBtn = document.getElementById('pauseBtn');
  if (pauseBtn) pauseBtn.addEventListener('pointerdown', e => { e.preventDefault(); if (G.state === 'play' || G.state === 'pause') togglePause(); else confirm(); });
  const muteBtn = document.getElementById('muteBtn');
  if (muteBtn) muteBtn.addEventListener('pointerdown', e => { e.preventDefault(); audioInit(); toggleMute(); });
  const fsBtn = document.getElementById('fsBtn'), root = document.documentElement;
  if (fsBtn) {
    if (!root.requestFullscreen) fsBtn.style.display = 'none';
    fsBtn.addEventListener('pointerdown', e => {
      e.preventDefault();
      if (document.fullscreenElement) document.exitFullscreen();
      else root.requestFullscreen().then(() => { if (window.screen.orientation && window.screen.orientation.lock) window.screen.orientation.lock('landscape').catch(() => {}); }).catch(() => {});
    });
  }

  loadBest();
  loadMuted();
  loadLogo();
  showTitle();

  let last = performance.now(), acc = 0;
  function frame(now) {
    acc += Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    pollGamepads();
    while (acc >= STEP) { update(STEP); acc -= STEP; }
    musicTick();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    render(ctx);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// Für Tests und zum Basteln in der Konsole
globalThis.KJ = {
  G, input, LEVEL_DEFS, buildLevel, makePlayer, stepPlayer, tileAt, update, render, startLevel, showTitle, confirm, setKey,
  SONG_SRC, buildSong, textW, music: MUS, clap: CLAP, DANCE_T, BOW_T,
  consts: { TILE, ROWS, VIEW_W, VIEW_H, PW, PH, MAX_RUN, STEP, GROUND, BLOCK, PLAT, EMPTY },
};

if (typeof document !== 'undefined') boot();
})();
