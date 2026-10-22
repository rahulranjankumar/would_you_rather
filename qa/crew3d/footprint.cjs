// Lists every line that differs from the v29 backups (pages + arena.js) and checks new assets for personal names.
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..'), B = path.join(ROOT, 'qa', 'backup-v29');
const out = [];
const pairs = ['404', 'join', 'landing', 'play', 'report', 'screen'].map(n => ['public/' + n + '.html', 'public/' + n + '.html']).concat([['assets/arena.js', 'assets/arena.js']]);
for (const [cur, bak] of pairs) {
  const a = fs.readFileSync(path.join(B, bak), 'utf8').split(/\r?\n/), b = fs.readFileSync(path.join(ROOT, cur), 'utf8').split(/\r?\n/);
  const diffs = []; const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) diffs.push((i + 1) + ': ' + String(b[i]).slice(0, 160));
  out.push(cur + ' -> ' + diffs.length + ' changed line(s)' + (a.length !== b.length ? ' (line count ' + a.length + ' -> ' + b.length + ')' : ''));
  diffs.slice(0, 6).forEach(d => out.push('    ' + d));
}
// crew.js: count changed regions vs backup
{ const a = fs.readFileSync(path.join(B, 'assets/crew.js'), 'utf8'), b = fs.readFileSync(path.join(ROOT, 'assets/crew.js'), 'utf8');
  out.push('assets/crew.js: ' + a.length + ' -> ' + b.length + ' chars; starts identical for ' + (() => { let i = 0; while (i < a.length && a[i] === b[i]) i++; return i; })() + ' chars'); }
const bad = /rahul|ranjan|kumar/i;
for (const f of ['assets/crew.js', 'assets/crew3d.js', 'assets/vendor/three.r129.min.js', 'README.md', 'CHANGELOG.md']) {
  const p = path.join(ROOT, f); if (!fs.existsSync(p)) continue; const s = fs.readFileSync(p, 'utf8');
  out.push('names check ' + f + ': ' + (bad.test(s) ? 'FOUND' : 'clean'));
}
const stick = fs.readdirSync(path.join(ROOT, 'assets', 'crew')).filter(f => /^(astro|jelly|muse)-.*\.webp$/.test(f));
out.push('new stickers: ' + stick.length + ', total webp: ' + fs.readdirSync(path.join(ROOT, 'assets', 'crew')).filter(f => f.endsWith('.webp')).length);
fs.writeFileSync(path.join(__dirname, 'footprint.log'), out.join('\n') + '\n');
