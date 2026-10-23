import { setTimeout as sleep } from 'node:timers/promises';
import { createHash } from 'node:crypto';
import { extname } from 'node:path';

const [siteArgument, expectedCommit, ...extraArguments] = process.argv.slice(2);
const MB = 1024 * 1024;

function fail(message) {
  throw new Error(message);
}

function publicUrl(value, label) {
  let url;
  try {
    url = new URL(value);
  } catch {
    fail(`${label} must be an absolute HTTPS URL.`);
  }
  const localhost = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(localhost && url.protocol === 'http:')) {
    fail(`${label} must use HTTPS (HTTP is allowed only on localhost).`);
  }
  if (url.username || url.password || url.search || url.hash) {
    fail(`${label} must not contain credentials, a query, or a fragment.`);
  }
  return url;
}

function contentType(response) {
  return (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
}

async function get(url, { timeout = 15_000, limit = 2 * MB } = {}) {
  let response;
  try {
    response = await fetch(url, {
      redirect: 'follow',
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
      signal: AbortSignal.timeout(timeout),
    });
  } catch (error) {
    fail(`Could not fetch ${url.pathname}: ${error.message}. Check HTTPS, DNS, and the deployment URL.`);
  }
  const destination = new URL(response.url);
  if (destination.origin !== url.origin) {
    await response.body?.cancel();
    fail(`${url.pathname} redirected to ${destination.origin}; use the site's final canonical URL.`);
  }
  const reader = response.body?.getReader();
  const chunks = [];
  let size = 0;
  if (reader) {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > limit) {
          await reader.cancel();
          fail(`${url.pathname} exceeds the smoke check's ${limit / MB} MB download limit.`);
        }
        chunks.push(Buffer.from(value));
      }
    } catch (error) {
      fail(`Could not read ${url.pathname}: ${error.message}`);
    }
  }
  return { response, body: Buffer.concat(chunks, size) };
}

function requireStatus(result, pathname) {
  if (result.response.status !== 200) {
    fail(`${pathname} returned HTTP ${result.response.status}; expected 200. Check the Pages build output and routing.`);
  }
  if (!result.body.length) fail(`${pathname} returned an empty response.`);
}

function requireHtml(result, pathname) {
  requireStatus(result, pathname);
  if (contentType(result.response) !== 'text/html') {
    fail(`${pathname} must return text/html, received ${contentType(result.response) || 'no content type'}.`);
  }
  const html = result.body.toString('utf8');
  if (!/<html[\s>]/i.test(html)) fail(`${pathname} did not return an HTML document.`);
  return html;
}

function attribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return (match?.[1] ?? match?.[2] ?? match?.[3] ?? '').replace(/&amp;/gi, '&');
}

function localAsset(reference, site, label) {
  let url;
  try {
    url = new URL(reference, site);
  } catch {
    fail(`${label} has an invalid URL.`);
  }
  if (url.origin !== site.origin || url.username || url.password) {
    fail(`${label} must be hosted on ${site.origin}; received ${url.origin}.`);
  }
  return url;
}

