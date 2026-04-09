require('dotenv').config();

const { validateToken } = require('../lib/token');

const BLOB_BASE = 'https://4cw6vuhpjyjbfuqe.private.blob.vercel-storage.com';

module.exports = async function handler(req, res) {
  const { proposal, token } = req.query;

  if (!proposal || !token) {
    return res.status(400).send('Missing parameters');
  }

  if (!validateToken(proposal, token)) {
    return res.status(403).send('Invalid token');
  }

  const blobUrl = `${BLOB_BASE}/pdfs/${encodeURIComponent(proposal)}.pdf`;

  // Fetch private blob server-side using the read/write token
  const blobRes = await fetch(blobUrl, {
    headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
  });

  if (!blobRes.ok) {
    console.error('Blob fetch failed:', blobRes.status, await blobRes.text());
    return res.status(404).send('PDF not found');
  }

  const buffer = Buffer.from(await blobRes.arrayBuffer());

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="Baxley Consulting | ${proposal}.pdf"`);
  res.setHeader('Content-Length', buffer.length);
  res.status(200).end(buffer);
};
