#!/usr/bin/env node
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const { fetchProposalData, renderHtml } = require('./lib/proposal');

async function main() {
  const proposalNumber = process.argv[2];
  if (!proposalNumber) {
    console.error('Usage: node generate-proposal.js <proposal-number>');
    console.error('Example: node generate-proposal.js "P-202647-105"');
    process.exit(1);
  }

  const templateData = await fetchProposalData(proposalNumber);
  const html = renderHtml(templateData, 'template.html');

  const outputDir = path.join(__dirname, 'output');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const safeName = (templateData.proposalName || proposalNumber)
    .replace(/[^a-zA-Z0-9-_ ]/g, '')
    .trim();
  const outputPath = path.join(outputDir, `${safeName}.pdf`);

  console.log('Generating PDF...');
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.pdf({
    path: outputPath,
    format: 'Letter',
    printBackground: true,
    margin: { top: '0.5in', bottom: '0.5in', left: '0.75in', right: '0.75in' },
  });
  await browser.close();

  console.log(`PDF saved to: ${outputPath}`);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
