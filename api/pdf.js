require('dotenv').config();

const { put } = require('@vercel/blob');
const { fetchProposalData, renderHtml, formatDateTime } = require('../lib/proposal');
const { makeDownloadUrl } = require('../lib/token');
const CodaClient = require('../coda-client');

const PROPOSALS_TABLE = 'grid-LW06aE88FS';
const LOOPS_TRANSACTIONAL_ID = 'cmnrez4my0fah0i035lpv2gkn';

// VERCEL_ENV is 'production' or 'preview' in real deployments, 'development' in vercel dev
const isServerless = (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'development')
  || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

async function launchBrowser() {
  if (isServerless) {
    const chromium = require('@sparticuz/chromium');
    const puppeteer = require('puppeteer-core');
    return puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });
  }
  const puppeteer = require('puppeteer');
  return puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
}

async function sendLoopsEmail(email, dataVariables) {
  const res = await fetch('https://app.loops.so/api/v1/transactional', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.LOOPS_API_KEY}`,
    },
    body: JSON.stringify({
      transactionalId: LOOPS_TRANSACTIONAL_ID,
      email,
      dataVariables,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.warn(`Loops email to ${email} failed:`, text);
  }
}

module.exports = async function handler(req, res) {
  // POST: signed data passed directly (avoids Coda propagation delay)
  // GET:  re-fetch everything from Coda (for already-signed revisits)
  const isPost = req.method === 'POST';
  const proposalNumber = isPost ? req.body?.proposalNumber : req.query.proposal;

  if (!proposalNumber) {
    return res.status(400).send('Missing proposal number');
  }

  try {
    const templateData = await fetchProposalData(proposalNumber);

    if (isPost && req.body) {
      const { signedBy, signedAt } = req.body;
      if (signedBy) templateData.signedBy = signedBy;
      if (signedAt) templateData.signedDate = formatDateTime(signedAt);
    }

    const html = renderHtml(templateData, 'sign-proposal.html');

    const browser = await launchBrowser();
    const page = await browser.newPage();
    // 816px = 8.5in at 96dpi — matches Letter width so page-wrapper fills edge to edge
    await page.setViewport({ width: 816, height: 1056, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'networkidle0' });

    await page.addStyleTag({
      content: `
        @page { margin: 0.4in 0 0 0; }
        @page :first { margin-top: 0; }
        html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
        .sign-panel-wrapper, .sign-banner { display: none !important; }
        .page-wrapper { margin: 0 !important; max-width: 100% !important; box-shadow: none !important; }
      `,
    });

    const pdf = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: { top: 0, bottom: 0, left: 0, right: 0 },
    });

    await browser.close();

    const proposalName = (templateData.proposalName || proposalNumber)
      .replace(/[^a-zA-Z0-9-_ ]/g, '')
      .trim();
    const filename = `Baxley Consulting | ${proposalName}.pdf`;

    // On POST (fresh signing): upload to blob, send emails, write URL back to Coda
    if (isPost) {
      try {
        // 1. Upload private blob
        const blob = await put(`pdfs/${proposalNumber}.pdf`, pdf, {
          access: 'private',
          contentType: 'application/pdf',
          allowOverwrite: true,
        });

        // 2. Build signed download URL
        const downloadUrl = makeDownloadUrl(proposalNumber);

        const emailVars = {
          signedBy: templateData.signedBy,
          docName: proposalName,
          signedDate: templateData.signedDate,
          docLink: downloadUrl,
        };

        // 3. Send emails + write URL to Coda in parallel
        await Promise.allSettled([
          // Email client
          templateData.clientEmail
            ? sendLoopsEmail(templateData.clientEmail, emailVars)
            : Promise.resolve(),
          // Email Jim
          sendLoopsEmail('jim@thebaxleys.org', emailVars),
          // Write blob URL + download URL to Coda row
          (async () => {
            const coda = new CodaClient(process.env.CODA_API_TOKEN, process.env.CODA_DOC_ID || 'C-uztK2tfM');
            const row = await coda.getRow(PROPOSALS_TABLE, { 'Proposal Number': proposalNumber });
            await coda.updateRow(PROPOSALS_TABLE, row.id, {
              'PDF Link': blob.url,
              'PDF Download URL': downloadUrl,
            });
          })(),
        ]);
      } catch (err) {
        // Non-fatal — PDF still returns to client
        console.error('Post-sign tasks failed:', err);
      }
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdf.length);
    res.status(200).end(pdf);
  } catch (err) {
    console.error('PDF generation failed:', err);
    res.status(500).send(err.message);
  }
};
