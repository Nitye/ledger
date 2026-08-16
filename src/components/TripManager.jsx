// ─────────────────────────────────────────────────────────────────────────────
// TripManager.jsx — v3 Trip Manager
//
// A fully self-contained parallel workstream for managing trip expenses across
// multiple currencies and wallets. Rendered by App.jsx when activeTripId is set.
// Completely independent from the main ledger — shares only the theme and
// Drive auto-save (via the same data object).
//
// Data model:
//   Each trip lives inside data.trips[]. The trip object owns its own wallets,
//   groups, tagConfig, transactions (tx), planned expenses, currencies, and
//   baseline exchange rates. Nothing here touches the main ledger's accounts,
//   groups, or transactions.
//
// Transaction types (trip-scoped):
//   expense   — money leaves a wallet in a single currency
//   fund-in   — money enters a wallet from outside the trip
//   transfer  — wallet ↔ wallet, same currency
//   exchange  — converts one currency to another within a wallet, at a rate
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Modal, Seg, Stat, Toggle, COLORS, pill, inp, sel, lbl, primaryBtn, secondaryBtn, miniBtn, styles } from "../lib/ui.jsx";
import { uid, todayISO, niceDate, fmtCurrency, convertCurrency, resolveRate, isRateAnchored, walletColor, tripWalletBalances, emptyTrip, visibleTags, isGhost } from "../lib/model";

// ── Shared helpers ──────────────────────────────────────────────────────────

function SyncDot({ t, state }) {
  const map = { idle: [t.dim, ""], saving: [t.amber, "saving"], saved: [t.green, "saved"], error: [t.red, "sync error"] };
  const [c, label] = map[state] || map.idle;
  return <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: t.dim }}>
    <span style={{ width: 7, height: 7, borderRadius: "50%", background: c }} />{label}
  </div>;
}

// ── TRIP TX ROW (extracted to avoid hooks-in-map) ───────────────────────────

