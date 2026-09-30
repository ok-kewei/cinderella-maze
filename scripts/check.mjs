// Checks the game before it can be merged or deployed: every inline <script> must be valid JavaScript,
// and the page must keep the elements its script depends on.
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const file = 'cinderella-maze.html';
const html = readFileSync(file, 'utf8');
let failed = false;

const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
if (!scripts.length) { console.error(`${file}: no inline script found`); failed = true; }
const dir = mkdtempSync(join(tmpdir(), 'maze-check-'));
scripts.forEach((code, i) => {
  const path = join(dir, `script-${i}.js`);
  writeFileSync(path, code);
  const r = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
  if (r.status !== 0) { console.error(`${file}: script ${i + 1} has a syntax error\n${r.stderr}`); failed = true; }
});

for (const id of ['game', 'overlay', 'screen', 'game-col', 'info', 'mute', 'title-slipper', 'info-trigger']) {
  if (!html.includes(`id="${id}"`)) { console.error(`${file}: missing element #${id}`); failed = true; }
}

if (failed) process.exit(1);
console.log(`${file}: ${scripts.length} script(s) OK, required elements present`);
