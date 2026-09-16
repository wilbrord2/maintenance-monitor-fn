#!/usr/bin/env node
/**
 * Minimal SMTP sink for end-to-end tests.
 *
 * Accepts every message on SMTP_SINK_PORT (default 1025) without TLS or auth, keeps the most
 * recent messages in memory and exposes them over HTTP on SMTP_SINK_HTTP_PORT (default 1080):
 *
 *   GET    /messages            → [{ id, from, to, subject, text, receivedAt }], newest first
 *   GET    /messages?to=<email> → only messages addressed to that recipient
 *   DELETE /messages            → clear the inbox
 *
 * Point the API at it with MAIL_HOST=127.0.0.1 MAIL_PORT=1025 MAIL_SECURE=false.
 * Never use this outside local testing.
 */
import http from 'node:http';
import net from 'node:net';

const SMTP_PORT = Number(process.env.SMTP_SINK_PORT ?? 1025);
const HTTP_PORT = Number(process.env.SMTP_SINK_HTTP_PORT ?? 1080);
const MAX_MESSAGES = 200;

/** @type {Array<{id: number, from: string | null, to: string[], subject: string, text: string, receivedAt: string}>} */
const messages = [];
let nextId = 1;

const extractAddress = (line) => (line.match(/<([^>]*)>/)?.[1] ?? '').trim().toLowerCase();

function decodeQuotedPrintable(value) {
  const bytes = value
    .replace(/=\r?\n/g, '')
    .replace(/=([0-9A-Fa-f]{2})/g, (_match, hex) => String.fromCharCode(parseInt(hex, 16)));
  return Buffer.from(bytes, 'latin1').toString('utf8');
}

function decodeTransfer(body, encoding) {
  const normalized = (encoding ?? '').trim().toLowerCase();
  if (normalized === 'base64') return Buffer.from(body.replace(/\s+/g, ''), 'base64').toString('utf8');
  if (normalized === 'quoted-printable') return decodeQuotedPrintable(body);
  return body;
}

function splitHeaders(raw) {
  const index = raw.indexOf('\r\n\r\n');
  const head = index === -1 ? raw : raw.slice(0, index);
  const body = index === -1 ? '' : raw.slice(index + 4);
  const headers = {};
  for (const line of head.replace(/\r\n[ \t]+/g, ' ').split('\r\n')) {
    const colon = line.indexOf(':');
    if (colon > 0) headers[line.slice(0, colon).trim().toLowerCase()] = line.slice(colon + 1).trim();
  }
  return { headers, body };
}

function decodeEncodedWords(value) {
  return value.replace(/=\?([^?]+)\?([QqBb])\?([^?]*)\?=/g, (_match, _charset, kind, text) =>
    kind.toUpperCase() === 'B'
      ? Buffer.from(text, 'base64').toString('utf8')
      : decodeQuotedPrintable(text.replace(/_/g, ' ')),
  );
}

function extractText(raw) {
  const { headers, body } = splitHeaders(raw);
  const contentType = headers['content-type'] ?? 'text/plain';
  const boundary = contentType.match(/boundary="?([^";]+)"?/i)?.[1];
  if (!boundary) return decodeTransfer(body, headers['content-transfer-encoding']);
  const parts = body.split(`--${boundary}`).slice(1, -1);
  let fallback = '';
  for (const part of parts) {
    const text = extractText(part.replace(/^\r\n/, ''));
    const partType = splitHeaders(part.replace(/^\r\n/, '')).headers['content-type'] ?? '';
    if (/text\/plain/i.test(partType) || /multipart\//i.test(partType)) return text;
    fallback ||= text;
  }
  return fallback;
}

function store(envelope, raw) {
  const { headers } = splitHeaders(raw);
  messages.unshift({
    id: nextId++,
    from: envelope.from,
    to: envelope.to,
    subject: decodeEncodedWords(headers.subject ?? ''),
    text: extractText(raw),
    receivedAt: new Date().toISOString(),
  });
  messages.length = Math.min(messages.length, MAX_MESSAGES);
}

const smtpServer = net.createServer((socket) => {
  socket.setEncoding('utf8');
  let buffer = '';
  let inData = false;
  let envelope = { from: null, to: [] };
  const reply = (line) => socket.write(`${line}\r\n`);

  reply('220 smtp-sink ESMTP ready');

  socket.on('data', (chunk) => {
    buffer += chunk;
    for (;;) {
      if (inData) {
        const end = buffer.indexOf('\r\n.\r\n');
        if (end === -1) return;
        const raw = buffer.slice(2, end).replace(/\r\n\.\./g, '\r\n.');
        buffer = buffer.slice(end + 5);
        inData = false;
        store(envelope, raw);
        envelope = { from: null, to: [] };
        reply('250 OK: queued');
        continue;
      }
      const lineEnd = buffer.indexOf('\r\n');
      if (lineEnd === -1) return;
      const line = buffer.slice(0, lineEnd);
      buffer = buffer.slice(lineEnd + 2);
      const command = line.slice(0, 4).toUpperCase();
      switch (command) {
        case 'EHLO':
          socket.write('250-smtp-sink\r\n250-8BITMIME\r\n250-SMTPUTF8\r\n250 SIZE 10485760\r\n');
          break;
        case 'HELO':
          reply('250 smtp-sink');
          break;
        case 'MAIL':
          envelope = { from: extractAddress(line), to: [] };
          reply('250 OK');
          break;
        case 'RCPT':
          envelope.to.push(extractAddress(line));
          reply('250 OK');
          break;
        case 'DATA':
          inData = true;
          // Prefix a line break so the terminator is found even for an empty body.
          buffer = `\r\n${buffer}`;
          reply('354 End data with <CR><LF>.<CR><LF>');
          break;
        case 'RSET':
          envelope = { from: null, to: [] };
          reply('250 OK');
          break;
        case 'NOOP':
          reply('250 OK');
          break;
        case 'QUIT':
          reply('221 Bye');
          socket.end();
          return;
        default:
          reply('502 Command not implemented');
      }
    }
  });
  socket.on('error', () => socket.destroy());
});

const httpServer = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${HTTP_PORT}`);
  if (url.pathname === '/messages' && req.method === 'GET') {
    const to = url.searchParams.get('to')?.toLowerCase();
    const result = to ? messages.filter((message) => message.to.includes(to)) : messages;
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(result));
    return;
  }
  if (url.pathname === '/messages' && req.method === 'DELETE') {
    messages.length = 0;
    res.writeHead(204).end();
    return;
  }
  res.writeHead(404).end();
});

smtpServer.listen(SMTP_PORT, '127.0.0.1', () => {
  console.log(`SMTP sink listening on 127.0.0.1:${SMTP_PORT}`);
});
httpServer.listen(HTTP_PORT, '127.0.0.1', () => {
  console.log(`SMTP sink inbox on http://127.0.0.1:${HTTP_PORT}/messages`);
});
