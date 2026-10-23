import { execFileSync } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const apiUrl = process.env.EXPO_PUBLIC_API_URL;
if (!apiUrl || new URL(apiUrl).protocol !== 'https:') {
  throw new Error('Set EXPO_PUBLIC_API_URL to the public HTTPS backend address before building.');
}

const output = resolve('dist');
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