function TripTxRow({ x, t, trip, txIcon, txColor, groupName, showWallet, onEdit, onDelete }) {
  const [open, setOpen] = useState(false);
  const ownerId = x.wallet || x.fromWallet;
  const barColor = walletColor(trip, ownerId);
  const ownerName = trip.wallets.find((w) => w.id === ownerId)?.name;
  const toName = x.type === "transfer" ? trip.wallets.find((w) => w.id === x.toWallet)?.name : null;
  return (
    <div onClick={() => setOpen(!open)} style={{ display: "flex", alignItems: "stretch", marginBottom: 6, borderRadius: 12, overflow: "hidden", background: t.card, border: `1px solid ${t.line}`, cursor: "pointer" }}>
      <div style={{ width: 4, background: barColor, flexShrink: 0 }} />
      <div style={{ flex: 1, padding: "12px 14px", minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: txColor(x) + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: txColor(x), flexShrink: 0 }}>
            {txIcon(x)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.note || x.type}</div>
            <div style={{ fontSize: 12, color: t.dim, display: "flex", gap: 6, flexWrap: "wrap", marginTop: 2, alignItems: "center" }}>
              <span>{niceDate(x.date)}</span>
              {showWallet && ownerName && <span style={{ color: barColor }}>{ownerName}{toName ? ` → ${toName}` : ""}</span>}
              {x.city && <span style={pill(t)}>{x.city}</span>}
              {x.group && <span style={{ ...pill(t), background: (trip.groups.find((g) => g.id === x.group)?.color || t.dim) + "22", color: trip.groups.find((g) => g.id === x.group)?.color || t.dim }}>{groupName(x.group)}</span>}
              {x.paymentMode && <span style={pill(t)}>{x.paymentMode}</span>}
              {visibleTags(x.tags || [], trip.tagConfig || {}).map((tag) => <span key={tag} style={pill(t)}>{tag}</span>)}
            </div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            {x.type === "exchange" ? (
              <div>
                <div style={{ fontSize: 13, color: t.red }}>−{fmtCurrency(x.fromAmount, x.fromCurrency)}</div>
                <div style={{ fontSize: 13, color: t.green }}>+{fmtCurrency(x.toAmount, x.toCurrency)}</div>
              </div>
            ) : (
              <div style={{ fontSize: 15, fontWeight: 700, color: x.type === "expense" ? t.red : x.type === "fund-in" ? t.green : t.text }}>
                {x.type === "expense" ? "−" : x.type === "fund-in" ? "+" : ""}{fmtCurrency(x.amount, x.currency)}
              </div>
            )}
          </div>
        </div>
        {open && (
          <div style={{ display: "flex", gap: 8, marginTop: 10 }} onClick={(e) => e.stopPropagation()}>
            <button style={miniBtn(t)} onClick={onEdit}>Edit</button>
            <button style={{ ...miniBtn(t), color: t.red, borderColor: t.red + "55" }} onClick={onDelete}>Delete</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── TRIP HOME ───────────────────────────────────────────────────────────────

function TripHome({ t, trip, setTrip }) {
  const [selWallet, setSelWallet] = useState("all"); // "all" or a wallet id
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const isAll = selWallet === "all";
  const wallet = trip.wallets.find((w) => w.id === selWallet);
  const bals = useMemo(() => isAll ? null : tripWalletBalances(selWallet, trip.tx), [selWallet, trip.tx, isAll]);

  const feed = useMemo(() => {
    let rows = trip.tx;
    if (!isAll) rows = rows.filter((x) => x.wallet === selWallet || x.fromWallet === selWallet || x.toWallet === selWallet);
    return [...rows].sort((a, b) => b.date.localeCompare(a.date));
  }, [trip.tx, selWallet, isAll]);

  const groupName = (gId) => trip.groups.find((g) => g.id === gId)?.name;
  const txIcon = (x) => ({ expense: "↓", "fund-in": "↑", exchange: "⇄", transfer: "→" }[x.type] || "·");
  const txColor = (x) => ({ expense: t.red, "fund-in": t.green, exchange: t.amber, transfer: t.accent }[x.type] || t.dim);

  const saveTx = (item) => {
    setTrip((prev) => {
      const ex = prev.tx.find((p) => p.id === item.id);
      return { ...prev, tx: ex ? prev.tx.map((p) => p.id === item.id ? item : p) : [item, ...prev.tx] };
    });
    setShowForm(false);
    setEditing(null);
  };
  const deleteTx = (id) => setTrip((prev) => ({ ...prev, tx: prev.tx.filter((p) => p.id !== id) }));

  return (
    <div>
      {/* wallet selector — All wallets first, then each wallet */}
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, marginBottom: 12 }}>
        <button onClick={() => setSelWallet("all")} style={{
          flexShrink: 0, padding: "10px 16px", borderRadius: 14, cursor: "pointer", textAlign: "left",
          border: `1px solid ${isAll ? t.accent : t.line}`, background: isAll ? t.accent + "22" : t.card, color: t.text,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>All wallets</div>
          <div style={{ fontSize: 11, color: t.dim, marginTop: 2 }}>{trip.tx.length} txns</div>
        </button>
        {trip.wallets.map((w) => {
          const active = w.id === selWallet;
          const color = walletColor(trip, w.id);
          const wBals = tripWalletBalances(w.id, trip.tx);
          const entries = Object.entries(wBals).filter(([, v]) => Math.abs(v) > 0.001);
          return (
            <button key={w.id} onClick={() => setSelWallet(w.id)} style={{
              flexShrink: 0, padding: "10px 14px", borderRadius: 14, cursor: "pointer", minWidth: 110, textAlign: "left",
              border: `1px solid ${active ? color : t.line}`, background: active ? color + "22" : t.card, color: t.text,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
                <span style={{ fontSize: 13, color: t.dim }}>{w.name}</span>
                {w.type === "pool" && <span style={{ ...pill(t), fontSize: 9, padding: "1px 6px" }}>POOL</span>}
              </div>
              <div style={{ marginTop: 6 }}>
                {entries.length === 0 && <div style={{ fontSize: 14, color: t.dim }}>Empty</div>}
                {entries.map(([cur, amt]) => (
                  <div key={cur} style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.4 }}>{fmtCurrency(amt, cur)}</div>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {/* balance card — only for a specific wallet */}
      {!isAll && (
        <div style={{ padding: 16, borderRadius: 14, background: t.card, border: `1px solid ${t.line}`, marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: t.dim, letterSpacing: 0.5, marginBottom: 10 }}>{wallet?.name} — BALANCES</div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {Object.entries(bals).filter(([, v]) => Math.abs(v) > 0.001).map(([cur, amt]) => (
              <div key={cur} style={{ minWidth: 80 }}>
                <div style={{ fontSize: 11, color: t.dim }}>{cur}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: amt >= 0 ? t.green : t.red }}>{fmtCurrency(amt, cur)}</div>
              </div>
            ))}
            {Object.keys(bals).filter((k) => Math.abs(bals[k]) > 0.001).length === 0 && (
              <div style={{ color: t.dim, fontSize: 14 }}>No balances yet</div>
            )}
          </div>
        </div>
      )}

      {/* unified transaction feed */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 12, color: t.dim, letterSpacing: 0.5 }}>
          {isAll ? "ALL TRANSACTIONS" : (wallet?.name || "").toUpperCase()} · {feed.length}
        </div>
        {!isAll && <button onClick={() => setSelWallet("all")} style={{ ...pill(t), cursor: "pointer", color: t.accent }}>show all</button>}
      </div>
      {feed.map((x) => (
        <TripTxRow key={x.id} x={x} t={t} trip={trip} txIcon={txIcon} txColor={txColor} groupName={groupName} showWallet={isAll}
          onEdit={() => { setEditing(x); setShowForm(true); }} onDelete={() => deleteTx(x.id)} />
      ))}
      {feed.length === 0 && <div style={{ textAlign: "center", color: t.dim, padding: 20 }}>{isAll ? "No transactions yet" : "No transactions in this wallet yet"}</div>}

      {/* FAB */}
      <button style={{ ...styles.fab, background: t.accent }} onClick={() => { setEditing(null); setShowForm(true); }} aria-label="Add">+</button>

      {showForm && (
        <TripTxForm t={t} trip={trip} initial={editing} defaultWallet={isAll ? trip.wallets[0]?.id : selWallet}
          onSave={saveTx} onClose={() => { setShowForm(false); setEditing(null); }} />
      )}
    </div>
  );
}

// ── TRIP TX FORM ────────────────────────────────────────────────────────────

function TripTxForm({ t, trip, initial, defaultWallet, onSave, onClose }) {
  const [type, setType] = useState(initial?.type || "expense");
  const [amount, setAmount] = useState(initial ? String(initial.amount || "") : "");
  const [currency, setCurrency] = useState(initial?.currency || trip.currencies[0]);
  const [wallet, setWallet] = useState(initial?.wallet || initial?.fromWallet || defaultWallet || trip.wallets[0]?.id);
  const [toWallet, setToWallet] = useState(initial?.toWallet || trip.wallets.find((w) => w.id !== (initial?.wallet || defaultWallet))?.id);
  const [note, setNote] = useState(initial?.note || "");
  const [city, setCity] = useState(initial?.city || "");
  const [group, setGroup] = useState(initial?.group || null);
  const [date, setDate] = useState(initial?.date || todayISO());
  const [payMode, setPayMode] = useState(initial?.paymentMode || "");
  const [tags, setTags] = useState(initial?.tags || []);
  const [tagInput, setTagInput] = useState("");

  // exchange fields
  const [fromAmount, setFromAmount] = useState(initial?.type === "exchange" ? String(initial.fromAmount || "") : "");
  const [fromCurrency, setFromCurrency] = useState(initial?.fromCurrency || trip.currencies[0]);
  const [toCurrency, setToCurrency] = useState(initial?.toCurrency || (trip.currencies.length > 1 ? trip.currencies[1] : trip.currencies[0]));
  const [rate, setRate] = useState(initial?.type === "exchange" ? String(initial.rate || "") : "");
  // exchange entry mode: "rate" (enter the rate) or "amount" (enter exact received amount)
  const [exchMode, setExchMode] = useState("rate");
  const [gotAmount, setGotAmount] = useState(
    initial?.type === "exchange" && initial.toAmount ? String(initial.toAmount) : ""
  );

  const selWallet = trip.wallets.find((w) => w.id === wallet);
  const allTripTags = useMemo(() => [...new Set(trip.tx.flatMap((x) => x.tags || []))].sort(), [trip.tx]);
  const citySuggestions = useMemo(() => {
    const used = [...new Set(trip.tx.map((x) => x.city).filter(Boolean))];
    return used.filter((c) => c.toLowerCase().includes(city.toLowerCase()) && c.toLowerCase() !== city.toLowerCase());
  }, [trip.tx, city]);

  const addTag = (raw) => {
    const clean = raw.trim().toLowerCase().replace(/\s+/g, "-");
    if (clean && !tags.includes(clean)) setTags([...tags, clean]);
    setTagInput("");
  };
  const tagSuggestions = allTripTags.filter((tg) => !tags.includes(tg) && tg.includes(tagInput.toLowerCase())).slice(0, 8);

  // compute exchange result. Default rate is resolved through the currency chain
  // so even a derived (non-adjacent) pair pre-fills correctly.
  const exchFrom = parseFloat(fromAmount) || 0;
  const baselineRate = resolveRate(fromCurrency, toCurrency, trip.baselineRates, trip.currencies) || 0;
  // effective rate + received amount depend on the entry mode
  let effRate, exchTo;
  if (exchMode === "amount") {
    exchTo = parseFloat(gotAmount) || 0;
    effRate = exchTo ? exchFrom / exchTo : 0; // back-calculated, stored on this txn only
  } else {
    effRate = parseFloat(rate) || baselineRate || 0;
    exchTo = effRate ? exchFrom / effRate : 0;
  }

  const submit = () => {
    if (type === "exchange") {
      if (!exchFrom || !effRate || !exchTo) return;
      onSave({
        id: initial?.id || uid(), type: "exchange",
        fromAmount: exchFrom, fromCurrency,
        toAmount: exchTo, toCurrency,
        wallet, rate: effRate, note, date,
        tags, group: null, city: city || null,
      });
    } else if (type === "transfer") {
      const a = parseFloat(amount) || 0;
      if (!a) return;
      onSave({
        id: initial?.id || uid(), type: "transfer",
        amount: a, currency,
        fromWallet: wallet, toWallet, note, date,
        tags, group: null, city: null,
      });
    } else {
      const a = parseFloat(amount) || 0;
      if (!a) return;
      onSave({
        id: initial?.id || uid(), type,
        amount: a, currency, wallet, note, date,
        tags, group: type === "expense" ? group : null,
        city: city || null, paymentMode: payMode || null,
        rate: null,
      });
    }
  };

  return (
    <Modal t={t} onClose={onClose}>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>{initial ? "Edit" : "Add"} transaction</div>
      <Seg t={t} options={["expense", "fund-in", "transfer", "exchange"]} value={type} onChange={setType} full />

      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        {type !== "exchange" && (
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={lbl(t)}>Amount</label>
              <input value={amount} onChange={(e) => { const v = e.target.value; if (v === "" || /^-?\d*\.?\d*$/.test(v)) setAmount(v); }}
                placeholder="0" style={{ ...inp(t), fontSize: 24, fontWeight: 700, textAlign: "center", padding: 14 }} type="text" inputMode="decimal" />
            </div>
            <div style={{ width: 90 }}>
              <label style={lbl(t)}>Currency</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} style={inp(t)}>
                {trip.currencies.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
        )}

        {type === "exchange" && (
          <>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={lbl(t)}>From amount</label>
                <input value={fromAmount} onChange={(e) => { const v = e.target.value; if (v === "" || /^-?\d*\.?\d*$/.test(v)) setFromAmount(v); }}
                  placeholder="0" style={{ ...inp(t), fontSize: 20, fontWeight: 700, textAlign: "center" }} type="text" inputMode="decimal" />
              </div>
              <div style={{ width: 84 }}>
                <label style={lbl(t)}>From</label>
                <select value={fromCurrency} onChange={(e) => setFromCurrency(e.target.value)} style={inp(t)}>
                  {trip.currencies.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div style={{ width: 84 }}>
                <label style={lbl(t)}>To</label>
                <select value={toCurrency} onChange={(e) => setToCurrency(e.target.value)} style={inp(t)}>
                  {trip.currencies.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label style={lbl(t)}>Enter by</label>
              <Seg t={t} options={["rate", "amount"]} value={exchMode} onChange={setExchMode} full />
            </div>

            {exchMode === "rate" ? (
              <div>
                <label style={lbl(t)}>Rate (1 {toCurrency} = ? {fromCurrency})</label>
                <input value={rate} onChange={(e) => { const v = e.target.value; if (v === "" || /^-?\d*\.?\d*$/.test(v)) setRate(v); }}
                  placeholder={baselineRate ? `${baselineRate.toLocaleString(undefined, { maximumFractionDigits: 4 })} (default)` : "0"}
                  style={inp(t)} type="text" inputMode="decimal" />
                {baselineRate > 0 && !rate && (
                  <div style={{ fontSize: 12, color: t.dim, marginTop: 5 }}>Leaving this blank uses the default rate of {baselineRate.toLocaleString(undefined, { maximumFractionDigits: 4 })}.</div>
                )}
              </div>
            ) : (
              <div>
                <label style={lbl(t)}>Exact amount received in {toCurrency}</label>
                <input value={gotAmount} onChange={(e) => { const v = e.target.value; if (v === "" || /^-?\d*\.?\d*$/.test(v)) setGotAmount(v); }}
                  placeholder="0" style={inp(t)} type="text" inputMode="decimal" />
                {exchFrom > 0 && exchTo > 0 && (
                  <div style={{ fontSize: 12, color: t.amber, marginTop: 5 }}>
                    Implied rate: 1 {toCurrency} = {effRate.toLocaleString(undefined, { maximumFractionDigits: 4 })} {fromCurrency} (saved on this transaction; trip default rate is untouched)
                  </div>
                )}
              </div>
            )}

            {exchFrom > 0 && exchTo > 0 && (
              <div style={{ padding: 10, borderRadius: 10, background: t.green + "15", fontSize: 14, textAlign: "center" }}>
                {fmtCurrency(exchFrom, fromCurrency)} → <strong>{fmtCurrency(exchTo, toCurrency)}</strong>
              </div>
            )}
          </>
        )}

        <div>
          <label style={lbl(t)}>{type === "transfer" ? "From wallet" : "Wallet"}</label>
          <select value={wallet} onChange={(e) => setWallet(e.target.value)} style={{ ...inp(t) }}>
            {trip.wallets.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>

        {type === "transfer" && (
          <div>
            <label style={lbl(t)}>To wallet</label>
            <select value={toWallet} onChange={(e) => setToWallet(e.target.value)} style={{ ...inp(t) }}>
              {trip.wallets.filter((w) => w.id !== wallet).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
        )}

        {(type === "expense" || type === "fund-in") && selWallet?.paymentModes?.length > 0 && (
          <div>
            <label style={lbl(t)}>Payment mode</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {selWallet.paymentModes.map((m) => (
                <button key={m} onClick={() => setPayMode(payMode === m ? "" : m)} style={{
                  ...miniBtn(t), background: payMode === m ? t.accent + "22" : t.card,
                  border: `1px solid ${payMode === m ? t.accent : t.line}`, color: payMode === m ? t.accent : t.text,
                }}>{m}</button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label style={lbl(t)}>Note</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What's this for?" style={inp(t)} />
        </div>

        {/* Tags */}
        <div>
          <label style={lbl(t)}>Tags <span style={{ color: t.dim }}>(optional)</span></label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: tags.length ? 8 : 0 }}>
            {tags.map((tg) => (
              <span key={tg} style={{ ...pill(t), display: "flex", gap: 6, alignItems: "center" }}>
                {tg}
                <span style={{ cursor: "pointer" }} onClick={() => setTags(tags.filter((x) => x !== tg))}>×</span>
              </span>
            ))}
          </div>
          <input value={tagInput} onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(tagInput); } }}
            placeholder="type a tag, press Enter" style={{ ...inp(t), marginBottom: tagSuggestions.length ? 6 : 0 }} />
          {tagSuggestions.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {tagSuggestions.map((tg) => <span key={tg} style={{ ...pill(t), cursor: "pointer", opacity: 0.8 }} onClick={() => addTag(tg)}>+ {tg}</span>)}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <label style={lbl(t)}>Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inp(t)} />
          </div>
          {type !== "transfer" && (
            <div style={{ flex: 1, position: "relative" }}>
              <label style={lbl(t)}>City</label>
              <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Da Nang" style={inp(t)} />
              {city && citySuggestions.length > 0 && (
                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: t.card, border: `1px solid ${t.line}`, borderRadius: 8, zIndex: 10, marginTop: 4 }}>
                  {citySuggestions.map((c) => (
                    <div key={c} onClick={() => setCity(c)} style={{ padding: "8px 12px", cursor: "pointer", fontSize: 13, borderBottom: `1px solid ${t.line}` }}>{c}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {type === "expense" && (
          <div>
            <label style={lbl(t)}>Group <span style={{ color: t.dim }}>(optional)</span></label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button onClick={() => setGroup(null)} style={{ ...miniBtn(t), background: group === null ? t.accent + "22" : t.card, border: `1px solid ${group === null ? t.accent : t.line}`, color: group === null ? t.accent : t.dim }}>None</button>
              {trip.groups.map((g) => (
                <button key={g.id} onClick={() => setGroup(g.id)} style={{
                  ...miniBtn(t), background: group === g.id ? g.color + "22" : t.card,
                  border: `1px solid ${group === g.id ? g.color : t.line}`, color: group === g.id ? g.color : t.text,
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: g.color, display: "inline-block", marginRight: 4 }} />{g.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
        <button style={{ ...primaryBtn(t), flex: 1 }} onClick={submit}>{initial ? "Save changes" : "Add"}</button>
        <button style={secondaryBtn(t)} onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  );
}

// ── CONTEMPLATION ZONE ──────────────────────────────────────────────────────

function Contemplate({ t, trip, setTrip }) {
  const [subTab, setSubTab] = useState("convert");
  const [convAmount, setConvAmount] = useState("");
  const [convFrom, setConvFrom] = useState(trip.currencies[0]);
  const [selPlanned, setSelPlanned] = useState(() => new Set());
  const [addingPlanned, setAddingPlanned] = useState(false);
  const [pNote, setPNote] = useState("");
  const [pAmount, setPAmount] = useState("");
  const [pCurrency, setPCurrency] = useState(trip.currencies[0]);
  const [pQty, setPQty] = useState("1");

  const togglePlanned = (id) => setSelPlanned((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const pushToExpense = () => {
    const newTx = [];
    const updated = trip.planned.map((p) => {
      if (!selPlanned.has(p.id)) return p;
      newTx.push({
        id: uid(), type: "expense", amount: p.amount * p.qty, currency: p.currency,
        wallet: trip.wallets[0]?.id, note: p.qty > 1 ? `${p.note} (×${p.qty})` : p.note,
        date: todayISO(), tags: [], group: null, city: null, paymentMode: null, rate: null,
      });
      return { ...p, done: true };
    });
    setTrip((prev) => ({ ...prev, tx: [...newTx, ...prev.tx], planned: updated }));
    setSelPlanned(new Set());
  };

  const addPlannedItem = () => {
    const a = parseFloat(pAmount);
    const q = parseInt(pQty) || 1;
    if (!pNote.trim() || !a) return;
    setTrip((prev) => ({ ...prev, planned: [...prev.planned, { id: uid(), note: pNote.trim(), amount: a, currency: pCurrency, qty: q, done: false }] }));
    setPNote(""); setPAmount(""); setPQty("1"); setAddingPlanned(false);
  };

  const deletePlanned = (id) => setTrip((prev) => ({ ...prev, planned: prev.planned.filter((p) => p.id !== id) }));

  return (
    <div>
      <Seg t={t} options={["convert", "planned"]} value={subTab} onChange={setSubTab} full />

      {subTab === "convert" && (
        <div style={{ marginTop: 16 }}>
          <div style={{ padding: 16, borderRadius: 14, background: t.card, border: `1px solid ${t.line}` }}>
            <label style={lbl(t)}>Amount</label>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <input value={convAmount} onChange={(e) => { const v = e.target.value; if (v === "" || /^-?\d*\.?\d*$/.test(v)) setConvAmount(v); }}
                placeholder="0" style={{ ...inp(t), flex: 1 }} type="text" inputMode="decimal" />
              <select value={convFrom} onChange={(e) => setConvFrom(e.target.value)} style={{ ...inp(t), width: 90, flex: "none" }}>
                {trip.currencies.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div style={{ fontSize: 12, color: t.dim, letterSpacing: 0.5, marginBottom: 10 }}>CONVERSIONS AT BASELINE RATES</div>
            {trip.currencies.filter((c) => c !== convFrom).map((toCur) => {
              const num = parseFloat(convAmount) || 0;
              const result = convertCurrency(num, convFrom, toCur, trip.baselineRates, trip.currencies);
              const rateKey = `${convFrom}:${toCur}`;
              const revKey = `${toCur}:${convFrom}`;
              const rateDisplay = trip.baselineRates[rateKey]
                ? `1 ${toCur} = ${trip.baselineRates[rateKey].toLocaleString()} ${convFrom}`
                : trip.baselineRates[revKey]
                ? `1 ${convFrom} = ${trip.baselineRates[revKey].toLocaleString()} ${toCur}`
                : "no rate set";
              return (
                <div key={toCur} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${t.line}` }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>{toCur}</div>
                    <div style={{ fontSize: 11, color: t.dim }}>{rateDisplay}</div>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: result !== null ? t.text : t.dim }}>
                    {result !== null ? fmtCurrency(result, toCur) : "—"}
                  </div>
                </div>
              );
            })}

            {(parseFloat(convAmount) || 0) > 0 && trip.members.length > 0 && (
              <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: t.accent + "15" }}>
                <div style={{ fontSize: 11, color: t.accent, letterSpacing: 0.5, marginBottom: 6 }}>PER PERSON (÷{trip.members.length})</div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 14, borderBottom: `1px solid ${t.line}`, marginBottom: 4, paddingBottom: 8 }}>
                  <span style={{ color: t.dim }}>{convFrom}</span>
                  <span style={{ fontWeight: 600 }}>{fmtCurrency((parseFloat(convAmount) || 0) / trip.members.length, convFrom)}</span>
                </div>
                {trip.currencies.filter((c) => c !== convFrom).map((toCur) => {
                  const num = parseFloat(convAmount) || 0;
                  const result = convertCurrency(num, convFrom, toCur, trip.baselineRates, trip.currencies);
                  if (result === null) return null;
                  return (
                    <div key={toCur} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 14 }}>
                      <span style={{ color: t.dim }}>{toCur}</span>
                      <span style={{ fontWeight: 600 }}>{fmtCurrency(result / trip.members.length, toCur)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {subTab === "planned" && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, color: t.dim, letterSpacing: 0.5, marginBottom: 10 }}>
            EXPENSES LEFT TO MAKE · {trip.planned.filter((p) => !p.done).length}
          </div>

          {trip.planned.filter((p) => !p.done).map((p) => {
            const total = p.amount * p.qty;
            const inrEquiv = p.currency !== trip.baseCurrency ? convertCurrency(total, p.currency, trip.baseCurrency, trip.baselineRates, trip.currencies) : null;
            const isSel = selPlanned.has(p.id);
            return (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 14px", borderRadius: 12, background: isSel ? t.accent + "18" : t.card, border: `1px solid ${isSel ? t.accent : t.line}`, marginBottom: 6, cursor: "pointer" }}>
                <div onClick={() => togglePlanned(p.id)} style={{
                  width: 22, height: 22, borderRadius: 6, border: `2px solid ${isSel ? t.accent : t.dim}`,
                  background: isSel ? t.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontSize: 14, flexShrink: 0,
                }}>{isSel ? "✓" : ""}</div>
                <div style={{ flex: 1 }} onClick={() => togglePlanned(p.id)}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{p.note}</div>
                  <div style={{ fontSize: 12, color: t.dim, marginTop: 2 }}>
                    {fmtCurrency(p.amount, p.currency)}{p.qty > 1 ? ` × ${p.qty} = ${fmtCurrency(total, p.currency)}` : ""}
                    {inrEquiv !== null && <span style={{ marginLeft: 6 }}>≈ {fmtCurrency(inrEquiv, trip.baseCurrency)}</span>}
                  </div>
                </div>
                <button onClick={() => deletePlanned(p.id)} style={{ ...miniBtn(t), color: t.red, borderColor: t.red + "55", padding: "4px 8px", fontSize: 12 }}>×</button>
              </div>
            );
          })}

          {trip.planned.filter((p) => p.done).length > 0 && (
            <>
              <div style={{ fontSize: 12, color: t.dim, letterSpacing: 0.5, marginTop: 16, marginBottom: 10 }}>PUSHED TO EXPENSES</div>
              {trip.planned.filter((p) => p.done).map((p) => (
                <div key={p.id} style={{ padding: "10px 14px", borderRadius: 12, background: t.card, border: `1px solid ${t.line}`, marginBottom: 6, opacity: 0.5 }}>
                  <div style={{ fontSize: 14, textDecoration: "line-through" }}>{p.note}</div>
                  <div style={{ fontSize: 12, color: t.dim }}>{fmtCurrency(p.amount * p.qty, p.currency)}</div>
                </div>
              ))}
            </>
          )}

          {selPlanned.size > 0 && (
            <button onClick={pushToExpense} style={{ ...primaryBtn(t), width: "100%", marginTop: 12 }}>
              Push {selPlanned.size} to expenses
            </button>
          )}

          {addingPlanned ? (
            <div style={{ marginTop: 12, padding: 14, borderRadius: 14, border: `1px solid ${t.line}`, background: t.card }}>
              <div style={{ fontSize: 13, color: t.dim, marginBottom: 10 }}>New planned expense</div>
              <input value={pNote} onChange={(e) => setPNote(e.target.value)} placeholder="e.g. Museum tickets" style={{ ...inp(t), marginBottom: 8 }} autoFocus />
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <input value={pAmount} onChange={(e) => { const v = e.target.value; if (v === "" || /^-?\d*\.?\d*$/.test(v)) setPAmount(v); }}
                  placeholder="Unit price" style={{ ...inp(t), flex: 1 }} type="text" inputMode="decimal" />
                <select value={pCurrency} onChange={(e) => setPCurrency(e.target.value)} style={{ ...inp(t), width: 80, flex: "none" }}>
                  {trip.currencies.map((c) => <option key={c}>{c}</option>)}
                </select>
                <input value={pQty} onChange={(e) => setPQty(e.target.value)} placeholder="Qty" style={{ ...inp(t), width: 56, flex: "none", textAlign: "center" }} type="text" inputMode="numeric" />
              </div>
              {(parseFloat(pAmount) || 0) > 0 && (parseInt(pQty) || 1) > 1 && (
                <div style={{ fontSize: 13, color: t.dim, marginBottom: 8 }}>Total: {fmtCurrency((parseFloat(pAmount) || 0) * (parseInt(pQty) || 1), pCurrency)}</div>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <button style={{ ...primaryBtn(t), flex: 1 }} onClick={addPlannedItem}>Add</button>
                <button style={secondaryBtn(t)} onClick={() => setAddingPlanned(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <button style={{ width: "100%", marginTop: 8, padding: 12, borderRadius: 14, cursor: "pointer", color: t.accent, border: `1px dashed ${t.accent}88`, background: "transparent", fontSize: 14 }}
              onClick={() => setAddingPlanned(true)}>+ Add planned expense</button>
          )}
        </div>
      )}
    </div>
  );
}

// ── TRIP ANALYZE ────────────────────────────────────────────────────────────

function TripAnalyze({ t, trip }) {
  const [filterCurrency, setFilterCurrency] = useState("all");
  const [filterCity, setFilterCity] = useState("all");
  const [filterGroup, setFilterGroup] = useState("all");
  const [filterWallet, setFilterWallet] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const expenses = trip.tx.filter((x) => x.type === "expense");
  const filtered = useMemo(() => expenses.filter((x) =>
    (filterCurrency === "all" || x.currency === filterCurrency) &&
    (filterCity === "all" || x.city === filterCity) &&
    (filterGroup === "all" || (filterGroup === "none" ? !x.group : x.group === filterGroup)) &&
    (filterWallet === "all" || x.wallet === filterWallet) &&
    (!fromDate || x.date >= fromDate) &&
    (!toDate || x.date <= toDate)
  ), [expenses, filterCurrency, filterCity, filterGroup, filterWallet, fromDate, toDate]);

  const byCurrency = {};
  for (const x of filtered) byCurrency[x.currency] = (byCurrency[x.currency] || 0) + x.amount;

  const byGroup = {};
  for (const x of filtered) {
    const gName = x.group ? trip.groups.find((g) => g.id === x.group)?.name || "?" : "Ungrouped";
    if (!byGroup[gName]) byGroup[gName] = {};
    byGroup[gName][x.currency] = (byGroup[gName][x.currency] || 0) + x.amount;
  }

  const byWallet = {};
  for (const x of filtered) {
    const wName = trip.wallets.find((w) => w.id === x.wallet)?.name || "?";
    if (!byWallet[wName]) byWallet[wName] = {};
    byWallet[wName][x.currency] = (byWallet[wName][x.currency] || 0) + x.amount;
  }

  let totalBase = 0;
  for (const x of filtered) {
    if (x.currency === trip.baseCurrency) { totalBase += x.amount; continue; }
    const conv = convertCurrency(x.amount, x.currency, trip.baseCurrency, trip.baselineRates, trip.currencies);
    if (conv !== null) totalBase += conv;
  }

  const usedCities = [...new Set(expenses.map((x) => x.city).filter(Boolean))];
  const usedGroups = [...new Set(expenses.map((x) => x.group).filter(Boolean))];

  return (
    <div>
      {/* filters */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        <select value={filterCurrency} onChange={(e) => setFilterCurrency(e.target.value)} style={{ ...sel(t), flex: "1 1 45%" }}>
          <option value="all">All currencies</option>
          {trip.currencies.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterCity} onChange={(e) => setFilterCity(e.target.value)} style={{ ...sel(t), flex: "1 1 45%" }}>
          <option value="all">All cities</option>
          {usedCities.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterGroup} onChange={(e) => setFilterGroup(e.target.value)} style={{ ...sel(t), flex: "1 1 45%" }}>
          <option value="all">All groups</option>
          <option value="none">— Ungrouped —</option>
          {usedGroups.map((g) => <option key={g} value={g}>{trip.groups.find((gr) => gr.id === g)?.name}</option>)}
        </select>
        <select value={filterWallet} onChange={(e) => setFilterWallet(e.target.value)} style={{ ...sel(t), flex: "1 1 45%" }}>
          <option value="all">All wallets</option>
          {trip.wallets.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14 }}>
        <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={{ ...sel(t), flex: 1 }} />
        <span style={{ color: t.dim, fontSize: 13 }}>to</span>
        <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} style={{ ...sel(t), flex: 1 }} />
      </div>

      {/* totals */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
        <Stat t={t} label={`TOTAL (${trip.baseCurrency} equiv)`} value={fmtCurrency(totalBase, trip.baseCurrency)} color={t.text} big />
        <Stat t={t} label="EXPENSES" value={String(filtered.length)} color={t.accent} big />
      </div>

      {/* by currency */}
      <div style={{ padding: 14, borderRadius: 14, background: t.card, border: `1px solid ${t.line}`, marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: t.dim, letterSpacing: 0.5, marginBottom: 10 }}>BY CURRENCY</div>
        {Object.entries(byCurrency).map(([cur, amt]) => (
          <div key={cur} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${t.line}` }}>
            <span style={{ fontSize: 14 }}>{cur}</span>
            <span style={{ fontSize: 14, fontWeight: 700 }}>{fmtCurrency(amt, cur)}</span>
          </div>
        ))}
        {Object.keys(byCurrency).length === 0 && <div style={{ color: t.dim, fontSize: 13 }}>No expenses match filters</div>}
      </div>

      {/* by group */}
      <div style={{ padding: 14, borderRadius: 14, background: t.card, border: `1px solid ${t.line}`, marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: t.dim, letterSpacing: 0.5, marginBottom: 10 }}>BY GROUP</div>
        {Object.entries(byGroup).map(([gName, curAmts]) => {
          const gObj = trip.groups.find((g) => g.name === gName);
          return (
            <div key={gName} style={{ padding: "8px 0", borderBottom: `1px solid ${t.line}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: gObj?.color || t.dim }} />
                <span style={{ fontSize: 14, fontWeight: 600 }}>{gName}</span>
              </div>
              {Object.entries(curAmts).map(([cur, amt]) => (
                <div key={cur} style={{ display: "flex", justifyContent: "space-between", paddingLeft: 14, fontSize: 13, color: t.dim }}>
                  <span>{cur}</span>
                  <span style={{ color: t.text }}>{fmtCurrency(amt, cur)}</span>
                </div>
              ))}
            </div>
          );
        })}
        {Object.keys(byGroup).length === 0 && <div style={{ color: t.dim, fontSize: 13 }}>No data</div>}
      </div>

      {/* by wallet */}
      <div style={{ padding: 14, borderRadius: 14, background: t.card, border: `1px solid ${t.line}`, marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: t.dim, letterSpacing: 0.5, marginBottom: 10 }}>BY WALLET (WHO SPENT)</div>
        {Object.entries(byWallet).map(([wName, curAmts]) => (
          <div key={wName} style={{ padding: "8px 0", borderBottom: `1px solid ${t.line}` }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{wName}</div>
            {Object.entries(curAmts).map(([cur, amt]) => (
              <div key={cur} style={{ display: "flex", justifyContent: "space-between", paddingLeft: 14, fontSize: 13, color: t.dim }}>
                <span>{cur}</span>
                <span style={{ color: t.text }}>{fmtCurrency(amt, cur)}</span>
              </div>
            ))}
          </div>
        ))}
        {Object.keys(byWallet).length === 0 && <div style={{ color: t.dim, fontSize: 13 }}>No data</div>}
      </div>

      {/* filtered list */}
      <div style={{ fontSize: 12, color: t.dim, letterSpacing: 0.5, marginBottom: 8 }}>FILTERED EXPENSES</div>
      {filtered.map((x) => (
        <div key={x.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 12, background: t.card, border: `1px solid ${t.line}`, marginBottom: 4 }}>
          <div>
            <div style={{ fontSize: 14 }}>{x.note || "(no note)"}</div>
            <div style={{ fontSize: 11, color: t.dim }}>{niceDate(x.date)}{x.city ? ` · ${x.city}` : ""}</div>
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: t.red }}>{fmtCurrency(x.amount, x.currency)}</div>
        </div>
      ))}
      {filtered.length === 0 && <div style={{ textAlign: "center", color: t.dim, padding: 16, fontSize: 13 }}>No matching expenses</div>}
    </div>
  );
}

// ── TRIP SETUP ──────────────────────────────────────────────────────────────

function TripSetup({ t, trip, setTrip }) {
  const [section, setSection] = useState(null); // null | name | currencies | rates | members | wallets | groups

  // inline editors
  const [editName, setEditName] = useState(trip.name);
  const [editStart, setEditStart] = useState(trip.startDate);
  const [editEnd, setEditEnd] = useState(trip.endDate || "");

  // currency add
  const [newCur, setNewCur] = useState("");
  // member add
  const [newMember, setNewMember] = useState("");
  // wallet add
  const [newWalletName, setNewWalletName] = useState("");
  // wallet payment mode add
  const [addingModeFor, setAddingModeFor] = useState(null);
  const [newMode, setNewMode] = useState("");
  // group add
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupColor, setNewGroupColor] = useState(COLORS[0]);
  // rate edit
  // rate edit is now inline in the primary/derived sections (no modal state needed)

  const saveInfo = () => {
    setTrip((prev) => ({ ...prev, name: editName.trim() || prev.name, startDate: editStart, endDate: editEnd }));
    setSection(null);
  };

  const addCurrency = () => {
    const c = newCur.trim().toUpperCase();
    if (c && c.length <= 5 && !trip.currencies.includes(c)) {
      setTrip((prev) => ({ ...prev, currencies: [...prev.currencies, c] }));
      setNewCur("");
    }
  };
  const removeCurrency = (c) => {
    if (c === trip.baseCurrency) return; // can't remove base
    setTrip((prev) => ({ ...prev, currencies: prev.currencies.filter((x) => x !== c) }));
  };

  const addMember = () => {
    const m = newMember.trim();
    if (m && !trip.members.includes(m)) {
      setTrip((prev) => ({ ...prev, members: [...prev.members, m] }));
      setNewMember("");
    }
  };
  const removeMember = (m) => setTrip((prev) => ({ ...prev, members: prev.members.filter((x) => x !== m) }));

  const addWallet = () => {
    const n = newWalletName.trim();
    if (!n) return;
    setTrip((prev) => ({ ...prev, wallets: [...prev.wallets, { id: "w_" + uid(), name: n, type: "personal", paymentModes: ["Cash"] }] }));
    setNewWalletName("");
  };
  const removeWallet = (wId) => {
    // don't delete if it has transactions
    if (trip.tx.some((x) => x.wallet === wId || x.fromWallet === wId || x.toWallet === wId)) return;
    setTrip((prev) => ({ ...prev, wallets: prev.wallets.filter((w) => w.id !== wId) }));
  };
  const addPaymentMode = (wId) => {
    const m = newMode.trim();
    if (!m) return;
    setTrip((prev) => ({
      ...prev,
      wallets: prev.wallets.map((w) => w.id === wId ? { ...w, paymentModes: [...new Set([...w.paymentModes, m])] } : w),
    }));
    setNewMode(""); setAddingModeFor(null);
  };
  const removePaymentMode = (wId, mode) => {
    setTrip((prev) => ({
      ...prev,
      wallets: prev.wallets.map((w) => w.id === wId ? { ...w, paymentModes: w.paymentModes.filter((m) => m !== mode) } : w),
    }));
  };

  const addGroup = () => {
    const n = newGroupName.trim();
    if (!n) return;
    setTrip((prev) => ({ ...prev, groups: [...prev.groups, { id: "tg_" + uid(), name: n, color: newGroupColor }] }));
    setNewGroupName(""); setNewGroupColor(COLORS[(trip.groups.length + 1) % COLORS.length]);
  };
  const removeGroup = (gId) => {
    setTrip((prev) => ({
      ...prev,
      groups: prev.groups.filter((g) => g.id !== gId),
      tx: prev.tx.map((x) => x.group === gId ? { ...x, group: null } : x),
    }));
  };

  const setAnchor = (from, to, val) => {
    setTrip((prev) => {
      const next = { ...prev.baselineRates };
      const v = parseFloat(val);
      if (val === "" || isNaN(v)) { delete next[`${from}:${to}`]; }
      else next[`${from}:${to}`] = v;
      return { ...prev, baselineRates: next };
    });
  };

  const moveCurrency = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= trip.currencies.length) return;
    setTrip((prev) => {
      const next = [...prev.currencies];
      [next[i], next[j]] = [next[j], next[i]];
      return { ...prev, currencies: next };
    });
  };

  // adjacency-based split: adjacent pairs are primary (user sets); non-adjacent are derived.
  const adjacentPairs = [];
  for (let i = 0; i < trip.currencies.length - 1; i++) adjacentPairs.push([trip.currencies[i], trip.currencies[i + 1]]);
  const derivedPairs = [];
  for (let i = 0; i < trip.currencies.length; i++)
    for (let j = i + 2; j < trip.currencies.length; j++)
      derivedPairs.push([trip.currencies[i], trip.currencies[j]]);

  const toggleArchive = () => {
    setTrip((prev) => ({ ...prev, status: prev.status === "active" ? "archived" : "active" }));
  };

  return (
    <div>
      {/* Trip info */}
      <div style={{ padding: 16, borderRadius: 14, background: t.card, border: `1px solid ${t.line}`, marginBottom: 12 }}>
        {section === "name" ? (
          <div>
            <label style={lbl(t)}>TRIP NAME</label>
            <input value={editName} onChange={(e) => setEditName(e.target.value)} style={{ ...inp(t), marginBottom: 8 }} autoFocus />
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}><label style={lbl(t)}>START</label><input type="date" value={editStart} onChange={(e) => setEditStart(e.target.value)} style={inp(t)} /></div>
              <div style={{ flex: 1 }}><label style={lbl(t)}>END</label><input type="date" value={editEnd} onChange={(e) => setEditEnd(e.target.value)} style={inp(t)} /></div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button style={{ ...primaryBtn(t), flex: 1 }} onClick={saveInfo}>Save</button>
              <button style={secondaryBtn(t)} onClick={() => setSection(null)}>Cancel</button>
            </div>
          </div>
        ) : (
          <div onClick={() => { setEditName(trip.name); setEditStart(trip.startDate); setEditEnd(trip.endDate || ""); setSection("name"); }} style={{ cursor: "pointer" }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{trip.name}</div>
            <div style={{ fontSize: 13, color: t.dim, marginTop: 4 }}>{trip.startDate}{trip.endDate ? ` → ${trip.endDate}` : " → ongoing"}</div>
          </div>
        )}
      </div>

      {/* Members */}
      <div style={{ padding: 16, borderRadius: 14, background: t.card, border: `1px solid ${t.line}`, marginBottom: 12 }}>
        <label style={lbl(t)}>MEMBERS · {trip.members.length}</label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
          {trip.members.map((m) => (
            <span key={m} style={{ ...pill(t), fontSize: 13, padding: "5px 12px", display: "flex", gap: 6, alignItems: "center" }}>
              {m} <span style={{ cursor: "pointer", color: t.red }} onClick={() => removeMember(m)}>×</span>
            </span>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={newMember} onChange={(e) => setNewMember(e.target.value)} placeholder="Add member" style={{ ...inp(t), flex: 1 }}
            onKeyDown={(e) => { if (e.key === "Enter") addMember(); }} />
          <button style={miniBtn(t)} onClick={addMember}>+</button>
        </div>
      </div>

      {/* Currencies */}
      <div style={{ padding: 16, borderRadius: 14, background: t.card, border: `1px solid ${t.line}`, marginBottom: 12 }}>
        <label style={lbl(t)}>CURRENCIES</label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
          {trip.currencies.map((c) => (
            <span key={c} style={{ ...pill(t), fontSize: 13, padding: "5px 12px", background: c === trip.baseCurrency ? t.accent + "22" : t.pill, color: c === trip.baseCurrency ? t.accent : t.dim, display: "flex", gap: 6, alignItems: "center" }}>
              {c}{c === trip.baseCurrency && <span style={{ fontSize: 9 }}>BASE</span>}
              {c !== trip.baseCurrency && <span style={{ cursor: "pointer", color: t.red }} onClick={() => removeCurrency(c)}>×</span>}
            </span>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={newCur} onChange={(e) => setNewCur(e.target.value.toUpperCase())} placeholder="e.g. VND" style={{ ...inp(t), flex: 1 }} maxLength={5}
            onKeyDown={(e) => { if (e.key === "Enter") addCurrency(); }} />
          <button style={miniBtn(t)} onClick={addCurrency}>+</button>
        </div>
      </div>

      {/* Currency order (reorderable) */}
      {trip.currencies.length > 1 && (
        <div style={{ padding: 16, borderRadius: 14, background: t.card, border: `1px solid ${t.line}`, marginBottom: 12 }}>
          <label style={lbl(t)}>CURRENCY ORDER <span style={{ color: t.dim }}>(adjacent pairs populate the rest)</span></label>
          {trip.currencies.map((c, i) => (
            <div key={c} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: i < trip.currencies.length - 1 ? `1px solid ${t.line}` : "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 600 }}>{c}</span>
                {c === trip.baseCurrency && <span style={{ ...pill(t), background: t.accent + "22", color: t.accent, fontSize: 9 }}>BASE</span>}
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                <button onClick={() => moveCurrency(i, -1)} disabled={i === 0} style={{ ...miniBtn(t), padding: "4px 10px", opacity: i === 0 ? 0.3 : 1 }}>↑</button>
                <button onClick={() => moveCurrency(i, 1)} disabled={i === trip.currencies.length - 1} style={{ ...miniBtn(t), padding: "4px 10px", opacity: i === trip.currencies.length - 1 ? 0.3 : 1 }}>↓</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Primary (adjacent) rates */}
      {adjacentPairs.length > 0 && (
        <div style={{ padding: 16, borderRadius: 14, background: t.card, border: `1px solid ${t.line}`, marginBottom: 12 }}>
          <label style={lbl(t)}>PRIMARY RATES <span style={{ color: t.dim }}>(you set these)</span></label>
          {adjacentPairs.map(([from, to]) => (
            <div key={from + to} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: `1px solid ${t.line}` }}>
              <span style={{ fontSize: 14, flex: 1 }}>1 {to} =</span>
              <input value={trip.baselineRates[`${from}:${to}`] ?? ""} onChange={(e) => { const v = e.target.value; if (v === "" || /^-?\d*\.?\d*$/.test(v)) setAnchor(from, to, v); }}
                placeholder="rate" style={{ ...inp(t), width: 130, flex: "none", textAlign: "right" }} type="text" inputMode="decimal" />
              <span style={{ fontSize: 14, color: t.dim, width: 40 }}>{from}</span>
            </div>
          ))}
        </div>
      )}

      {/* Derived rates (auto, overridable) */}
      {derivedPairs.length > 0 && (
        <div style={{ padding: 16, borderRadius: 14, background: t.card, border: `1px solid ${t.line}`, marginBottom: 12 }}>
          <label style={lbl(t)}>DERIVED RATES <span style={{ color: t.dim }}>(auto — type to override)</span></label>
          {derivedPairs.map(([from, to]) => {
            const overridden = isRateAnchored(from, to, trip.baselineRates);
            const derived = resolveRate(from, to, trip.baselineRates, trip.currencies);
            const displayVal = trip.baselineRates[`${from}:${to}`] != null
              ? trip.baselineRates[`${from}:${to}`]
              : (overridden ? (1 / trip.baselineRates[`${to}:${from}`]) : (derived != null ? Number(derived.toFixed(6)) : ""));
            return (
              <div key={from + to} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: `1px solid ${t.line}` }}>
                <span style={{ fontSize: 14, flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
                  1 {to} =
                  {!overridden && derived != null && <span style={{ ...pill(t), fontSize: 9, background: t.amber + "22", color: t.amber }}>CALC</span>}
                </span>
                <input value={displayVal === "" ? "" : displayVal} onChange={(e) => { const v = e.target.value; if (v === "" || /^-?\d*\.?\d*$/.test(v)) setAnchor(from, to, v); }}
                  placeholder="—" style={{ ...inp(t), width: 130, flex: "none", textAlign: "right", color: overridden ? t.text : t.dim, fontStyle: overridden ? "normal" : "italic" }} type="text" inputMode="decimal" />
                <span style={{ fontSize: 14, color: t.dim, width: 40 }}>{from}</span>
              </div>
            );
          })}
          <div style={{ fontSize: 11, color: t.dim, marginTop: 8 }}>Derived from chaining the primary rates. Type a value to lock one; clear it to return to auto.</div>
        </div>
      )}

      {trip.currencies.length < 2 && (
        <div style={{ padding: 16, borderRadius: 14, background: t.card, border: `1px solid ${t.line}`, marginBottom: 12, color: t.dim, fontSize: 13 }}>
          Add at least 2 currencies to set exchange rates.
        </div>
      )}

      {/* Wallets */}
      <div style={{ padding: 16, borderRadius: 14, background: t.card, border: `1px solid ${t.line}`, marginBottom: 12 }}>
        <label style={lbl(t)}>WALLETS · {trip.wallets.length}</label>
        {trip.wallets.map((w, i) => {
          const hasTx = trip.tx.some((x) => x.wallet === w.id || x.fromWallet === w.id || x.toWallet === w.id);
          const color = walletColor(trip, w.id);
          return (
            <div key={w.id} style={{ padding: "10px 0", borderBottom: `1px solid ${t.line}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: color }} />
                  <span style={{ fontSize: 14 }}>{w.name}</span>
                  {w.type === "pool" && <span style={{ ...pill(t), fontSize: 9, padding: "1px 6px" }}>POOL</span>}
                </div>
                {!hasTx && w.type !== "pool" && (
                  <button style={{ ...miniBtn(t), color: t.red, borderColor: t.red + "55", padding: "4px 8px", fontSize: 11 }} onClick={() => removeWallet(w.id)}>Remove</button>
                )}
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6, marginLeft: 18 }}>
                {w.paymentModes.map((m) => (
                  <span key={m} style={{ ...pill(t), fontSize: 11, display: "flex", gap: 4, alignItems: "center" }}>
                    {m} <span style={{ cursor: "pointer", color: t.red, fontSize: 10 }} onClick={() => removePaymentMode(w.id, m)}>×</span>
                  </span>
                ))}
                {addingModeFor === w.id ? (
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <input value={newMode} onChange={(e) => setNewMode(e.target.value)} placeholder="mode" style={{ ...inp(t), width: 100, padding: "4px 8px", fontSize: 12 }} autoFocus
                      onKeyDown={(e) => { if (e.key === "Enter") addPaymentMode(w.id); }} />
                    <button style={{ ...miniBtn(t), padding: "3px 8px", fontSize: 11 }} onClick={() => addPaymentMode(w.id)}>+</button>
                  </div>
                ) : (
                  <span style={{ ...pill(t), cursor: "pointer", fontSize: 11, color: t.accent }} onClick={() => { setAddingModeFor(w.id); setNewMode(""); }}>+ mode</span>
                )}
              </div>
            </div>
          );
        })}
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <input value={newWalletName} onChange={(e) => setNewWalletName(e.target.value)} placeholder="New wallet name" style={{ ...inp(t), flex: 1 }}
            onKeyDown={(e) => { if (e.key === "Enter") addWallet(); }} />
          <button style={miniBtn(t)} onClick={addWallet}>+</button>
        </div>
      </div>

      {/* Groups */}
      <div style={{ padding: 16, borderRadius: 14, background: t.card, border: `1px solid ${t.line}`, marginBottom: 12 }}>
        <label style={lbl(t)}>GROUPS · {trip.groups.length}</label>
        {trip.groups.map((g) => (
          <div key={g.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${t.line}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: g.color }} />
              <span style={{ fontSize: 14 }}>{g.name}</span>
            </div>
            <button style={{ ...miniBtn(t), color: t.red, borderColor: t.red + "55", padding: "4px 8px", fontSize: 11 }} onClick={() => removeGroup(g.id)}>×</button>
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
          <div style={{ display: "flex", gap: 4 }}>
            {COLORS.slice(0, 6).map((c) => <button key={c} onClick={() => setNewGroupColor(c)} style={{ width: 20, height: 20, borderRadius: "50%", background: c, cursor: "pointer", border: newGroupColor === c ? `2px solid ${t.text}` : "2px solid transparent" }} />)}
          </div>
          <input value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder="Group name" style={{ ...inp(t), flex: 1 }}
            onKeyDown={(e) => { if (e.key === "Enter") addGroup(); }} />
          <button style={miniBtn(t)} onClick={addGroup}>+</button>
        </div>
      </div>

      {/* Archive/unarchive */}
      <button style={{ ...secondaryBtn(t), width: "100%", color: trip.status === "active" ? t.amber : t.green }} onClick={toggleArchive}>
        {trip.status === "active" ? "Archive this trip" : "Reactivate this trip"}
      </button>
    </div>
  );
}

// ── MAIN TRIP MANAGER ───────────────────────────────────────────────────────

export default function TripManager({ t, dark, setDark, syncState, trip, allTrips, setTrip, addTrip, onSwitchTrip, onBackToLedger }) {
  const [tab, setTab] = useState("home");
  const [showTripList, setShowTripList] = useState(false);

  const titles = { home: "TRIP", contemplate: "CONTEMPLATE", analyze: "ANALYZE", setup: "SETUP" };

  // total across all wallets in base currency
  const totalBase = useMemo(() => {
    let total = 0;
    for (const w of trip.wallets) {
      const bals = tripWalletBalances(w.id, trip.tx);
      for (const [cur, amt] of Object.entries(bals)) {
        if (cur === trip.baseCurrency) { total += amt; continue; }
        const conv = convertCurrency(amt, cur, trip.baseCurrency, trip.baselineRates, trip.currencies);
        if (conv !== null) total += conv;
      }
    }
    return total;
  }, [trip]);

  return (
    <div style={{ ...styles.app, background: t.bg, color: t.text, fontFamily: t.font }}>
      <style>{`* { box-sizing: border-box; } html, body, #root { margin:0; padding:0; min-height:100%; background:${t.bg}; } body { overflow-x:hidden; } ::-webkit-scrollbar{width:7px;height:7px} ::-webkit-scrollbar-thumb{background:${t.line};border-radius:4px} input,select,button{font-family:inherit}`}</style>

      {/* header */}
      <div style={{ ...styles.header, borderBottom: `1px solid ${t.line}` }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: 2, color: t.dim }}>{titles[tab]}</div>
          <div style={{ fontSize: 20, fontWeight: 700, marginTop: 2, display: "flex", alignItems: "center", gap: 8 }}>
            ✈ {trip.name}
            <button onClick={() => setShowTripList(true)} style={{ background: "none", border: "none", color: t.dim, cursor: "pointer", fontSize: 14, padding: 0 }}>▾</button>
          </div>
          {tab === "home" && <div style={{ fontSize: 14, color: t.dim, marginTop: 2 }}>Total ≈ {fmtCurrency(totalBase, trip.baseCurrency)}</div>}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <SyncDot t={t} state={syncState} />
          <button onClick={() => setDark(!dark)} style={{ ...styles.iconBtn, border: `1px solid ${t.line}`, color: t.text, background: t.card }}>{dark ? "☀" : "☾"}</button>
        </div>
      </div>

      {/* body */}
      <div style={styles.body}>
        {tab === "home" && <TripHome t={t} trip={trip} setTrip={setTrip} />}
        {tab === "contemplate" && <Contemplate t={t} trip={trip} setTrip={setTrip} />}
        {tab === "analyze" && <TripAnalyze t={t} trip={trip} />}
        {tab === "setup" && <TripSetup t={t} trip={trip} setTrip={setTrip} />}
      </div>

      {/* nav */}
      <div style={{ ...styles.nav, background: t.bg, borderTop: `1px solid ${t.line}` }}>
        {[
          ["home", "Home", "▦"],
          ["contemplate", "Think", "◈"],
          ["analyze", "Analyze", "▤"],
          ["setup", "Setup", "⚙"],
        ].map(([id, label, icon]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            flex: 1, border: "none", background: "transparent",
            color: tab === id ? t.accent : t.dim, cursor: "pointer",
            padding: "10px 0", fontSize: 11, display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
          }}>
            <span style={{ fontSize: 18 }}>{icon}</span>{label}
          </button>
        ))}
      </div>

      {/* trip picker modal */}
      {showTripList && (
        <Modal t={t} onClose={() => setShowTripList(false)}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>Your trips</div>
          {allTrips.map((tr) => (
            <button key={tr.id} onClick={() => { onSwitchTrip(tr.id); setShowTripList(false); }} style={{
              width: "100%", textAlign: "left", padding: "14px 16px", borderRadius: 14, cursor: "pointer", color: t.text, marginBottom: 8,
              border: `1px solid ${tr.id === trip.id ? t.accent : t.line}`,
              background: tr.id === trip.id ? t.accent + "15" : t.card,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>✈ {tr.name}</div>
                <span style={{ ...pill(t), background: tr.status === "active" ? t.green + "22" : t.pill, color: tr.status === "active" ? t.green : t.dim, fontSize: 10 }}>
                  {tr.status.toUpperCase()}
                </span>
              </div>
              <div style={{ fontSize: 12, color: t.dim, marginTop: 4 }}>
                {tr.startDate}{tr.endDate ? ` → ${tr.endDate}` : ""} · {tr.members.length} members
              </div>
            </button>
          ))}
          <button style={{ width: "100%", padding: 12, borderRadius: 14, cursor: "pointer", color: t.accent, border: `1px dashed ${t.accent}88`, background: "transparent", fontSize: 14, marginBottom: 12 }}
            onClick={() => { const tr = emptyTrip(); addTrip(tr); onSwitchTrip(tr.id); setShowTripList(false); }}>+ New trip</button>
          <button onClick={() => { onBackToLedger(); setShowTripList(false); }} style={{ ...secondaryBtn(t), width: "100%", color: t.dim }}>
            ← Back to Ledger
          </button>
        </Modal>
      )}
    </div>
  );
}