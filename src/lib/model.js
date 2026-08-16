// model.js — pure data helpers, no UI, no Drive. Easy to test and reuse.

export const fmt = (n) => "₹" + Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });
export const todayISO = () => new Date().toISOString().slice(0, 10);
export const niceDate = (iso) => new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
export const uid = () => Math.random().toString(36).slice(2, 10);

// v2: payment modes. A transaction's `payments` is null/absent (mode not set —
// all v1 data) or an array [{ id, mode, amount }] whose amounts sum to the
// transaction amount. Negative amounts are allowed (e.g. cashback).
export const MODES = ["cash", "upi", "debit card", "credit card", "neft"];
export const modeShort = { cash: "cash", upi: "upi", "debit card": "debit", "credit card": "credit", neft: "neft" };
export const paymentsSum = (payments) => (payments || []).reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);

// v2: ghost tags — hidden everywhere except the add/edit form. These helpers
// are the single source of truth for "which tags does the UI show".
export const isGhost = (tag, tagConfig) => !!tagConfig?.[tag]?.ghost;
export const visibleTags = (tags, tagConfig) => (tags || []).filter((tg) => !isGhost(tg, tagConfig));

export const received = (x) => (x.repayments || []).reduce((s, r) => s + r.amount, 0);
export const outstanding = (x) => Math.max(0, (x.owed || 0) - received(x));
export const isRepayable = (x, tagConfig) => x.type === "expense" && x.tags.some((tg) => tagConfig[tg]?.repay);

// balances: combined entries need no special handling — x.amount is always the
// entry total (the sum of its items), so the math below is untouched from v1.
export function balanceOf(tx, accId) {
  let bal = 0;
  for (const x of tx) {
    if (x.type === "income" && x.account === accId) bal += x.amount;
    if (x.type === "expense" && x.account === accId) { bal -= x.amount; bal += received(x); }
    if (x.type === "transfer") {
      if (x.account === accId) bal -= x.amount;
      if (x.toAccount === accId) bal += x.amount;
    }
  }
  return bal;
}

// ── empty / default state for a brand-new user ────────────────────────────────
export function emptyState() {
  return {
    version: 2,
    accounts: [{ id: "a_" + uid(), name: "Personal", color: "#6366f1" }],
    groups: [],
    tagConfig: {},
    tx: [],
  };
}

// ── v1 → v2 → v3 migration ────────────────────────────────────────────────────
// Deliberately non-destructive: every new field is OPTIONAL, read with
// fallbacks throughout the UI. Migration normalizes top-level containers
// and bumps the version — it never rewrites a single transaction.
// Returns { data, fromV1, fromV2 } so the caller can write backups first.
export function migrateLedger(raw) {
  const data = { ...raw };
  data.accounts ||= [];
  data.groups ||= [];
  data.tagConfig ||= {};
  data.tx ||= [];
  const fromV1 = (data.version || 1) < 2;
  // v3: trips array — optional, defaults to empty
  data.trips ||= [];
  const fromV2 = (data.version || 1) === 2;
  data.version = 3;
  return { data, fromV1, fromV2 };
}

// ── Trip model helpers ────────────────────────────────────────────────────────

export const CURRENCY_SYMBOLS = {
  INR: "₹", USD: "$", VND: "₫", THB: "฿", EUR: "€", GBP: "£", JPY: "¥",
  SGD: "S$", MYR: "RM", AED: "د.إ", KRW: "₩", IDR: "Rp", PHP: "₱",
  CNY: "¥", HKD: "HK$", TWD: "NT$", BDT: "৳", LKR: "Rs", NPR: "Rs",
  AUD: "A$", NZD: "NZ$", CAD: "C$", CHF: "Fr",
};

export const fmtCurrency = (amount, cur) => {
  const sym = CURRENCY_SYMBOLS[cur] || (cur + " ");
  const abs = Math.abs(amount);
  const neg = amount < 0 ? "−" : "";
  if (cur === "VND" || cur === "KRW" || cur === "IDR")
    return neg + sym + abs.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (cur === "INR")
    return neg + sym + abs.toLocaleString("en-IN", { maximumFractionDigits: 2 });
  return neg + sym + abs.toLocaleString("en-US", { maximumFractionDigits: 2 });
};

// Rate storage: baselineRates is a flat map "FROM:TO" -> how many FROM per 1 TO.
// Adjacent currency pairs (order in trip.currencies) are the PRIMARY rates the
// user sets directly. Non-adjacent pairs are DERIVED by chaining through the
// primaries — unless the user has explicitly set/overridden them, in which case
// the stored value wins. This keeps the format 100% backward-compatible: old
// trips just have a flat map with every pair stored, which still resolves.

