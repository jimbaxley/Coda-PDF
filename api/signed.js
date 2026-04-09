require('dotenv').config();

const CodaClient = require('../coda-client');

const PROPOSALS_TABLE = 'grid-LW06aE88FS';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { proposalNumber, clientName, signedAt } = req.body || {};

  if (!proposalNumber || !clientName || !signedAt) {
    return res.status(400).json({ error: 'Missing required fields: proposalNumber, clientName, signedAt' });
  }

  const apiToken = process.env.CODA_API_TOKEN;
  const docId = process.env.CODA_DOC_ID || 'C-uztK2tfM';

  if (!apiToken) {
    console.error('Missing CODA_API_TOKEN');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    const coda = new CodaClient(apiToken, docId);

    // Find the proposal row (need full row object, not just values, for the row id)
    const row = await coda.getRow(PROPOSALS_TABLE, { 'Proposal Number': proposalNumber });

    // Update the row with signature data
    // Column names must match what exists in your Coda DB Proposals table.
    // Add "Signed By" (text) and "Signed Date" (date) columns if they don't exist yet.
    await coda.updateRow(PROPOSALS_TABLE, row.id, {
      'Signed By': clientName,
      'Signed Date': signedAt,
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Failed to update Coda:', err.message);
    res.status(500).json({ error: err.message });
  }
};