async function checkDependencyAssets(site, javascript) {
  if (javascript.includes('/assets/node_modules/')) {
    fail('JavaScript still references /assets/node_modules/, which Pages excludes. Rebuild with CF_PAGES=1.');
  }
  const manifestUrl = new URL('/asset-manifest.json', site);
  const result = await get(manifestUrl, { limit: 256 * 1024 });
  requireStatus(result, manifestUrl.pathname);
  if (contentType(result.response) !== 'application/json') fail('asset-manifest.json must return application/json.');
  let manifest;
  try {
    manifest = JSON.parse(result.body.toString('utf8'));
  } catch {
    fail('asset-manifest.json is not valid JSON. Rebuild the Pages asset manifest.');
  }
  if (manifest.version !== 1 || !Array.isArray(manifest.assets) || !manifest.assets.length || manifest.assets.length > 256) {
    fail('The dependency asset manifest must contain between 1 and 256 assets with version 1.');
  }
  const mimeTypes = {
    '.ttf': ['font/ttf', 'application/x-font-ttf', 'application/font-sfnt'],
    '.otf': ['font/otf', 'application/x-font-opentype', 'application/font-sfnt'],
    '.woff': ['font/woff', 'application/font-woff'],
    '.woff2': ['font/woff2'],
    '.png': ['image/png'], '.jpg': ['image/jpeg'], '.jpeg': ['image/jpeg'],
    '.gif': ['image/gif'], '.webp': ['image/webp'], '.svg': ['image/svg+xml'],
  };
  const paths = new Set();
  let totalBytes = 0;
  for (const asset of manifest.assets) {
    if (typeof asset.path !== 'string' || !asset.path.startsWith('/assets/vendor/') || paths.has(asset.path)
      || !Number.isSafeInteger(asset.bytes) || asset.bytes <= 0 || asset.bytes > 8 * MB
      || !/^[a-f0-9]{64}$/.test(asset.sha256 || '')) {
      fail('The dependency asset manifest contains an invalid path, duplicate, size, or SHA256.');
    }
    const url = localAsset(asset.path, site, 'Dependency asset');
    if (url.pathname !== asset.path || url.search || url.hash || !mimeTypes[extname(asset.path)]) {
      fail(`Unsupported dependency asset path: ${asset.path}. Check the generated manifest and MIME mapping.`);
    }
    paths.add(asset.path);
    totalBytes += asset.bytes;
  }
  if (totalBytes > 20 * MB) fail('Dependency assets exceed the smoke check download limit of 20 MB.');
  const fonts = [...javascript.replaceAll('\\/', '/').matchAll(/["'](\/assets\/[^"'\s]+\.(?:ttf|otf|woff2?))["']/g)]
    .map((match) => match[1]);
  if (!fonts.length) fail('No exported font URLs were found in the main JavaScript bundle.');
  for (const font of fonts) {
    if (!paths.has(font)) fail(`Font referenced by JavaScript is absent from the dependency asset manifest: ${font}`);
  }

  const deadline = Date.now() + 60_000;
  let index = 0;
  await Promise.all(Array.from({ length: Math.min(4, manifest.assets.length) }, async () => {
    while (index < manifest.assets.length) {
      const asset = manifest.assets[index++];
      if (Date.now() >= deadline) fail('Dependency asset checks exceeded 60 seconds; check Pages asset delivery.');
      const fetched = await get(new URL(asset.path, site), {
        timeout: Math.min(15_000, deadline - Date.now()), limit: asset.bytes + 1,
      });
      requireStatus(fetched, asset.path);
      if (!mimeTypes[extname(asset.path)].includes(contentType(fetched.response))) {
        fail(`${asset.path} returned ${contentType(fetched.response) || 'no content type'}; expected ${mimeTypes[extname(asset.path)][0]}. The asset may have fallen back to index.html.`);
      }
      const digest = createHash('sha256').update(fetched.body).digest('hex');
      if (fetched.body.length !== asset.bytes || digest !== asset.sha256) {
        fail(`${asset.path} does not match its exported size and SHA256. Check the asset upload and CDN cache.`);
      }
    }
  }));
  console.log(`PASS ${manifest.assets.length} dependency assets (${new Set(fonts).size} referenced fonts): MIME, size, SHA256`);
}

async function waitForDeployment(site) {
  const deadline = Date.now() + 60_000;
  let lastProblem = 'deployment.json is unavailable';
  for (let attempt = 1; attempt <= 7 && Date.now() < deadline; attempt += 1) {
    const url = new URL('/deployment.json', site);
    url.searchParams.set('smoke', `${expectedCommit}-${Date.now()}`);
    try {
      const result = await get(url, { timeout: Math.min(8_000, deadline - Date.now()), limit: 64 * 1024 });
      requireStatus(result, url.pathname);
      if (contentType(result.response) !== 'application/json') {
        fail('deployment.json did not return application/json; confirm it is included in dist.');
      }
      let deployment;
      try {
        deployment = JSON.parse(result.body.toString('utf8'));
      } catch {
        fail('deployment.json is not valid JSON; confirm it is included in dist.');
      }
      if (deployment.commit?.toLowerCase() !== expectedCommit.toLowerCase()) {
        fail(`Expected commit ${expectedCommit}, received ${deployment.commit || 'no commit'}.`);
      }
      if (deployment.basePath !== '') {
        fail(`Expected an empty basePath for Pages, received ${JSON.stringify(deployment.basePath)}. Clear EXPO_BASE_PATH and rebuild.`);
      }
      return;
    } catch (error) {
      lastProblem = error.message;
      if (attempt < 7 && Date.now() < deadline) {
        console.log(`Waiting for deployment (${attempt}/7): ${lastProblem}`);
        await sleep(Math.min(8_000, Math.max(0, deadline - Date.now())));
      }
    }
  }
  fail(`Deployment did not become ready within 60 seconds. ${lastProblem} Check the Pages deployment and expected commit.`);
}

