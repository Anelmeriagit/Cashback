import crypto from 'node:crypto';

export const TEST_USER = 'Test';
export const TEST_PASS = 'secret-pass';

// AUTH_HASH в формате проекта: "salt:hash" (hex), scrypt с длиной 64.
export function makeAuthHash(pass, saltHex = '00112233445566778899aabbccddeeff') {
  const hash = crypto.scryptSync(pass, Buffer.from(saltHex, 'hex'), 64).toString('hex');
  return saltHex + ':' + hash;
}

export function setEnv() {
  process.env.AUTH_USER = TEST_USER;
  process.env.AUTH_HASH = makeAuthHash(TEST_PASS);
  process.env.SESSION_SECRET = 'test-session-secret-0123456789abcdef';
  process.env.SESSION_VERSION = '1';
}

export function mockReq({ method = 'GET', headers = {}, body } = {}) {
  return { method, headers, body };
}

export function mockRes() {
  return {
    statusCode: 200, headers: {}, body: undefined, ended: false,
    setHeader(k, v) { this.headers[String(k).toLowerCase()] = v; return this; },
    status(c) { this.statusCode = c; return this; },
    json(o) { this.body = o; this.ended = true; return this; },
    end(b) { if (b !== undefined) this.body = b; this.ended = true; return this; },
  };
}

// Один раз подменяет Date.now в тесте и даёт сдвигать время вперёд.
// Подмена снимается сама в конце теста (t.mock). Не вызывать дважды в одном тесте.
export function fakeClock(t) {
  const real = Date.now.bind(Date);
  let offset = 0;
  t.mock.method(Date, 'now', () => real() + offset);
  return { advance(ms) { offset += ms; } };
}
