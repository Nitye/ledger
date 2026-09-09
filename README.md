# Ledger

A personal, local-first finance tracker. Your data lives in *your* Google Drive
as a single JSON file — no database, no server, no fees, synced across phone and
laptop.

**Features**
- Accounts (money buckets) with transfers between them
- Groups (project/event collections) as a second axis
- Freeform tags, with multi-tag AND/OR/NOT analysis
- Configurable tag features — repayment tracking, invoice/proof attachment, receiver tagging, ghost tags, suppressed expenses, tag attribution (divide an amount across tags), and a labelled secondary date
- Owed tab: what's outstanding, one-tap "paid in full", write-off of the remainder
- Budgets: recurring per-category spend limits shown as tappable circles on Home
- Trips: a separate multi-currency, multi-wallet trip tracker with its own analysis
- Left side panel for switching accounts and opening trips
- Payment modes and split payments; combined multi-item entries
- Hide net worth & balances behind dots (remembered per device)
- Invoice/receipt upload to a Drive folder (optional compression)
- PDF statement export of any filtered view
- 4-digit PIN gate, light/dark mode
- Installs to your home screen like a native app

**→ See [SETUP.md](./SETUP.md) to get it running.** Takes about 30 minutes, once.

**Built to extend.** Future integrations (UPI-screenshot OCR, Splitwise, bank CSV)
feed through one entry point: `importTransactions()` in `src/lib/model.js`.

## Project layout
```
src/
  App.jsx              app shell, Drive sync, view routing
  lib/
    config.js          ← paste your Google Client ID here
    drive.js           all Google Drive calls (auth, load/save, receipts)
    model.js           data helpers + importTransactions() entry point
    pdf.js             PDF statement export
    pin.js             local PIN gate
    ui.jsx             theme + shared UI bits
  components/
    PinGate.jsx
    TxForm.jsx         add/edit transaction + receipt upload
    Views.jsx          Home, Analyze, Owed, Settings, SidePanel, budgets, InvoiceViewer
    TripManager.jsx    self-contained multi-currency trip tracker
```
