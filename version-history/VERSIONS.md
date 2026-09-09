# Ledger — Version History

Ledger is a self-hosted personal finance tracker. It runs entirely in the
browser (Vite + React on GitHub Pages) with no backend — all data lives in a
single JSON file in the owner's own Google Drive.

---

## v3 — September 2026

**Data schema:** `version: 3`. Backward compatible with v1/v2 — migration only
normalizes top-level containers (`budgets`, `trips`) and bumps the version; no
transaction is rewritten, and every new field is optional. Before the first v3
save on v2 data, a one-time safety copy is written to Drive as
`ledger-data-backup-v2.json`.

### New features

- **Budgets** — recurring per-category spend limits. A *budget head* is defined
  by a set of tags and carries one or more *plans* (amount + renewal period +
  start date); one plan can be marked active. The active plan renders as a
  circle on Home showing net spend for the current period. **Tapping a circle**
  opens the exact expenses making up that period's spend. Suppressed expenses
  are excluded; tag attribution is honoured.
- **Trips** — a self-contained trip tracker (`TripManager.jsx`) with multiple
  currencies and chained exchange rates, shared wallets, members, planned
  spending, and its own Home / Think / Analyze / Setup tabs. Opened from the
  side panel or Settings; a **home (⌂) button** in the trip header returns to
  the main ledger.
- **Side panel** — a left drawer (☰ in the header) for switching accounts and
  opening/creating trips. Accounts moved here from the old Home cards.
- **Suppressed expenses** *(tag feature)* — an expense with an enabled tag is
  excluded from every total (balances, net worth, group spend, budgets, Analyze)
  as if the money never left, while staying fully visible (greyed, marked
  "suppressed") including in PDF exports.
- **Tag attribution / "divide"** *(tag feature)* — a tag can hold a partial
  share of a transaction's amount. When Analyze slices by that single tag, only
  the attributed portion counts toward totals; the full amount is shown with the
  attributed part greyed in brackets (e.g. `500 (300)`). Budget heads count the
  attributed share too.
- **Secondary date** *(tag feature)* — a tag can add a second, separately
  labelled date field (e.g. "Hangout date") for spends logged on one day but
  belonging to another. The label prefix is set per tag in Settings; the value
  is purely informational and never affects totals.
- **Owed write-off** — the outstanding remainder of a repayable expense can be
  forgiven, dropping outstanding to zero without a phantom repayment. Fully
  reversible via a reopen button in the Settled list.
- **Hide balances** — tapping the net worth / account balance in the header
  masks both behind dots. The preference is remembered per device (localStorage)
  and also masks account balances in the side panel.

### Improvements & fixes

- **Home search matches amounts** — the search box now matches on amount as well
  as note (digits are compared against the entry total and any combined-entry
  item amounts).
- **Responsive net worth header** — the net worth and account figures scale down
  on narrow screens instead of overflowing.
- **Settings reachable from Home** — a ⚙ button at the bottom-left; Settings
  gained a Budgets sub-tab and a Trips section.

---

## v2 — July 2026

**Data schema:** `version: 2`. Fully backward compatible with v1 — every new
field is additive and optional, and no existing transaction is rewritten on
upgrade. Before the first v2 save, the app writes a one-time safety copy of the
v1 data to Drive as `ledger-data-backup-v1.json`.

### New features

- **Payment modes** — income and expenses can record how they were paid:
  cash, UPI, debit card, credit card, or NEFT. Shown as muted text on
  transaction rows. Transfers don't carry a mode. Older entries simply show no
  mode until edited.
- **Split payments** — one transaction can be paid through multiple modes
  (e.g. ₹300 cash + ₹50 UPI). Negative amounts are supported for cases like
  card cashback, with live validation that the splits sum to the total.
- **Combined multi-item entries** — a single expense can contain a list of
  items (e.g. a day out: auto ₹120, lunch ₹400, snacks ₹80) that appears as
  one row for the entry total and expands on tap to show the items. Tags,
  payment split, and repayment tracking apply to the entry as a whole.
