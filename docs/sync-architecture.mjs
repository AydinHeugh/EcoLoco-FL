#!/usr/bin/env node
// Keeps the architecture docs honest.
//
//   node docs/sync-architecture.mjs           check graph vs. code, then regenerate ARCHITECTURE.md
//   node docs/sync-architecture.mjs --check   check only; exit 1 if anything is stale or wrong
//
// Source of truth: the <script id="graph-data"> JSON inside docs/architecture.html.

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const HTML = join(ROOT, 'docs/architecture.html');
const MD = join(ROOT, 'ARCHITECTURE.md');
const checkOnly = process.argv.includes('--check');

const errors = [], warnings = [];
const read = p => readFileSync(join(ROOT, p), 'utf8');

const m = readFileSync(HTML, 'utf8').match(/<script type="application\/json" id="graph-data">([\s\S]*?)<\/script>/);
if (!m) { console.error('graph-data block not found in docs/architecture.html'); process.exit(1); }
const G = JSON.parse(m[1]);
const ids = new Set();

const LAYERS = ['ui', 'device', 'client', 'route', 'svc', 'data', 'ext'];
for (const n of G.nodes) {
  if (ids.has(n.id)) errors.push(`duplicate node id "${n.id}"`);
  ids.add(n.id);
  if (!LAYERS.includes(n.layer)) errors.push(`${n.id}: unknown layer "${n.layer}"`);
  if (!['live', 'planned', 'dead'].includes(n.status)) errors.push(`${n.id}: unknown status "${n.status}"`);
  if (n.status !== 'live' && !n.goal) errors.push(`${n.id}: ${n.status} node needs a "goal"`);
  if (!n.what || !n.how?.length) errors.push(`${n.id}: needs "what" and "how" steps`);
}
for (const e of G.edges) {
  if (!ids.has(e.from) || !ids.has(e.to)) errors.push(`edge ${e.from} → ${e.to} points at a missing node`);
}

for (const n of G.nodes) {
  if (!n.file) continue;
  const exists = existsSync(join(ROOT, n.file));
  const has = exists && (!n.symbol || read(n.file).includes(n.symbol));
  if (n.status === 'planned') {
    if (has) warnings.push(`${n.id}: ${n.file}${n.symbol ? ` has "${n.symbol}"` : ' exists'}: shipped? drop PLANNED`);
  } else if (!exists) {
    errors.push(`${n.id}: file ${n.file} not found`);
  } else if (!has) {
    errors.push(`${n.id}: "${n.symbol}" not found in ${n.file}`);
  }
}

const symbols = G.nodes.filter(n => n.status !== 'planned').map(n => `${n.file}::${n.symbol}`);
const covered = (file, needle) => symbols.some(s => s.startsWith(file + '::') && s.includes(needle));
const ls = dir => (existsSync(join(ROOT, dir)) ? readdirSync(join(ROOT, dir)) : []);

