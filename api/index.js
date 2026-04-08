require('dotenv').config();

const { fetchProposalData, renderHtml } = require('../lib/proposal');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).send('Method Not Allowed');
  }

  const proposalNumber = req.query.proposal;

  if (!proposalNumber) {
    return res.status(400).send(`
      <html><body style="font-family:sans-serif;padding:2em;">
        <h2>Missing proposal number</h2>
        <p>Use <code>?proposal=P-XXXXXXXX-XX</code> in the URL.</p>
      </body></html>
    `);
  }

  try {
    const templateData = await fetchProposalData(proposalNumber);
    const template = req.query.mode === 'sign' ? 'sign-proposal.html' : 'editable-proposal.html';
    const html = renderHtml(templateData, template);
    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(html);
  } catch (err) {
    console.error(err);
    res.status(500).send(`
      <html><body style="font-family:sans-serif;padding:2em;">
        <h2>Error loading proposal</h2>
        <pre>${err.message}</pre>
      </body></html>
    `);
  }
};