- **Receiver tagging** *(tag feature)* — tags can enable a Receiver field
  recording who the money was for; the name shows in light grey next to the
  note.
- **Payment proof tracking** *(tag feature)* — same mechanics as invoice
  attachment: tags can enable attaching a payment-proof image, stored in
  Drive. A transaction can carry both an invoice and a proof.
- **Ghost tags** *(tag feature)* — tags that stay attached to transactions and
  keep powering any other features enabled on them, but are hidden on Home, in
  Analyze (including tag slicing), and in PDF exports. Visible only in the
  add/edit form. Features stack, so one tag can be e.g. ghost + proof.
- **Home search, date filter, and multi-select** — Home became a working list
  rather than a static feed:
  - A **note search** box that matches as you type (typing `lu` keeps both
    "Lunch" and "Luggage"; deleting a character re-widens live).
  - A **date filter** — All / 7 days / 30 days / Month / Custom — on a single
    row. Search text and date range **persist** across tab changes.
  - The list shows the **15 most recent** by default with a **Show all / Show
    less** toggle that respects the active search and date slice.
  - **Multi-select** with checkboxes and a Select-all that operates on the
    *filtered* slice only (filter to last week, Select all, get last week).
    Selected transactions can be bulk **tagged**, **added to a group**, or
    **moved to another account** — each via a picker that can also create a new
    group/account inline. Adding to a group that some selected already belong to
    prompts an override confirmation (an expense can only be in one group); a
    brand-new group skips the prompt. Actions clear the selection when done.

### Improvements & fixes

- **Silent relogin fixed for devices with multiple Google accounts** — the app
  now remembers which Google account it's linked to and passes it as a login
  hint, so re-authentication is truly silent instead of showing the account
  chooser on every open. Settings shows the connected account's email.
- **Home list is date-sorted** — transactions display newest-first by date
  rather than in the order they were added.
- **Analyze can filter by payment mode** — a new dropdown alongside account,
  group, and type filters, including a "No mode set" option that surfaces
  pre-v2 entries. When filtering by a specific mode, split payments count only
  that mode's share of the amount.
- **Analyze NOT filter** — a NOT toggle alongside AND/OR inverts the tag match,
  so you can slice for everything that *doesn't* fit a tag combination (e.g.
  NOT (hotel AND food)). Greyed out until a tag is selected; combines with
  AND/OR as a set operation and is reflected in exported PDF headings.
- **PDF statements** gained a payment-mode column (shown only when mode data
  exists), list the items of combined entries, and include receiver names.

---

## v1 — Initial release

The complete foundation, still the core of the app today.

### Core

- **Transactions** — expenses, income, and transfers between accounts, each
  with amount, note, date, account, optional group, and free-form tags.
- **Multiple accounts** with per-account balances; transfers move money
  between them.
- **Groups** — long-running buckets (a trip, a project) that transactions can
  belong to, with per-group filtering and bulk add.
- **Tags** — lightweight labels with autocomplete, used for slicing and for
  enabling tag features.

### Tag features (configurable in Settings, per tag)

- **Repayment tracking** — expenses with an enabled tag record how much is
  owed back, log partial repayments, and appear in the Owed tab until settled.
- **Invoice attachment** — transactions with an enabled tag can attach a
  receipt/invoice image (with optional compression), stored in a dedicated
  Drive folder.

### Analysis & export

- **Analyze tab** — filter by account, group, transaction type, date range,
  and tag combinations (AND/OR), with income/spend/net totals.
- **PDF statements** — export any filtered view as a lean PDF, including
  owed/repaid columns when relevant.

### Platform & security

- **No backend** — static site on GitHub Pages; all data in a single
  `ledger-data.json` in the owner's Google Drive using the most restrictive
  `drive.file` scope (the app can only ever see files it created itself).
- **Google sign-in** via Google Identity Services token flow, entirely
  in-browser, with silent re-auth on return visits.
- **PIN gate** on every open for on-device privacy.
- **Cross-device** — works on mobile and desktop, syncing through the same
  Drive file.
