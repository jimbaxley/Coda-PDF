require('dotenv').config();

const CodaClient = require('../coda-client');

const PROPOSALS_TABLE = 'grid-LW06aE88FS';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const proposalNumber = req.query.proposal;

  if (!proposalNumber) {
    return res.status(400).json({ error: 'Missing proposal number' });
  }

  const apiToken = process.env.CODA_API_TOKEN;
  const docId = process.env.CODA_DOC_ID || 'C-uztK2tfM';

  if (!apiToken) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    const coda = new CodaClient(apiToken, docId);
    const row = await coda.getRow(PROPOSALS_TABLE, { 'Proposal Number': proposalNumber });
    await coda.updateRow(PROPOSALS_TABLE, row.id, {
      'Signed By': '',
      'Signed Date': null,
      'PDF Link': '',
      'PDF Download URL': '',
    });
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Failed to void proposal:', err.message);
    res.status(500).json({ error: err.message });
  }
};
