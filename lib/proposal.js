require('dotenv').config();

const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');
const { marked } = require('marked');  // v4 — CommonJS compatible
const CodaClient = require('../coda-client');

// Table IDs from the Coda doc
const TABLES = {
  proposals: 'grid-LW06aE88FS',
  clients: 'grid-duEAQ1ZCVp',
  lineItems: 'grid-qApSkKmhVO',
  packages: 'grid-cbdFb6oHI4',
};

// Baxley Consulting branding defaults (overridable via .env)
const BRANDING = {
  companyName: 'Baxley Consulting',
  tagline: 'Grow Smarter.',
  logoUrl: process.env.BAXLEY_LOGO_URL || '',
  address: '411 Longleaf Drive | Chapel Hill, NC 27517',
  email: 'laura@baxleyconsulting.com',
  phone: '919-274-2037',
  termsUrl: 'baxleyconsulting.com/terms',
  signatory: 'Laura Baxley',
};

async function fetchProposalData(proposalNumber) {
  const apiToken = process.env.CODA_API_TOKEN;
  const docId = process.env.CODA_DOC_ID || 'C-uztK2tfM';

  if (!apiToken) {
    throw new Error('Missing CODA_API_TOKEN.');
  }

  const coda = new CodaClient(apiToken, docId);

  const proposal = await coda.getRowByName(TABLES.proposals, {
    'Proposal Number': proposalNumber,
  });

  const [lineItems, packages] = await Promise.all([
    coda.getRowsByName(TABLES.lineItems, { 'Proposal Number': proposalNumber }),
    coda.getRowsByName(TABLES.packages, { 'Proposal Number': proposalNumber }),
  ]);

  const clientCompany = extractRich(proposal['Client']);
  const clientContact = extractRich(proposal['Contact']);
  const clientEmail = extractRichUrl(proposal['Email address']);
  const clientLogo = extractRichImage(proposal['Logo']);
  const coverImage = extractRichImage(proposal['Cover']);

  const openingTextHtml = richToHtml(proposal['Opening Text']);
  const imageBelow = extractRichImage(proposal['ImageBelow']);
  const specialTermsHtml = richToHtml(proposal['Special Terms']);
  const whatsNextHtml = richToHtml(proposal["What's Next"])
    || "<p>Once you're good with this proposal, use the signature section below to indicate your agreement. From there, we'll connect on the details of the deliverables we're working on with you.</p>";
  const thankYouHtml = richToHtml(proposal['Thank You'])
    || '<p>We are honored to work with you!</p>';

  const rawDate = proposal['Proposal Date'] || proposal['Date'] || '';
  const formattedDate = formatDate(rawDate);

  let total = 0;
  const formattedLineItems = lineItems.map((item) => {
    const cost = parseCurrency(item['Est. Cost']);
    total += cost;
    return {
      service: stripBackticks(extractString(item['Service'])),
      details: richToHtml(item['Details']),
      estCost: formatCurrency(cost),
    };
  });

  const formattedPackages = packages.map((pkg) => ({
    package: stripBackticks(extractString(pkg['Package'])),
    packageRate: stripBackticks(extractString(pkg['Package Rate'])),
  }));

  return {
    branding: { ...BRANDING },
    proposalName: stripBackticks(extractString(proposal['Proposal Name'])),
    proposalNumber: stripBackticks(extractString(proposal['Proposal Number'] || proposalNumber)),
    date: formattedDate,
    cover: coverImage,
    clientCompany,
    clientContact,
    clientEmail,
    clientPhone: '',
    clientLogo,
    openingText: openingTextHtml,
    imageBelow,
    lineItems: formattedLineItems,
    packages: formattedPackages,
    total: formatCurrency(total),
    specialTerms: specialTermsHtml,
    whatsNext: whatsNextHtml,
    thankYou: thankYouHtml,
    signedBy: stripBackticks(extractString(proposal['Signed By'])),
    signedDate: formatDateTime(proposal['Signed Date']),
    // Editable labels
    documentTitle: 'Proposal',
    totalLabel: 'Proposal Total:',
    termsLine: `Our relationship is governed by the Terms and Conditions at ${BRANDING.termsUrl}.`,
  };
}

function renderHtml(templateData, templateFile) {
  const templateSrc = fs.readFileSync(
    path.resolve(__dirname, '..', templateFile),
    'utf8'
  );
  const template = Handlebars.compile(templateSrc);
  return template(templateData);
}

// --- Helpers ---

function richToHtml(value) {
  if (!value) return '';
  if (typeof value === 'string') {
    let unwrapped = value.replace(/^```\n?/, '').replace(/\n?```$/, '');
    unwrapped = unwrapped.replace(/##_hidden_grid_##\s*\d*/g, '').trim();
    return marked.parse(unwrapped);
  }
  return String(value);
}

function parseCurrency(value) {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'object' && value.amount !== undefined) {
    return parseFloat(value.amount) || 0;
  }
  return parseFloat(String(value).replace(/[^0-9.-]/g, '')) || 0;
}

function extractString(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    return value.name || value.display || value.url || JSON.stringify(value);
  }
  return String(value);
}

function stripBackticks(str) {
  if (!str) return '';
  return str.replace(/^```\n?/, '').replace(/\n?```$/, '').trim();
}

function extractRich(value) {
  if (!value) return '';
  if (typeof value === 'string') return stripBackticks(value);
  if (Array.isArray(value) && value.length > 0) return value[0].name || '';
  if (typeof value === 'object') return value.name || '';
  return String(value);
}

function extractRichUrl(value) {
  if (!value) return '';
  if (typeof value === 'string') return stripBackticks(value);
  if (Array.isArray(value) && value.length > 0) return value[0].url || value[0].name || '';
  if (typeof value === 'object') return value.url || '';
  return String(value);
}

function extractRichImage(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && value.length > 0) return value[0].url || '';
  if (typeof value === 'object') return value.url || '';
  return '';
}

function formatDate(value) {
  if (!value) return '';
  const str = stripBackticks(typeof value === 'string' ? value : String(value));
  try {
    const d = new Date(str);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return str;
  }
}

function formatDateTime(value) {
  if (!value) return '';
  const str = stripBackticks(typeof value === 'string' ? value : String(value));
  try {
    const d = new Date(str);
    return d.toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
    });
  } catch {
    return str;
  }
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

module.exports = { fetchProposalData, renderHtml };
