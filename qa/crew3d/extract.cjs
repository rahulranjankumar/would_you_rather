/* One-off helper: split the crew lab HTML into its script parts and compare the
   embedded v29 files with the ones in /assets. Output goes to qa/crew3d/src/. */
'use strict';
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..', '..');
const html = fs.readFileSync(path.join(root, 'public', 'crew-v29-moves-4crew 1.html'), 'utf8').replace(/\r\n/g, '\n');
const re = /<script>\/\* (lib\/three\.min\.js|js\/[a-z0-9]+\.js) \*\/\n?([\s\S]*?)<\/script>/g;
const out = {};
let m;
while ((m = re.exec(html))) out[m[1]] = m[2];
const dir = path.join(__dirname, 'src');
fs.mkdirSync(dir, { recursive: true });
for (const k in out) { fs.writeFileSync(path.join(dir, k.replace(/\//g, '_')), out[k]); console.log(k.padEnd(20), out[k].length); }
for (const [k, f] of [['js/crew.js', 'crew.js'], ['js/toy3d.js', 'toy3d.js'], ['js/sfx.js', 'sfx.js']]) {
  const a = fs.readFileSync(path.join(root, 'assets', f), 'utf8').replace(/\r\n/g, '\n').trim();
  const b = (out[k] || '').trim();
  if (a === b) { console.log(f, 'IDENTICAL'); continue; }
  let i = 0; while (i < a.length && a[i] === b[i]) i++;
  console.log(f, 'DIFFERENT', a.length, b.length, 'first diff at', i);
  console.log('  assets :', JSON.stringify(a.slice(Math.max(0, i - 80), i + 120)));
  console.log('  lab    :', JSON.stringify(b.slice(Math.max(0, i - 80), i + 120)));
}
