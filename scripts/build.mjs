// Builds the deployable site: wraps the game page in a complete HTML document and writes dist/index.html.
// (On claude.ai the page is wrapped automatically; a normal web host needs the full document.)
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync } from 'node:fs';

const game = readFileSync('cinderella-maze.html', 'utf8');

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="description" content="Cinderella's Midnight Maze: an arcade maze chase through the palace.">
<style>
:root { color-scheme: light; padding-top: env(safe-area-inset-top, 0px); padding-bottom: env(safe-area-inset-bottom, 0px); }
body { margin: 0; font: 14px system-ui, -apple-system, "Segoe UI", sans-serif; background: #fafaf9; }
img { max-width: 100%; }
[hidden] { display: none !important; }
</style>
</head>
<body>
${game}
</body>
</html>
`;

mkdirSync('dist', { recursive: true });
writeFileSync('dist/index.html', page);
rmSync('dist/assets', { recursive: true, force: true }); // start clean, so removed files don't linger
cpSync('assets', 'dist/assets', { recursive: true }); // files the page loads, like the start screen's gameplay clip
console.log(`Built dist/index.html (${(page.length / 1024).toFixed(1)} KB) and copied assets/`);
