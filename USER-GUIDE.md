# Ledger — User Guide

This guide explains what Ledger does and how to use it day to day. It's meant to
stand on its own — you don't need to have read the code to follow it.

- New here and trying to *install* it? See [SETUP.md](./SETUP.md).
- Want the short pitch and file layout? See [README.md](./README.md).
- Curious what changed between releases? See [version-history/VERSIONS.md](./version-history/VERSIONS.md).

Everything below is about *using* the app once it's on your phone or laptop.

---

## The big picture

Ledger tracks money you spend, receive, and move around. Every entry you make is
a **transaction**. Transactions live inside **accounts**, can optionally be
collected into **groups**, and can be labelled with **tags**. Those four ideas
are the whole model — once they click, the rest of the app is just convenience
built on top.

Your data is a single file in your own Google Drive. There's no server and no
one else can see it. The app saves automatically a moment after each change, and
the little coloured dot in the top-right tells you the sync status (grey idle,
amber saving, green saved, red if something went wrong).

A 4-digit PIN guards the app every time you open it. That PIN is separate from
your Google sign-in — it's a quick local lock, not your account password.

---

## The four core ideas

### Transactions

A transaction is one movement of money. There are three kinds:

- **Expense** — money going out (a coffee, rent, a bus ticket).
- **Income** — money coming in (salary, a refund, a gift).
- **Transfer** — money moving between two of *your own* accounts (moving cash
  into your bank). A transfer isn't spending; it just relocates money, so it
  never counts as income or expense in your totals.

Tap the **+** button to add one. You pick the type, enter an amount and a short
note, choose the account, and optionally set a date, group, tags, and how it was
paid. Only the amount really matters; everything else is there when you want it.

### Accounts

An account is a bucket of money — think "Personal", "Cash", "Savings". Each has
its own running balance, and the app adds them all up into your **net worth**,
shown at the top of the Home screen.

You switch between accounts from the **side panel** (the ☰ menu in the header).
Moving money from one to another is a **transfer**, which keeps both balances
honest without inventing spending that didn't happen.

Create, rename, or close accounts in **Settings → Accounts**. Closing an account
that still has transactions will ask what to do with them (move them elsewhere or
delete them) so nothing silently disappears.

### Groups

A group is a *second* way to slice your money, cutting across accounts. Where an
account answers "which pocket did this come from," a group answers "what was this
*for*." Typical groups: a trip ("Goa trip"), an event ("Wedding"), a project, or
a housemate you split bills with.

An expense belongs to **at most one group** at a time. Groups are optional — most
everyday spending doesn't need one. Manage them in **Settings → Groups**, where
you can also tag every transaction in a group at once.

### Tags

Tags are free-form labels you stick on transactions: `food`, `travel`,
`reimbursable`, `work`, whatever suits you. Unlike groups, a transaction can have
**as many tags as you like**. You type them when adding an expense, and past tags
are suggested as you type so they stay consistent.

Tags are the backbone of the **Analyze** tab, where you can filter by one or
several at once. They're also how you switch on the optional *tag features*
described further down.

> **Groups vs. tags, quickly:** one group per transaction, many tags per
> transaction. Use a group for a bounded thing with a start and end (a trip). Use
> tags for recurring categories you'll want to total up later (all your `food`).

---

## The Home screen

Home is where you land. Top to bottom:

- **The header** holds a **menu button (☰)** on the left that opens the side
  panel, your **net worth** and the **current account's balance** side by side,
  a **sync dot**, and the light/dark toggle.
  - **Tap the net worth / balance figures to hide them behind dots** (`••••••`) —
    both hide and show together. The choice is remembered on that device, so they
    stay hidden until you tap again. Handy in public or on a shared screen.
- **Budget circles** — one ring per budget head with an active plan, showing how
  much is left this period. **Tap a circle** to see the exact expenses that make
  up its spend for the current period. (Set budgets up in Settings → Budgets.)
- **A search box** — start typing and the list narrows on every keystroke. It
  matches the **note** (type `lu` and both "Lunch" and "Luggage" stay) **and the
  amount** (type `500` to find ₹500, ₹1,500, or a ₹500 item in a combined entry).
  Clear it with the ×.
- **Date filter chips** — All, 7 days, 30 days, Month, or Custom. Custom reveals
  two date boxes for an exact range. Your search text and date choice **stick**
  even if you visit another tab and come back.
