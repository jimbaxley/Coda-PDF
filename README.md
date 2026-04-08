# Coda PDF — Proposal Generator

Fetches proposal data from Coda and renders it as a styled HTML page. From there you can edit inline and print to PDF, or send a signing link to your client.

---

## How It Works

```
Coda button → https://yourapp.vercel.app/?proposal=P-XXXXXX-XX
                → Vercel fetches Coda data → renders editable proposal page
                → Edit inline → Print / Save as PDF
                → "Send for Signing" → client signs → Coda row updated
```

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `CODA_API_TOKEN` | Your Coda API token (Settings → API) |
| `CODA_DOC_ID` | The doc ID from your Coda URL (e.g. `C-uztK2tfM`) |
| `BAXLEY_LOGO_URL` | Optional — URL to the white logo image for the header |

### 3. Deploy to Vercel

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → **New Project** → import the repo
3. When asked for a framework preset, select **Other**
4. Add environment variables in **Settings → Environment Variables**: `CODA_API_TOKEN`, `CODA_DOC_ID`
5. Deploy — copy the URL

### 4. Add a button in Coda

In your Proposals table, add a button column with this formula:

```
OpenWindow("https://YOUR-APP.vercel.app/?proposal=" & thisRow.[Proposal Number])
```

---

## Usage

### Editing and downloading a proposal

1. Click the Coda button on any proposal row
2. The proposal opens in your browser as an editable page
3. Click any **purple-highlighted field** to edit it inline (edits are saved automatically in your browser per proposal)
4. Drag and drop a screenshot into the **Add screenshot** zone to embed a budget table image
5. Click **Print / Save as PDF** → Chrome print dialog → **Save as PDF**

### Sending for e-signature

1. Open the proposal in the editor
2. Click **Send for Signing** in the toolbar — the signing link is copied to your clipboard
3. Paste the link into an email and send it to your client
4. The client opens the link, reads the proposal, types their name, and clicks **I Agree & Sign**
5. Their name appears in the signature block in handwriting font
6. They click **Download Signed Copy** to save a PDF
7. The Coda proposal row is automatically updated with `Signed By` and `Signed Date`

> **Coda setup:** Add two columns to your DB Proposals table — `Signed By` (text) and `Signed Date` (date/text) — so the webhook can write to them. You can then trigger Coda automations off those fields.

---

## Local PDF Generation (CLI)

To generate a PDF locally using Puppeteer (useful for batch exports):

```bash
node generate-proposal.js "P-XXXXXX-XX"
```

Output is saved to `output/`.

To test the web interface locally:

```bash
npx vercel dev
# then open http://localhost:3000/?proposal=P-XXXXXX-XX
```

---

## File Overview

| File | Purpose |
|---|---|
| `api/index.js` | Vercel serverless handler — fetches data, renders HTML |
| `api/signed.js` | POST webhook — receives signing event, updates Coda row |
| `editable-proposal.html` | Inline-editable proposal page with action bar |
| `sign-proposal.html` | Read-only signing page for clients |
| `lib/proposal.js` | Shared module — Coda data fetch + Handlebars render |
| `coda-client.js` | Coda REST API client |
| `generate-proposal.js` | CLI wrapper for local Puppeteer PDF export |
| `vercel.json` | Vercel function config |