export function rateLink(a, b, rates) {
  // direct a-per-b along one hop
  if (rates[`${a}:${b}`] != null) return rates[`${a}:${b}`];
  if (rates[`${b}:${a}`] != null) return 1 / rates[`${b}:${a}`];
  return null;
}

// Resolve FROM-per-TO, chaining through the ordered currency list if needed.
export function resolveRate(fromCur, toCur, rates, currencies) {
  if (fromCur === toCur) return 1;
  // explicit (anchored) rate wins
  const direct = rateLink(fromCur, toCur, rates);
  if (direct != null) return direct;
  // chain through adjacency order
  if (!currencies || currencies.length === 0) return null;
  const fi = currencies.indexOf(fromCur), ti = currencies.indexOf(toCur);
  if (fi === -1 || ti === -1) return null;
  const step = fi < ti ? 1 : -1;
  let acc = 1;
  for (let i = fi; i !== ti; i += step) {
    const a = currencies[i], b = currencies[i + step];
    const r = rateLink(a, b, rates); // a-per-b
    if (r == null) return null;
    acc *= r;
  }
  return acc; // from-per-to
}

// True if the pair is stored explicitly (anchored) rather than derived.
export function isRateAnchored(fromCur, toCur, rates) {
  return rates[`${fromCur}:${toCur}`] != null || rates[`${toCur}:${fromCur}`] != null;
}

export function convertCurrency(amount, fromCur, toCur, rates, currencies) {
  if (fromCur === toCur) return amount;
  const rate = resolveRate(fromCur, toCur, rates, currencies); // from per to
  if (rate == null) return null;
  return amount / rate; // amount(from) / (from per to) = to
}

export function tripWalletBalances(walletId, txList) {
  const bals = {};
  for (const x of txList) {
    if (x.type === "fund-in" && x.wallet === walletId)
      bals[x.currency] = (bals[x.currency] || 0) + x.amount;
    if (x.type === "expense" && x.wallet === walletId)
      bals[x.currency] = (bals[x.currency] || 0) - x.amount;
    if (x.type === "exchange" && x.wallet === walletId) {
      bals[x.fromCurrency] = (bals[x.fromCurrency] || 0) - x.fromAmount;
      bals[x.toCurrency] = (bals[x.toCurrency] || 0) + x.toAmount;
    }
    if (x.type === "transfer") {
      if (x.fromWallet === walletId) bals[x.currency] = (bals[x.currency] || 0) - x.amount;
      if (x.toWallet === walletId) bals[x.currency] = (bals[x.currency] || 0) + x.amount;
    }
  }
  return bals;
}

// Deterministic color for a wallet, by its index in the trip's wallet list.
export const WALLET_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#06b6d4", "#8b5cf6", "#14b8a6"];
export function walletColor(trip, walletId) {
  const i = trip.wallets.findIndex((w) => w.id === walletId);
  if (i === -1) return "#8a8d96";
  if (trip.wallets[i].type === "pool") return WALLET_COLORS[0];
  return WALLET_COLORS[i % WALLET_COLORS.length];
}

export function emptyTrip(name) {
  return {
    id: "t_" + uid(), name: name || "New Trip", status: "active",
    startDate: todayISO(), endDate: "",
    baseCurrency: "INR", currencies: ["INR"], baselineRates: {},
    members: [],
    wallets: [{ id: "w_pool_" + uid(), name: "Pool", type: "pool", paymentModes: ["Cash"] }],
    groups: [], tagConfig: {}, tx: [], planned: [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// IMPORT ENTRY POINT — the single doorway for any future integration.
//
// UPI-screenshot OCR, Splitwise sync, bank CSV import — every one of them should
// produce an array of partial transactions and hand it here. This normalizes
// them into real transactions (filling ids, defaults) so the rest of the app
// never needs to know where the data came from.
//
// Each partial may include: { type, amount, account, group, note, tags, date,
// owed, payments, items, receiver, proof }. Missing fields get sensible defaults.
// ─────────────────────────────────────────────────────────────────────────────
export function importTransactions(partials, { defaultAccount }) {
  return partials.map((p) => ({
    id: uid(),
    type: p.type || "expense",
    amount: Number(p.amount) || 0,
    account: p.account || defaultAccount,
    toAccount: p.toAccount,
    group: p.group ?? null,
    note: p.note || "",
    tags: Array.isArray(p.tags) ? p.tags : [],
    date: p.date || todayISO(),
    owed: p.owed || 0,
    invoice: p.invoice || null,
    repayments: p.repayments || [],
    payments: Array.isArray(p.payments) && p.payments.length ? p.payments : null, // v2
    items: Array.isArray(p.items) && p.items.length ? p.items : null,             // v2
    receiver: p.receiver || null,                                                  // v2
    proof: p.proof || null,                                                        // v2
    source: p.source || "import", // provenance, handy for dedup later
  }));
}