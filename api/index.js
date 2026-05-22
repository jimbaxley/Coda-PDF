require('dotenv').config();

const { fetchProposalData, renderHtml } = require('../lib/proposal');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).send('Method Not Allowed');
  }

  const proposalNumber = req.query.proposal;
  const isSignMode = req.query.mode === 'sign';

  if (!proposalNumber) {
    return res.status(400).send(`
      <html><body style="font-family:sans-serif;padding:2em;">
        <h2>Missing proposal number</h2>
        <p>Use <code>?proposal=P-XXXXXXXX-XX</code> in the URL.</p>
      </body></html>
    `);
  }

  if (isSignMode && req.query.render !== '1') {
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(renderSignLoadingShell(proposalNumber));
  }

  try {
    const templateData = await fetchProposalData(proposalNumber);
    const template = isSignMode ? 'sign-proposal.html' : 'editable-proposal.html';
    const html = renderHtml(templateData, template);
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Cache-Control', 'no-store');
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

function renderSignLoadingShell(proposalNumber) {
  const safeProposalNumber = escapeHtml(proposalNumber);
  const fetchUrl = `/?proposal=${encodeURIComponent(proposalNumber)}&mode=sign&render=1`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Loading Proposal | Baxley Consulting</title>
  <meta property="og:title" content="Proposal | Baxley Consulting">
  <meta property="og:description" content="Review and sign your Baxley Consulting proposal.">
  <meta property="og:image" content="https://sign.baxleyconsulting.com/Social.png">
  <meta name="twitter:card" content="summary_large_image">
  <style>
    :root { --purple: #5B2D8E; --purple-dark: #3E1D63; --gray: #f4f1f7; --text: #2f2936; --muted: #6f6678; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: Arial, sans-serif; color: var(--text); background: #ece8ef; }
    .loading-shell { width: min(92vw, 560px); padding: 32px; background: #fff; border: 1px solid #ded6e8; border-radius: 8px; box-shadow: 0 16px 50px rgba(35, 22, 50, 0.16); }
    .brand { color: var(--purple-dark); font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
    h1 { margin: 10px 0 8px; color: var(--purple); font-size: 26px; line-height: 1.2; }
    p { margin: 0 0 22px; color: var(--muted); line-height: 1.5; }
    .steps { display: grid; gap: 12px; margin: 0; padding: 0; list-style: none; }
    .steps li { display: flex; align-items: center; gap: 10px; color: var(--muted); font-size: 14px; }
    .dot { width: 12px; height: 12px; border: 2px solid #c8bbd8; border-radius: 999px; }
    .steps li.active { color: var(--text); font-weight: 700; }
    .steps li.active .dot { border-color: var(--purple); border-top-color: transparent; animation: spin 0.8s linear infinite; }
    .steps li.done .dot { border-color: #2d8e3e; background: #2d8e3e; }
    .error { display: none; margin-top: 20px; padding: 14px; color: #7a1d1d; background: #fff0f0; border: 1px solid #f1b8b8; border-radius: 6px; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <main class="loading-shell">
    <div class="brand">Baxley Consulting</div>
    <h1>Opening your proposal</h1>
    <p>Proposal ${safeProposalNumber} is loading. This usually takes a few seconds.</p>
    <ol class="steps" id="steps">
      <li class="active"><span class="dot"></span><span>Connecting to proposal data</span></li>
      <li><span class="dot"></span><span>Preparing the signing view</span></li>
      <li><span class="dot"></span><span>Loading the agreement</span></li>
    </ol>
    <div class="error" id="errorBox">The proposal took too long to load. Please refresh the page and try again.</div>
  </main>
  <script>
    const steps = Array.from(document.querySelectorAll('#steps li'));
    const markStep = (index) => {
      steps.forEach((step, stepIndex) => {
        step.classList.toggle('done', stepIndex < index);
        step.classList.toggle('active', stepIndex === index);
      });
    };

    const timers = [
      setTimeout(() => markStep(1), 900),
      setTimeout(() => markStep(2), 2400),
    ];

    fetch('${fetchUrl}', { headers: { Accept: 'text/html' }, cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error(await response.text());
        return response.text();
      })
      .then((html) => {
        timers.forEach(clearTimeout);
        document.open();
        document.write(html);
        document.close();
      })
      .catch((err) => {
        console.error(err);
        timers.forEach(clearTimeout);
        document.getElementById('errorBox').style.display = 'block';
      });
  </script>
</body>
</html>`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