async function main() {
  if (!siteArgument || !expectedCommit || extraArguments.length) {
    fail('Usage: node scripts/check-deployment.mjs <https://site> <expected-commit-sha>');
  }
  if (!/^[a-f0-9]{7,64}$/i.test(expectedCommit)) fail('Expected commit must be a Git commit SHA.');
  const site = publicUrl(siteArgument, 'Site URL');
  if (site.pathname !== '/') fail('Site URL must point to the domain root; Pages expects an empty basePath.');
  const apiUrl = process.env.EXPO_PUBLIC_API_URL
    ? publicUrl(process.env.EXPO_PUBLIC_API_URL, 'EXPO_PUBLIC_API_URL').href.replace(/\/+$/, '')
    : null;

  await waitForDeployment(site);
  console.log(`PASS deployment: ${expectedCommit}, empty basePath`);

  const homepage = requireHtml(await get(site), '/');
  console.log('PASS homepage: HTTP 200 HTML');

  const scripts = homepage.match(/<script\b[^>]*>/gi) || [];
  const scriptSource = scripts.map((tag) => attribute(tag, 'src')).find((src) => {
    if (!src) return false;
    try { return /\.(?:m?js)$/i.test(new URL(src, site).pathname); } catch { return false; }
  });
  if (!scriptSource) fail('Homepage has no referenced JavaScript bundle. Check the Expo web export.');
  const bundleUrl = localAsset(scriptSource, site, 'JavaScript bundle');
  const bundle = await get(bundleUrl, { limit: 20 * MB });
  requireStatus(bundle, bundleUrl.pathname);
  if (!/^(?:text|application)\/(?:javascript|ecmascript|x-javascript)$/.test(contentType(bundle.response))) {
    fail(`JavaScript bundle returned ${contentType(bundle.response) || 'no content type'}; check asset paths and SPA fallback rules.`);
  }
  const javascript = bundle.body.toString('utf8');
  if (apiUrl) {
    if (!javascript.includes(apiUrl) && !javascript.includes(apiUrl.replaceAll('/', '\\/'))) {
      fail('JavaScript bundle does not contain EXPO_PUBLIC_API_URL. Set it in the Pages build environment and rebuild.');
    }
  }
  console.log(`PASS JavaScript bundle${apiUrl ? ' and backend URL configuration' : ''}`);
  await checkDependencyAssets(site, javascript);

  const links = homepage.match(/<link\b[^>]*>/gi) || [];
  const faviconReference = links.find((tag) => attribute(tag, 'rel').toLowerCase().split(/\s+/).includes('icon'));
  if (!faviconReference || !attribute(faviconReference, 'href')) fail('Homepage has no favicon link.');
  const faviconUrl = localAsset(attribute(faviconReference, 'href'), site, 'Favicon');
  const favicon = await get(faviconUrl);
  requireStatus(favicon, faviconUrl.pathname);
  if (!contentType(favicon.response).startsWith('image/')) {
    fail(`Favicon returned ${contentType(favicon.response) || 'no content type'}; check the exported favicon path.`);
  }
  console.log('PASS favicon');

  const route = `/__deployment_smoke__/missing-${expectedCommit.slice(0, 12)}`;
  const fallback = requireHtml(await get(new URL(route, site)), route);
  if (fallback.trim() !== homepage.trim()) {
    fail('An unknown application route did not return index.html. Remove the root 404.html and check Pages SPA routing.');
  }
  console.log('PASS application route: index.html fallback');

  for (const pathname of ['/docs/architecture.html', '/architecture.html']) {
    const html = requireHtml(await get(new URL(pathname, site)), pathname);
    if (!/<title>\s*EcoLoco Architecture\s*<\/title>/i.test(html)) {
      fail(`${pathname} did not return the architecture document. Check that docs are copied into dist.`);
    }
  }
  console.log('PASS architecture documents (redirects followed)');
  console.log('Deployment smoke check passed.');
}

main().catch((error) => {
  console.error(`FAIL ${error.message}`);
  process.exitCode = 1;
});
