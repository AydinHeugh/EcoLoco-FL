import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, relative, resolve, sep } from 'node:path';

const apiUrl = process.env.EXPO_PUBLIC_API_URL;
if (!apiUrl || new URL(apiUrl).protocol !== 'https:') {
  throw new Error('Set EXPO_PUBLIC_API_URL to the public HTTPS backend address before building.');
}

const output = resolve('dist');

function filesIn(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? filesIn(path) : [path];
  });
}

function sha256(contents) {
  return createHash('sha256').update(contents).digest('hex');
}

function preparePagesAssets() {
  // Pages excludes every node_modules directory, including Expo's exported assets.
  const original = resolve(output, 'assets/node_modules');
  const vendor = resolve(output, 'assets/vendor');
  if (!existsSync(original)) throw new Error('Expo did not export the expected dependency assets.');
  rmSync(vendor, { recursive: true, force: true });
  renameSync(original, vendor);

  const textFiles = new Map(filesIn(output)
    .filter((path) => ['.js', '.mjs', '.json', '.html', '.css'].includes(extname(path)))
    .map((path) => [path, readFileSync(path, 'utf8')
      .replaceAll('assets/node_modules/', 'assets/vendor/')
      .replaceAll('assets\\/node_modules\\/', 'assets\\/vendor\\/')]));

  // Update lazy chunks first, then hash their callers with the final chunk paths.
  const bundles = [...textFiles.keys()].filter((path) => /-[a-f0-9]{32}\.js$/.test(path));
  const renamed = new Map();
  const visiting = new Set();
  function rehashBundle(path) {
    if (renamed.has(path)) return;
    if (visiting.has(path)) throw new Error('Cannot rehash cyclic exported JavaScript chunk references.');
    visiting.add(path);
    let contents = textFiles.get(path);
    for (const dependency of bundles) {
      if (dependency !== path && contents.includes(basename(dependency))) {
        rehashBundle(dependency);
        contents = contents.replaceAll(basename(dependency), basename(renamed.get(dependency)));
      }
    }
    const filename = basename(path).replace(/-[a-f0-9]{32}\.js$/, `-${sha256(contents).slice(0, 32)}.js`);
    renamed.set(path, resolve(dirname(path), filename));
    textFiles.set(path, contents);
    visiting.delete(path);
  }
  bundles.forEach(rehashBundle);

  for (const [path, contents] of textFiles) {
    let rewritten = contents;
    for (const [oldPath, newPath] of renamed) {
      rewritten = rewritten.replaceAll(basename(oldPath), basename(newPath));
    }
    writeFileSync(renamed.get(path) || path, rewritten);
  }
  for (const [oldPath, newPath] of renamed) {
    if (oldPath !== newPath) rmSync(oldPath);
  }

  const assets = filesIn(vendor).sort().map((path) => {
    const contents = readFileSync(path);
    return { path: `/${relative(output, path).split(sep).join('/')}`, bytes: contents.length, sha256: sha256(contents) };
  });
  writeFileSync(resolve(output, 'asset-manifest.json'), `${JSON.stringify({ version: 1, assets }, null, 2)}\n`);
  console.log(`Prepared ${assets.length} dependency assets for Pages and refreshed JavaScript content hashes.`);
}

execFileSync(process.execPath, [
  resolve('node_modules/expo/bin/cli'),
  'export', '--platform', 'web', '--clear', '--output-dir', output,
], { stdio: 'inherit' });

if (!existsSync(resolve(output, 'index.html'))) {
  throw new Error('The web export did not produce index.html.');
}

mkdirSync(resolve(output, 'docs'), { recursive: true });
cpSync(resolve('docs'), resolve(output, 'docs'), { recursive: true });
copyFileSync(resolve('docs/architecture.html'), resolve(output, 'architecture.html'));
// Pages uses index.html for client-side routes when there is no root 404 page.
if (process.env.CF_PAGES === '1') {
  preparePagesAssets();
  rmSync(resolve(output, '404.html'), { force: true });
  writeFileSync(resolve(output, '_headers'), '/favicon.ico\n  Content-Type: image/vnd.microsoft.icon\n');
} else {
  copyFileSync(resolve(output, 'index.html'), resolve(output, '404.html'));
}
writeFileSync(resolve(output, '.nojekyll'), '');

const commit = process.env.CF_PAGES_COMMIT_SHA || process.env.GITHUB_SHA
  || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
writeFileSync(resolve(output, 'deployment.json'), `${JSON.stringify({
  commit,
  basePath: process.env.EXPO_BASE_PATH || '',
}, null, 2)}\n`);
