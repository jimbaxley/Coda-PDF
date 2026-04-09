require('dotenv').config();

const crypto = require('crypto');

const BASE_URL = process.env.APP_BASE_URL || 'https://sign.baxleyconsulting.com';

function makeToken(proposalNumber) {
  return crypto
    .createHmac('sha256', process.env.PDF_HMAC_SECRET)
    .update(proposalNumber)
    .digest('hex');
}

function makeDownloadUrl(proposalNumber) {
  const token = makeToken(proposalNumber);
  return `${BASE_URL}/api/download?proposal=${encodeURIComponent(proposalNumber)}&token=${token}`;
}

function validateToken(proposalNumber, token) {
  const expected = makeToken(proposalNumber);
  const a = Buffer.from(token.padEnd(expected.length).slice(0, expected.length), 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { makeToken, makeDownloadUrl, validateToken };
