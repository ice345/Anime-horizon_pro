import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import http from 'node:http';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

process.env.DEEPSEEK_API_KEY = 'test-server-key';
process.env.CORS_ORIGINS = 'http://allowed.example';
process.env.AI_RATE_LIMIT_PER_MINUTE = '100';

const originalFetch = globalThis.fetch;
const upstreamCalls = [];
const { createAppServer } = await import('../server.mjs');
let server;
let address;
let staticRoot;

const request = (path, options = {}) =>
  new Promise((resolve, reject) => {
    const requestOptions = {
      hostname: '127.0.0.1',
      port: address.port,
      path,
      method: options.method || 'POST',
      headers: options.headers || {},
    };
    const clientRequest = http.request(requestOptions, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () =>
        resolve({
          status: response.statusCode,
          headers: response.headers,
          body: Buffer.concat(chunks).toString('utf8'),
        })
      );
    });
    clientRequest.on('error', reject);
    clientRequest.end(options.body || '');
  });

beforeAll(async () => {
  globalThis.fetch = async (url, init) => {
    upstreamCalls.push({ url, init });
    return new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  staticRoot = await mkdtemp(join(tmpdir(), 'anime-horizon-server-'));
  await writeFile(join(staticRoot, 'index.html'), '<!doctype html><html></html>');
  server = createAppServer({ staticRoot });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  address = server.address();
});

afterAll(async () => {
  globalThis.fetch = originalFetch;
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  await rm(staticRoot, { recursive: true, force: true });
});

describe('AI proxy boundary', () => {
  it('rejects an origin outside the configured allowlist', async () => {
    const response = await request('/api/deepseek/chat', {
      headers: { Origin: 'http://blocked.example' },
    });

    expect(response.status).toBe(403);
    expect(JSON.parse(response.body).error).toBe('CORS_FORBIDDEN');
  });

  it('rejects malformed JSON without calling the upstream', async () => {
    const before = upstreamCalls.length;
    const response = await request('/api/deepseek/chat', {
      headers: {
        Origin: 'http://allowed.example',
        'Content-Type': 'application/json',
      },
      body: '{',
    });

    expect(response.status).toBe(400);
    expect(upstreamCalls).toHaveLength(before);
  });

  it('does not allow the request body to override the server model', async () => {
    const response = await request('/api/deepseek/chat', {
      headers: {
        Origin: 'http://allowed.example',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt: 'hello', model: 'expensive-user-selected-model' }),
    });

    expect(response.status).toBe(200);
    const upstreamBody = JSON.parse(upstreamCalls.at(-1).init.body);
    expect(upstreamBody.model).toBe('deepseek-v4-flash');
  });

  it('serves HEAD requests without a response body', async () => {
    const response = await request('/', { method: 'HEAD' });

    expect(response.status).toBe(200);
    expect(response.body).toBe('');
  });
});
