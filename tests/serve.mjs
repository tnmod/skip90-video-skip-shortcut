import { readFile } from 'node:fs/promises';
import http from 'node:http';
import { pathToFileURL } from 'node:url';

const fixtureFiles = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/fixture.js', ['fixture.js', 'text/javascript; charset=utf-8']],
  ['/fixture.css', ['fixture.css', 'text/css; charset=utf-8']],
  ['/sample.webm', ['sample.webm', 'video/webm']],
]);

async function serve(request, response) {
  const file = fixtureFiles.get(new URL(request.url, 'http://127.0.0.1').pathname);
  if (!file) {
    response.writeHead(404).end();
    return;
  }

  const [name, contentType] = file;
  const data = await readFile(new URL(`fixtures/${name}`, import.meta.url));
  const headers = { 'Content-Type': contentType, 'Cache-Control': 'no-store' };
  const range = name === 'sample.webm' && /^bytes=(\d+)-(\d*)$/.exec(request.headers.range ?? '');

  if (!range) {
    response.writeHead(200, { ...headers, 'Content-Length': data.length }).end(data);
    return;
  }

  const start = Number(range[1]);
  const end = Math.min(range[2] ? Number(range[2]) : data.length - 1, data.length - 1);
  if (start > end) {
    response.writeHead(416, { 'Content-Range': `bytes */${data.length}` }).end();
    return;
  }

  response.writeHead(206, {
    ...headers,
    'Accept-Ranges': 'bytes',
    'Content-Range': `bytes ${start}-${end}/${data.length}`,
    'Content-Length': end - start + 1,
  }).end(data.subarray(start, end + 1));
}

function listen(server, port, host) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      resolve();
    });
  });
}

export async function startFixtures(port = 0) {
  const servers = [http.createServer(serve), http.createServer(serve)];
  await listen(servers[0], port, '127.0.0.1');
  const actualPort = servers[0].address().port;
  // Chrome can resolve localhost to IPv6. Both listeners stay on loopback.
  try {
    await listen(servers[1], actualPort, '::1');
  } catch (error) {
    if (!['EADDRNOTAVAIL', 'EAFNOSUPPORT'].includes(error.code)) {
      servers[0].close();
      throw error;
    }
  }
  return {
    url: `http://127.0.0.1:${actualPort}/`,
    close() {
      return Promise.all(servers.filter((server) => server.listening).map((server) => new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections();
      })));
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const fixtures = await startFixtures(Number(process.argv[2] ?? 4173));
  console.log(`Skip90 fixtures: ${fixtures.url}`);
}
