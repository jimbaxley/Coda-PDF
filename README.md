# Coda PDF — Proposal Generator

Fetches proposal data from a Coda doc and renders it as a styled, signable HTML proposal. Clients sign online; a PDF is generated server-side, stored privately, and emailed automatically.

---

## How It Works

```
Coda button → sign.baxleyconsulting.com/?proposal=P-XXXXXX-XX
  → Vercel fetches Coda data → renders editable proposal page

  "Copy Signing Link" → client opens ?mode=sign URL
  → Client types name → clicks "I Agree & Sign"
  → Simultaneously:
      • Coda row updated (Signed By, Signed Date)
      • Puppeteer generates signed PDF
      • PDF uploaded to private Vercel Blob
      • HMAC-signed download link generated
      • Loops.so email sent to client + Jim
      • Coda row updated (PDF Link, PDF Download URL)
  → Client gets "Download Signed Copy" immediately from browser blob
  → Email link hits /api/download → validates token → proxies private PDF
```

---

## Environment Variables

| Variable | Description |
|---|---|
| `CODA_API_TOKEN` | Coda API token (Settings → API) |
| `CODA_DOC_ID` | Doc ID from your Coda URL (e.g. `C-uztK2tfM`) |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob token (Dashboard → Storage → Blob) |
| `LOOPS_API_KEY` | Loops.so API key |
| `PDF_HMAC_SECRET` | Random 32-byte hex string — signs download URLs |
| `APP_BASE_URL` | Base URL for download links. Defaults to `https://sign.baxleyconsulting.com`. Set to `http://localhost:3000` for local testing. |
| `BAXLEY_LOGO_URL` | Optional — URL to white logo image for the proposal header |

---

## Coda Table Setup

### DB Proposals columns required

| Column | Type | Purpose |
|---|---|---|
| `Proposal Number` | Text | Primary key used in all lookups |
| `Proposal Name` | Text | Shown in page title and PDF filename |
| `Proposal Date` | Date | Shown on proposal header |
| `Client` | Text / Lookup | Client company name |
| `Contact` | Text / Lookup | Client contact name |
| `Email address` | Text | Client email — receives signed PDF notification |
| `Logo` | Image | Client logo |
| `Cover` | Image | Cover/header image |
| `Opening Text` | Long text (markdown) | Proposal body |
| `ImageBelow` | Image | Optional image below opening text |
| `Special Terms` | Long text (markdown) | Optional additional terms |
| `What's Next` | Long text (markdown) | Optional next steps section |
| `Thank You` | Long text (markdown) | Optional closing note |
| `Our Signer` | Text | Baxley Consulting signatory name (defaults to "Laura Baxley") |
| `Our Signed Date` | Date/Text | Date shown under our signature |
| `Signed By` | Text | Written by webhook when client signs |
| `Signed Date` | Date/Text | Written by webhook when client signs |
| `PDF Link` | Text | Private Vercel Blob URL (written after signing) |
| `PDF Download URL` | Text | HMAC-signed public download link (written after signing) |

### DB Line Items columns required

`Proposal Number`, `Service`, `Details`, `Est. Cost`

### DB Packages columns required

`Proposal Number`, `Package`, `Package Rate`

---

## Local Development

```bash
npm install
cp .env .env.local   # or set APP_BASE_URL=http://localhost:3000 in .env
npx vercel dev
# open http://localhost:3000/?proposal=P-XXXXXX-XX
```

---

## Deployment

1. Push to GitHub
2. Import to [vercel.com](https://vercel.com) → framework preset: **Other**
3. Add all environment variables in **Settings → Environment Variables**
4. Enable **Vercel Blob** storage (Dashboard → Storage → Create Blob Store)
5. Deploy

In Coda, add a button column to your Proposals table:
```
OpenWindow("https://sign.baxleyconsulting.com/?proposal=" & thisRow.[Proposal Number])
```

---

## File Overview

| File | Purpose |
|---|---|
| `api/index.js` | Main handler — fetches Coda data, renders proposal HTML |
| `api/signed.js` | POST — receives signing event, writes Signed By + Signed Date to Coda |
| `api/pdf.js` | GET/POST — generates signed PDF via Puppeteer, uploads to Blob, sends emails |
| `api/download.js` | GET — validates HMAC token, proxies private blob as file download |
| `lib/proposal.js` | Coda data fetch, Handlebars render, formatting helpers |
| `lib/token.js` | HMAC token generation and validation for download URLs |
| `coda-client.js` | Coda REST API client |
| `sign-proposal.html` | Client-facing signing page |
| `editable-proposal.html` | Internal proposal preview with toolbar |
| `template.html` | Clean template used by CLI PDF generator |
| `generate-proposal.js` | CLI tool — generates PDF locally via Puppeteer |
| `vercel.json` | Vercel function config (timeouts, memory, file includes) |

---

## CLI PDF Generation

```bash
node generate-proposal.js "P-XXXXXX-XX"
# Output saved to output/
```
