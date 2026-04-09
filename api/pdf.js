require('dotenv').config();

const { fetchProposalData, renderHtml } = require('../lib/proposal');

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

module.exports = async function handler(req, res) {
  const proposalNumber = req.query.proposal;
  if (!proposalNumber) {
    return res.status(400).send('Missing ?proposal= parameter');
  }

  try {
    const templateData = await fetchProposalData(proposalNumber);
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

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdf.length);
    res.status(200).end(pdf);
  } catch (err) {
    console.error('PDF generation failed:', err);
    res.status(500).send(err.message);
  }
};