- **The transaction list** — newest first, showing the 15 most recent by default.
  If there are more, a **Show all** button at the bottom expands the full list
  (respecting whatever search and dates are active), and **Show less** collapses
  it again.

Two round buttons float above the bottom navigation: **+** (bottom-right area) to
add a transaction, and **⚙** (bottom-left) to jump to Settings.

### Switching accounts — the side panel

Accounts now live in the **side panel**: tap the **☰** menu button in the header.
The panel lists every account with its balance (also masked when you've hidden
balances), your trips, and a button to start a new trip. Tap an account to make it
active and return to Home; the list below then follows that account.

### Reading a row

Each row shows the note, the amount, and the date, plus small pills for its group
and tags. A 📎 means a receipt/invoice is attached; a 🧾 means a payment proof
is. Tap a row to expand it, where you'll find **Edit**, **Delete**, and buttons to
view any attached images. Entries made of several items show an "N items" pill and
expand to list them.

### Selecting several at once

Tap **Select** (top-right of the list). Rows grow checkboxes. Tick the ones you
want — or hit **Select all**, which selects everything in the *current* filtered
view. That last part matters: filter to last week first, then Select all, and you
get last week's transactions only, not your entire history.

With a selection made, three actions appear:

- **Tag** — add one or more tags to all of them at once.
- **Group** — drop them all into a group (existing or a new one you make on the
  spot). Since a transaction can only be in one group, if some already have a
  group you'll get a heads-up like *"2 of 5 selected already have a group (leaving
  Goa trip) — override with 'Office'?"* Confirm to override, or cancel to go back
  with your selection intact. Making a *brand-new* group skips this — there's
  nothing to override.
- **Account** — move them all into another account (or a new one). The account
  they're already in is shown but greyed out.

After any action completes, selection clears and you drop back to the normal list.
Tap **Done** any time to leave select mode.

---

## The Analyze tab

Analyze is for questions like "how much did I spend on food last month?" You
filter by account, group, type, payment mode, and date range, then optionally
click tags to narrow further. Three tag controls work together:

- **AND** — show transactions that have *all* the selected tags.
- **OR** — show transactions that have *any* of them.
- **NOT** — invert the result: show everything that *doesn't* match. It stays
  greyed out until you've picked at least one tag, then you can toggle it on.

NOT combines with AND/OR as a proper set operation. Select `hotel` and `food`
with AND, then turn on NOT, and you get everything that is *not* (hotel and food).
Switch to OR first and NOT gives you everything that's *neither* hotel nor food.
Handy for "show me everything except…" style questions.

Totals for income, expense, and net update as you filter. When a view is exactly
what you want, **export it as a PDF statement** — the NOT is reflected in the
statement's heading too — handy for reimbursements or just a record.

---

## The Owed tab

Some expenses are money you expect back — you covered a group dinner, or lent a
friend cash. Owed collects everything still outstanding so you can see who owes
what and mark things settled.

This only works for expenses tagged with a tag that has **repayment tracking**
switched on (see below). Once it's on, those expenses let you record partial or
full repayments over time, and the outstanding amount ticks down as money comes
back. You can also **write off** the remainder — accept what you've received as
final and forgive the rest — which drops the outstanding to zero without inventing
a repayment. It's fully reversible: reopen it any time from the Settled list.

---

## Settings and tag features

Settings has four sub-tabs — **Accounts**, **Groups**, **Tags**, and
**Budgets** — plus a **Trips** section, your Drive sync info, and a sign-out
button. (Reach Settings from the **⚙** button at the bottom-left of Home.)

**Tag features** (the Tags sub-tab) are optional powers you switch on *per tag*,
so a tag does more than just label. They stack freely (one tag can have several):

- **Repayment tracking** — expenses with this tag track money owed and received,
  and show up in the Owed tab.
- **Invoice attachment** — adds an option to attach a receipt/invoice image
  (stored in your Drive) to transactions with this tag.
- **Payment proof** — same idea, for a proof-of-payment image. A transaction can
  hold both an invoice and a proof.
- **Receiver tagging** — adds a "Receiver" field (who the money was for), shown in
  light grey next to the note.
