import { execFileSync } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const apiUrl = process.env.EXPO_PUBLIC_API_URL;
if (!apiUrl || new URL(apiUrl).protocol !== 'https:') {
  throw new Error('Set EXPO_PUBLIC_API_URL to the public HTTPS backend address before building.');
}

const output = resolve('dist');
execFileSync(process.execPath, [
  resolve('node_modules/expo/bin/cli'),
  'export', '--platform', 'web', '--output-dir', output,
], { stdio: 'inherit' });

if (!existsSync(resolve(output, 'index.html'))) {
  throw new Error('The web export did not produce index.html.');
}

mkdirSync(resolve(output, 'docs'), { recursive: true });
cpSync(resolve('docs'), resolve(output, 'docs'), { recursive: true });
copyFileSync(resolve('docs/architecture.html'), resolve(output, 'architecture.html'));
copyFileSync(resolve(output, 'index.html'), resolve(output, '404.html'));
writeFileSync(resolve(output, '.nojekyll'), '');

const commit = process.env.GITHUB_SHA
  || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
writeFileSync(resolve(output, 'deployment.json'), `${JSON.stringify({
  commit,
  basePath: process.env.EXPO_BASE_PATH || '',
}, null, 2)}\n`);
