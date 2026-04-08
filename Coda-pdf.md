# Coda Proposal → PDF: API-Based Solution Plan

## The Problem

The Proposal page in Coda (`/d/_dC-uztK2tfM/Proposal_su6cec1Y`) cannot print/export to PDF cleanly because of three fundamental rendering limitations:

1. **Table views don't break across pages** — even filtered to a single row, Coda wraps table/view blocks in a scroll container that no CSS `page-break` property can escape
2. **Formula blocks have the same issue** — dynamic content blocks are treated as atomic elements by Coda's print/PDF engine
3. **Embedded tables inside canvas fields render as a collapsed "⊞ Grid" chip** — they don't display at all outside their native edit context (e.g., the budget spend table inside Opening Text)

These are not fixable via CSS tweaks, CloudConvert settings, or layout changes.

---

## The Solution: Coda API → HTML Template → PDF

Pull proposal data directly from the Coda REST API, render it in a clean HTML template, and convert to PDF using Puppeteer. This bypasses Coda's rendering pipeline entirely.

---

## Data Sources (from Coda doc `C-uztK2tfM`)

| Data | Table | Key Fields |
|------|-------|------------|
| Proposal metadata | `DB Proposals` (`grid-LW06aE88FS`) | Proposal Name, Proposal Number, Date, Opening Text, Special Terms, Cover |
| Client info | `Logo / Clients` (`grid-duEAQ1ZCVp`) | Company, Logo, Address, Contact, Email, Phone |
| Line items | `ALACARTE PROPOSAL ITEMS` (`grid-qApSkKmhVO`) | Service, Details, Est. Cost, Rate Type, # |
| Packages | `DB Proposal Packages` (`grid-cbdFb6oHI4`) | Package, Package Rate |

---

## Build Plan

### Step 1 — Get Coda API Token
- Go to coda.io/account → API → Generate token
- Store as environment variable: `CODA_API_TOKEN`

### Step 2 — Node.js Script (`generate-proposal.js`)

```bash
node generate-proposal.js "P-202647-105"
```

Script flow:
1. Accept proposal number as CLI arg
2. Fetch matching row from DB Proposals via API
3. Fetch related client info, line items, packages
4. Parse canvas field content (including embedded tables like the budget grid)
5. Inject all data into HTML template
6. Use Puppeteer to render and save PDF

### Step 3 — HTML Template
- Match current proposal branding (Montserrat font, existing margins)
- Render Opening Text as flowing HTML — text breaks across pages naturally
- Render embedded budget table as a proper `<table>` element
- Render line items as a styled table with totals
- Include client logo, contact block, special terms

### Step 4 — PDF Output Options
- Save locally to `/Baxley Consulting/Proposals/[Proposal Name].pdf`
- Optionally upload back to Coda via API into the `Results` column

---

## Key API Endpoint

```
GET https://coda.io/apis/v1/docs/C-uztK2tfM/tables/{tableId}/rows
  ?query={"Proposal Number": "P-XXXXXXXX-XX"}
  Authorization: Bearer $CODA_API_TOKEN
```

Canvas fields return structured JSON with text blocks and embedded table data — the embedded budget grid will be accessible as structured data, not a collapsed chip.

---

## Dependencies

```bash
npm install puppeteer node-fetch dotenv
```

| Package | Purpose |
|---------|---------|
| `puppeteer` | Headless Chrome → PDF rendering |
| `node-fetch` | Coda API calls |
| `dotenv` | API token management |

**Cost: $0** — all open source, runs locally.

---

## Issues This Solves

- ✅ Page breaks work — HTML flows naturally
- ✅ Opening Text displays and paginates correctly
- ✅ Embedded budget table renders as a real table (not a Grid chip)
- ✅ No Coda print/CloudConvert dependency
- ✅ Full styling control

---

## Open Questions Before Building

- [ ] À la carte proposals only, or packages too?
- [ ] Save PDF locally, upload back to Coda, or both?
- [ ] Get Coda API token
- [ ] Test against a real proposal (e.g., Nicholson Tutoring `P-20241117-32`)