- **Ghost tags** — the tag keeps powering any features above, but hides itself
  everywhere except the add/edit form. Useful for a tag you want working behind
  the scenes without cluttering your rows and exports.
- **Suppressed expenses** — an expense with this tag is treated as if the money
  never left your account: it's excluded from every total (account balances, net
  worth, group net spend, budgets, and Analyze) but stays fully visible, greyed,
  with a "suppressed" marker. Only expenses are affected.
- **Tag attribution (divide)** — adds a field to attribute only *part* of an
  amount to the tag. When Analyze slices by that single tag, the total counts just
  the attributed portion — the full amount is still shown with the attributed part
  greyed in brackets beside it (e.g. attribute ₹300 of a ₹500 spend → `500 (300)`,
  counts 300). Budget heads honour it too. Leave the field blank to count the full
  amount.
- **Secondary date** — gives the transaction a *second* date field, separate from
  the ledger date, for when a spend is logged on one day but belongs to another
  (a hangout, the real purchase date, etc.). You set the field's **label prefix**
  on the tag (e.g. "Hangout date" or "Actual expense date"); that label is what
  appears on the form and on the row afterwards. Purely informational — it never
  changes any totals.

## Budgets

A **budget head** is a spending category — "Food + Drink", "Transport" — defined
by a set of tags. Give a head one or more **plans** (an amount, how often it
renews, and a start date), then mark one **active**. The active plan shows as a
tappable **circle on Home** tracking net spend on the head's tags for the current
period; the ring empties as you spend and turns red if you go over.

Suppressed expenses don't count. If a tag with **attribution** is involved, the
head counts only the attributed share of that expense. Pick "None active" to keep
a head saved but hidden from Home. Manage all of this in **Settings → Budgets**.

## Trips

A **trip** is a self-contained tracker for a journey — multiple currencies,
shared wallets, members, and its own Home / Think / Analyze / Setup tabs, separate
from your main ledger. Open or create trips from the side panel (☰) or from the
Trips section in Settings. Inside a trip, the **⌂** button in the header (or the
trip picker's "Back to Ledger") returns you to the main app.

---

## Recording *how* you paid

When adding income or an expense, you can set a **payment mode**: cash, UPI, debit
card, credit card, or NEFT. It's optional and shows as muted text on the row.
Transfers don't take a mode.

A single transaction can even be **split across modes** — say ₹300 cash and ₹50
UPI on one bill. Negative amounts are allowed for things like card cashback, and
the app checks the parts add up to the total. Older entries simply show no mode
until you edit them; nothing breaks.

---

## Worked examples

**A quick coffee.** Tap **+**, choose Expense, enter `120`, note "Coffee", pick
the account, tap save. Done in seconds — skip everything else.

**A weekend trip.** Make a group "Goa trip" in Settings. As you spend, set each
expense's group to it (or add them all afterwards: on Home, **Select** the trip's
expenses and hit **Group → Goa trip**). Later, open Analyze, filter to that group,
and export a PDF of the whole trip's spending.

**Splitting a dinner you paid for.** Add the expense for the full amount. Give it a
tag like `reimbursable` that has **repayment tracking** on. As friends pay you
back, record each repayment. The Owed tab shows what's still outstanding until
it's settled.

**Tidying up last week.** On Home, set the date filter to **7 days**, then
**Select → Select all** to grab just that week. Add a `groceries` tag to all of
them, or move them into the right account, in one go.

**Everything except the trip.** In Analyze, select your `hotel` and `food` tags,
leave the mode on AND, and turn on **NOT** — you'll see all the spending that
*isn't* hotel-and-food, so you can total up the everyday stuff separately.

**Moving cash to the bank.** Add a **Transfer** from "Cash" to "Personal" for the
amount. Both balances adjust, and your net worth stays the same — because you
didn't spend anything, you just moved it.

---

## Good to know

- **It saves itself.** No save button — changes sync to Drive automatically. Watch
  the dot if you're unsure.
- **It works offline-ish.** It's a web app you can add to your home screen and open
  like a native one; it needs a connection to sync but the interface loads fast.
- **Your data is yours.** One JSON file in your Drive, receipts in a folder beside
  it. The app can only touch files it created — never the rest of your Drive.
- **Nothing is truly gone by accident.** Closing accounts or deleting groups always
  asks what happens to the transactions inside them first.