for (const f of ls('frontend/screens').filter(f => f.endsWith('.js'))) {
  const file = `frontend/screens/${f}`;
  if (!G.nodes.some(n => n.file === file)) errors.push(`missing node for screen ${file}`);
}
for (const f of ls('frontend/services').filter(f => f.endsWith('.js'))) {
  const file = `frontend/services/${f}`;
  for (const [, name] of read(file).matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g))
    if (!covered(file, `function ${name}`)) errors.push(`missing node for ${file} → ${name}()`);
}
for (const f of ls('backend/services').filter(f => f.endsWith('.py'))) {
  const file = `backend/services/${f}`;
  for (const [, name] of read(file).matchAll(/^def ([a-zA-Z]\w*)\(/gm))
    if (!covered(file, `def ${name}(`)) errors.push(`missing node for ${file} → ${name}()`);
}
const app = read('backend/app.py').replace(/'''[\s\S]*?'''/g, '');   // ignore commented-out blocks
for (const [, route, name] of app.matchAll(/@app\.route\("([^"]+)"[^\n]*\n\s*def (\w+)\(/g))
  if (!covered('backend/app.py', `def ${name}(`)) errors.push(`missing node for route ${route} (${name})`);

const esc = s => String(s).replace(/"/g, '#quot;').replace(/</g, '#lt;').replace(/>/g, '#gt;');
const TITLES = { ui: 'Screens & UI', device: 'Device', client: 'API client', route: 'Flask routes',
                 svc: 'Services', data: 'Bundled data', ext: 'External APIs' };
const STYLE = {
  ui: 'fill:#e3f2e1,stroke:#2e7d32,color:#12301a', device: 'fill:#eceff1,stroke:#607d8b,color:#263238',
  client: 'fill:#e1effa,stroke:#1e6fb8,color:#0d2d4d', route: 'fill:#fff1d6,stroke:#c77800,color:#4a2c00',
  svc: 'fill:#f1e4f7,stroke:#7b3fa0,color:#2e0f40', data: 'fill:#e0f4f1,stroke:#00897b,color:#00332d',
  ext: 'fill:#fde4e1,stroke:#c0392b,color:#4a0f08',
};
const mermaid = ['flowchart LR'];
for (const layer of LAYERS) {
  const ns = G.nodes.filter(n => n.layer === layer);
  if (!ns.length) continue;
  mermaid.push(`  subgraph L_${layer}["${TITLES[layer]}"]`, '    direction TB');
  for (const n of ns) {
    let label = esc(n.label);
    if (n.status === 'planned') label += `<br/>PLANNED, goal: ${esc(n.goal)}`;
    else if (n.status === 'dead') label += `<br/>DEAD: ${esc(n.goal)}`;
    mermaid.push(`    ${n.id}["${label}"]`);
  }
  mermaid.push('  end');
}
for (const e of G.edges) {
  const arrow = e.status === 'planned' || e.status === 'dead' ? '-.->' : '-->';
  mermaid.push(`  ${e.from} ${arrow}|"${esc(e.label)}"| ${e.to}`);
}
for (const layer of LAYERS) mermaid.push(`  classDef ${layer} ${STYLE[layer]}`);
mermaid.push('  classDef planned stroke-dasharray:6 4,stroke-width:2px', '  classDef dead fill:#f3f3f3,stroke:#9e9e9e,color:#616161,stroke-dasharray:3 3');
for (const layer of LAYERS) {
  const list = G.nodes.filter(n => n.layer === layer).map(n => n.id);
  if (list.length) mermaid.push(`  class ${list.join(',')} ${layer}`);
}
for (const s of ['planned', 'dead']) {
  const list = G.nodes.filter(n => n.status === s).map(n => n.id);
  if (list.length) mermaid.push(`  class ${list.join(',')} ${s}`);
}

const cell = s => String(s).replace(/\|/g, '\\|');
const planned = [
  '| Item | Status | Goal |', '|---|---|---|',
  ...G.nodes.filter(n => n.goal).map(n =>
    `| \`${n.label}\`${n.file ? ` (${n.file})` : ''} | ${n.status === 'live' ? 'change planned' : n.status.toUpperCase()} | ${cell(n.goal)} |`),
];

const block = (name, body) => `<!-- GENERATED:${name} -->\n${body}\n<!-- /GENERATED:${name} -->`;
const readMd = () => readFileSync(MD, 'utf8').replace(/\r\n/g, '\n');
let md = readMd();
const replace = (name, body) => {
  const re = new RegExp(`<!-- GENERATED:${name} -->[\\s\\S]*?<!-- /GENERATED:${name} -->`);
  if (!re.test(md)) { errors.push(`ARCHITECTURE.md is missing the GENERATED:${name} markers`); return; }
  md = md.replace(re, () => block(name, body));
};
replace('planned', planned.join('\n'));
replace('mermaid', '```mermaid\n' + mermaid.join('\n') + '\n```');

const stale = md !== readMd();

for (const w of warnings) console.warn('warn  ' + w);
for (const e of errors) console.error('ERROR ' + e);
if (checkOnly) {
  if (stale) console.error('ERROR ARCHITECTURE.md is out of date. Run: node docs/sync-architecture.mjs');
  if (errors.length || stale) process.exit(1);
  console.log(`ok: ${G.nodes.length} nodes, ${G.edges.length} edges match the code`);
} else {
  if (stale) writeFileSync(MD, md);
  console.log(`${stale ? 'updated' : 'unchanged'} ARCHITECTURE.md: ${G.nodes.length} nodes, ${G.edges.length} edges`);
  if (errors.length) process.exit(1);
}
