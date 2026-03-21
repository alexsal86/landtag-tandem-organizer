/**
 * RSVP Proxy — Plesk Node.js (keine Dependencies)
 *
 * Leitet Anfragen an Supabase Edge Functions weiter und injiziert
 * Credentials serverseitig. Im Browser ist kein Supabase-Hinweis sichtbar.
 *
 * Umgebungsvariablen (in Plesk setzen):
 *   SUPABASE_URL      — z.B. https://xxxx.supabase.co
 *   SUPABASE_ANON_KEY — der anon/public Key
 *   ALLOWED_ORIGIN    — optional, default https://www.alexander-salomon.de
 *   PORT              — optional, default 3000 (Plesk/Passenger setzt das automatisch)
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://www.alexander-salomon.de';
const PORT = parseInt(process.env.PORT, 10) || 3000;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Fehler: SUPABASE_URL und SUPABASE_ANON_KEY müssen als Umgebungsvariablen gesetzt sein.');
  process.exit(1);
}

// Route → Supabase Edge Function
const ROUTES = {
  '/pruefe': '/functions/v1/get-public-event-invitation',
  '/antwort': '/functions/v1/respond-public-event-invitation',
};

// Header die nicht an den Browser weitergegeben werden
const STRIP_HEADERS = /^(x-kong-|sb-gateway-|x-envoy-|x-sb-|server$|via$)/i;

function corsHeaders(origin) {
  const headers = {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
  return headers;
}

function proxyToSupabase(functionPath, body, callback) {
  const target = new URL(functionPath, SUPABASE_URL);

  const options = {
    hostname: target.hostname,
    port: 443,
    path: target.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
      'apikey': SUPABASE_ANON_KEY,
      'Content-Length': Buffer.byteLength(body),
    },
  };

  const req = https.request(options, (res) => {
    const chunks = [];
    res.on('data', (chunk) => chunks.push(chunk));
    res.on('end', () => {
      // Nur sichere Header weiterleiten
      const safeHeaders = {};
      for (const [key, value] of Object.entries(res.headers)) {
        if (!STRIP_HEADERS.test(key)) {
          safeHeaders[key] = value;
        }
      }
      callback(null, res.statusCode, safeHeaders, Buffer.concat(chunks));
    });
  });

  req.on('error', (err) => callback(err));
  req.setTimeout(15000, () => {
    req.destroy();
    callback(new Error('Upstream timeout'));
  });
  req.write(body);
  req.end();
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 16384) { // 16 KB max
        reject(new Error('Body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const cors = corsHeaders();

  // Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors);
    res.end();
    return;
  }

  // Health check
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json', ...cors });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  // Nur POST auf bekannte Routen
  const functionPath = ROUTES[req.url];
  if (!functionPath || req.method !== 'POST') {
    res.writeHead(404, { 'Content-Type': 'application/json', ...cors });
    res.end(JSON.stringify({ error: 'Nicht gefunden' }));
    return;
  }

  try {
    const body = await readBody(req);

    proxyToSupabase(functionPath, body, (err, statusCode, headers, data) => {
      if (err) {
        res.writeHead(502, { 'Content-Type': 'application/json', ...cors });
        res.end(JSON.stringify({ error: 'Upstream nicht erreichbar' }));
        return;
      }

      // CORS-Header ergänzen, Content-Type vom Upstream übernehmen
      const responseHeaders = {
        ...cors,
        'Content-Type': headers['content-type'] || 'application/json',
      };

      res.writeHead(statusCode, responseHeaders);
      res.end(data);
    });
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'application/json', ...cors });
    res.end(JSON.stringify({ error: 'Ungültige Anfrage' }));
  }
});

server.listen(PORT, () => {
  console.log(`RSVP-Proxy läuft auf Port ${PORT}`);
});
