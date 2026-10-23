import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const page = await readFile(new URL('./phone-preview.html', import.meta.url));

const server = createServer((request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }
  if (request.url === '/favicon.ico') {
    response.writeHead(204).end();
    return;
  }
  if (request.url !== '/') {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
    return;
  }
  response.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': page.length,
    'Cache-Control': 'no-store',
  });
  response.end(request.method === 'HEAD' ? undefined : page);
});

server.on('error', error => {
  console.error(error.code === 'EADDRINUSE' ? 'Port 8002 is already in use.' : error.message);
  process.exitCode = 1;
});

server.listen(8002, '127.0.0.1', () => {
  console.log('Phone preview: http://localhost:8002/');
  console.log('Keep Expo running on http://localhost:8081/ for live updates.');
});
