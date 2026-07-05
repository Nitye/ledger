import React, { useState, useMemo, useEffect } from "react";
import { Modal, Seg, Stat, Toggle, COLORS, pill, inp, sel, lbl, primaryBtn, secondaryBtn, miniBtn } from "../lib/ui.jsx";
import { fmt, niceDate, uid, received, outstanding, isRepayable, balanceOf, MODES, modeShort, visibleTags, isGhost } from "../lib/model";
import { exportStatement } from "../lib/pdf";
import { receiptUrl } from "../lib/drive";

// ── HOME ──────────────────────────────────────────────────────────────────────
// v2: Home is now a filtered, searchable, multi-selectable list. Filter state
// (search text + date range) is lifted to App.jsx via homeFilter/setHomeFilter
// so it PERSISTS when you leave Home and come back. Bulk actions write through
// the same setTx/setAccounts/setGroups the rest of the app uses.
const HOME_LIMIT = 15; // rows shown before the "Show all" toggle appears

const iso = (d) => d.toISOString().slice(0, 10);
function presetRange(preset) {
  const now = new Date();
  const back = (n) => { const d = new Date(now); d.setDate(d.getDate() - n); return iso(d); };
  if (preset === "7d") return { from: back(6), to: iso(now) };
  if (preset === "30d") return { from: back(29), to: iso(now) };
  if (preset === "month") return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(now) };
  return { from: "", to: "" }; // "all"
}

export function Home({ t, accounts, currentAccount, setCurrentAccount, tx, acct, grp, groups, tagConfig, allTags, homeFilter, setHomeFilter, setTx, setAccounts, setGroups, onEdit, onDelete, onViewInvoice }) {
  const cur = acct(currentAccount);
  const { search = "", preset = "all", from = "", to = "" } = homeFilter;
  const patch = (p) => setHomeFilter((f) => ({ ...f, ...p }));

  const [showAll, setShowAll] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [picker, setPicker] = useState(null); // "tag" | "group" | "account" | null

  // reset transient UI (but NOT the persistent filter) when switching accounts
  useEffect(() => { setSelected(new Set()); setSelectMode(false); setShowAll(false); }, [currentAccount]);

  const applyPreset = (p) => { setShowAll(false); setSelected(new Set()); patch({ preset: p, ...presetRange(p) }); };

  // the active slice: account + date range + note search, newest first
  const rows = useMemo(() => tx
    .filter((x) => x.account === currentAccount || x.toAccount === currentAccount)
    .filter((x) => (!from || x.date >= from) && (!to || x.date <= to))
    .filter((x) => !search || (x.note || "").toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.date.localeCompare(a.date)),
    [tx, currentAccount, from, to, search]);

  const shown = showAll ? rows : rows.slice(0, HOME_LIMIT);
  const filtering = !!search || preset !== "all";

  const toggleRow = (id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allSelected = rows.length > 0 && rows.every((x) => selected.has(x.id));
  const selectAll = () => setSelected(allSelected ? new Set() : new Set(rows.map((x) => x.id)));
  const exitSelect = () => { setSelected(new Set()); setSelectMode(false); };
  // shared by every bulk picker on success: clear selection + leave select mode
  const finishBulk = () => { setPicker(null); exitSelect(); };

  const chips = [["all", "All"], ["7d", "7 days"], ["30d", "30 days"], ["month", "Month"], ["custom", "Custom"]];

  return (
    <div>
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 6 }}>
        {accounts.map((a) => {
          const active = a.id === currentAccount;
          const bal = balanceOf(tx, a.id);
          return (
            <button key={a.id} onClick={() => setCurrentAccount(a.id)} style={{
              flexShrink: 0, padding: "10px 16px", borderRadius: 14, cursor: "pointer",
              border: `1px solid ${active ? a.color : t.line}`, background: active ? a.color + "22" : t.card,
              color: t.text, textAlign: "left", minWidth: 130 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: a.color }} />
                <span style={{ fontSize: 13, color: t.dim }}>{a.name}</span>
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{bal < 0 ? "−" : ""}{fmt(bal)}</div>
            </button>
          );
        })}
      </div>

      {/* search + date filter */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: t.dim, fontSize: 14 }}>⌕</span>
          <input value={search} onChange={(e) => { setShowAll(false); patch({ search: e.target.value }); }}
            placeholder="Search notes" style={{ ...inp(t), paddingLeft: 32, paddingRight: search ? 32 : 13 }} />
          {search && <button onClick={() => patch({ search: "" })} aria-label="Clear search" style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", border: "none", background: "transparent", color: t.dim, cursor: "pointer", fontSize: 16 }}>×</button>}
        </div>
        <div style={{ display: "flex", gap: 5 }}>
          {chips.map(([id, label]) => {
            const on = preset === id;
            return <button key={id} onClick={() => id === "custom" ? patch({ preset: "custom" }) : applyPreset(id)} style={{
              flex: 1, minWidth: 0, fontSize: 12, padding: "6px 4px", borderRadius: 20, cursor: "pointer", whiteSpace: "nowrap",
              border: `1px solid ${on ? t.accent : t.line}`, background: on ? t.accent + "22" : "transparent", color: on ? t.accent : t.dim }}>{label}</button>;
          })}
        </div>
        {preset === "custom" && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="date" value={from} onChange={(e) => patch({ from: e.target.value })} style={{ ...inp(t), flex: 1, fontSize: 13 }} />
            <span style={{ color: t.dim, fontSize: 13 }}>to</span>
            <input type="date" value={to} onChange={(e) => patch({ to: e.target.value })} style={{ ...inp(t), flex: 1, fontSize: 13 }} />
          </div>
        )}
      </div>

      {/* bulk action bar */}
      {selectMode && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 10px", background: t.accent + "1a", borderRadius: 10, marginTop: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={selectAll} style={{ border: "none", background: "transparent", padding: 0, cursor: "pointer", color: t.accent, fontSize: 13, fontWeight: 600 }}>{allSelected ? "Clear selection" : "Select all"}</button>
            <span style={{ fontSize: 13, color: t.accent }}>{selected.size} selected</span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => selected.size ? setPicker("tag") : null} style={{ ...miniBtn(t), opacity: selected.size ? 1 : 0.5 }}>Tag</button>
            <button onClick={() => selected.size ? setPicker("group") : null} style={{ ...miniBtn(t), opacity: selected.size ? 1 : 0.5 }}>Group</button>
            <button onClick={() => selected.size ? setPicker("account") : null} style={{ ...miniBtn(t), opacity: selected.size ? 1 : 0.5 }}>Account</button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "16px 2px 6px" }}>
        <span style={{ fontSize: 12, letterSpacing: 1, color: t.dim }}>
          {filtering ? `${rows.length} ${rows.length === 1 ? "RESULT" : "RESULTS"}` : "RECENT"} — {cur?.name?.toUpperCase()}
        </span>
        <button onClick={() => selectMode ? exitSelect() : setSelectMode(true)} style={{ border: "none", background: "transparent", padding: 0, cursor: "pointer", color: t.accent, fontSize: 12, fontWeight: 600 }}>{selectMode ? "Done" : "Select"}</button>
      </div>

      {rows.length === 0 && <div style={{ color: t.dim, padding: 24, textAlign: "center", fontSize: 14 }}>{filtering ? "No matching expenses." : "Nothing here yet. Tap + to add one."}</div>}
      {shown.map((x) => (
        <TxRow key={x.id} x={x} t={t} acct={acct} grp={grp} tagConfig={tagConfig} currentAccount={currentAccount}
          selectMode={selectMode} selected={selected.has(x.id)} onToggleSelect={() => toggleRow(x.id)}
          onEdit={onEdit} onDelete={onDelete} onViewInvoice={onViewInvoice} />
      ))}

      {rows.length > HOME_LIMIT && (
        <button onClick={() => setShowAll((v) => !v)} style={{ ...secondaryBtn(t), width: "100%", marginTop: 12, fontSize: 13, color: t.dim }}>
          {showAll ? "Show less" : `Show all ${rows.length} expenses`}
        </button>
      )}

      {picker === "tag" && <BulkTagPicker t={t} count={selected.size} allTags={allTags} onCancel={() => setPicker(null)}
        onApply={(tags) => { setTx((prev) => prev.map((x) => selected.has(x.id) ? { ...x, tags: [...new Set([...x.tags, ...tags])] } : x)); finishBulk(); }} />}
      {picker === "group" && <BulkGroupPicker t={t} count={selected.size} groups={groups} tx={tx} selected={selected} grp={grp} setGroups={setGroups} onCancel={() => setPicker(null)}
        onApply={(gId) => { setTx((prev) => prev.map((x) => selected.has(x.id) ? { ...x, group: gId } : x)); finishBulk(); }} />}
      {picker === "account" && <BulkAccountPicker t={t} count={selected.size} accounts={accounts} currentAccount={currentAccount} setAccounts={setAccounts} onCancel={() => setPicker(null)}
        onApply={(aId) => { setTx((prev) => prev.map((x) => selected.has(x.id) ? { ...x, account: aId } : x)); finishBulk(); }} />}
    </div>
  );
}

// ── BULK PICKERS (Home multi-select) ──────────────────────────────────────────
// Tag picker: mirrors the add/edit form — pending chips, type-to-add, live
// substring suggestions. Applies all pending tags to the whole selection.
function BulkTagPicker({ t, count, allTags, onApply, onCancel }) {
  const [pending, setPending] = useState([]);
  const [v, setV] = useState("");
  const add = (raw) => { const c = raw.trim().toLowerCase().replace(/\s+/g, "-"); if (c && !pending.includes(c)) setPending([...pending, c]); setV(""); };
  const sug = allTags.filter((tg) => !pending.includes(tg) && tg.includes(v.toLowerCase())).slice(0, 8);
  return (
    <Modal t={t} onClose={onCancel}>
      <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 14 }}>Add tags <span style={{ color: t.dim, fontWeight: 400, fontSize: 14 }}>· {count} selected</span></div>
      {pending.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {pending.map((tg) => <span key={tg} onClick={() => setPending(pending.filter((x) => x !== tg))} style={{ ...pill(t), background: t.accent + "22", color: t.accent, cursor: "pointer" }}>{tg} ×</span>)}
        </div>
      )}
      <input value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(v); } }}
        placeholder="Type a tag, press Enter" style={{ ...inp(t), marginBottom: sug.length ? 6 : 14 }} autoFocus />
      {sug.length > 0 && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>{sug.map((tg) => <span key={tg} style={{ ...pill(t), cursor: "pointer", opacity: 0.85 }} onClick={() => add(tg)}>+ {tg}</span>)}</div>}
      <button style={{ ...primaryBtn(t), width: "100%" }} onClick={() => pending.length && onApply(pending)}>Apply to {count} expense{count > 1 ? "s" : ""}</button>
      <button style={{ ...secondaryBtn(t), width: "100%", marginTop: 8 }} onClick={onCancel}>Cancel</button>
    </Modal>
  );
}

// Group picker: pick an existing group or create a new one inline. If any of the
// selected already belong to a group, an override warning intercepts FIRST —
// except when creating a NEW group (a fresh destination needs no override).
function BulkGroupPicker({ t, count, groups, tx, selected, grp, setGroups, onApply, onCancel }) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[4]);
  const [warnFor, setWarnFor] = useState(null); // { gId, gName }

  const conflicts = useMemo(() => tx.filter((x) => selected.has(x.id) && x.group), [tx, selected]);
  const conflictGroups = [...new Set(conflicts.map((x) => grp(x.group)?.name).filter(Boolean))];

  const choose = (gId, gName) => {
    if (conflicts.length === 0) return onApply(gId);
    setWarnFor({ gId, gName }); // existing group + conflicts → warn first
  };
  const createNew = () => {
    if (!name.trim()) return;
    const g = { id: "g_" + uid(), name: name.trim(), color };
    setGroups((p) => [...p, g]);
    onApply(g.id); // new group: skip the override warning entirely
  };

  if (warnFor) {
    return (
      <Modal t={t} onClose={() => setWarnFor(null)}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Override group?</div>
        <div style={{ display: "flex", gap: 10, padding: 12, borderRadius: 12, background: t.amber + "1a", marginBottom: 16 }}>
          <span style={{ fontSize: 18, color: t.amber }}>⚠</span>
          <div style={{ fontSize: 14, color: t.amber, lineHeight: 1.5 }}>
            {conflicts.length} of {count} selected expense{conflicts.length > 1 ? "s" : ""} already {conflicts.length > 1 ? "have" : "has"} a group{conflictGroups.length ? ` (leaving ${conflictGroups.join(", ")})` : ""}. An expense can only be in one group. Confirm to override {conflicts.length > 1 ? "them" : "it"} with “{warnFor.gName}”.
          </div>
        </div>
        <button style={{ ...primaryBtn(t), width: "100%", marginBottom: 8 }} onClick={() => onApply(warnFor.gId)}>Confirm and override</button>
        <button style={{ ...secondaryBtn(t), width: "100%" }} onClick={() => setWarnFor(null)}>Cancel</button>
      </Modal>
    );
  }

  return (
    <Modal t={t} onClose={onCancel}>
      <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 14 }}>Add to group <span style={{ color: t.dim, fontWeight: 400, fontSize: 14 }}>· {count} selected</span></div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
        {groups.map((g) => (
          <button key={g.id} onClick={() => choose(g.id, g.name)} style={{ display: "flex", alignItems: "center", gap: 10, padding: 12, borderRadius: 12, border: `1px solid ${t.line}`, background: t.card, cursor: "pointer", textAlign: "left", color: t.text }}>
            <span style={{ width: 12, height: 12, borderRadius: "50%", background: g.color }} />
            <span style={{ fontSize: 15 }}>{g.name}</span>
          </button>
        ))}
      </div>
      {creating ? (
        <div style={{ padding: 14, border: `1px solid ${t.line}`, borderRadius: 12, background: t.card }}>
          <div style={{ fontSize: 12, color: t.dim, marginBottom: 8 }}>New group</div>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Goa trip" style={{ ...inp(t), marginBottom: 10 }} autoFocus />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            {COLORS.map((c) => <button key={c} onClick={() => setColor(c)} style={{ width: 26, height: 26, borderRadius: "50%", background: c, cursor: "pointer", border: color === c ? `2px solid ${t.text}` : "2px solid transparent" }} />)}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={{ ...primaryBtn(t), flex: 1 }} onClick={createNew}>Create and add</button>
            <button style={secondaryBtn(t)} onClick={() => setCreating(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setCreating(true)} style={{ width: "100%", padding: 11, borderRadius: 12, cursor: "pointer", color: t.accent, border: `1px dashed ${t.accent}88`, background: "transparent" }}>+ New group</button>
      )}
      <button style={{ ...secondaryBtn(t), width: "100%", marginTop: 12 }} onClick={onCancel}>Cancel</button>
    </Modal>
  );
}

// Account picker: move the selection to another account (or a new one). The
// current account is shown but blocked. Reassigns x.account for each selected.
function BulkAccountPicker({ t, count, accounts, currentAccount, setAccounts, onApply, onCancel }) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const createNew = () => {
    if (!name.trim()) return;
    const a = { id: "a_" + uid(), name: name.trim(), color };
    setAccounts((p) => [...p, a]);
    onApply(a.id);
  };
  return (
    <Modal t={t} onClose={onCancel}>
      <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 14 }}>Move to account <span style={{ color: t.dim, fontWeight: 400, fontSize: 14 }}>· {count} selected</span></div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
        {accounts.map((a) => {
          const isCur = a.id === currentAccount;
          return (
            <button key={a.id} disabled={isCur} onClick={() => !isCur && onApply(a.id)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 12, borderRadius: 12, border: `1px solid ${t.line}`, background: t.card, cursor: isCur ? "default" : "pointer", textAlign: "left", color: t.text, opacity: isCur ? 0.55 : 1 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 12, height: 12, borderRadius: "50%", background: a.color }} />
                <span style={{ fontSize: 15 }}>{a.name}</span>
              </span>
              {isCur && <span style={{ fontSize: 11, color: t.dim }}>current</span>}
            </button>
          );
        })}
      </div>
      {creating ? (
        <div style={{ padding: 14, border: `1px solid ${t.line}`, borderRadius: 12, background: t.card }}>
          <div style={{ fontSize: 12, color: t.dim, marginBottom: 8 }}>New account</div>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Savings" style={{ ...inp(t), marginBottom: 10 }} autoFocus />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            {COLORS.map((c) => <button key={c} onClick={() => setColor(c)} style={{ width: 26, height: 26, borderRadius: "50%", background: c, cursor: "pointer", border: color === c ? `2px solid ${t.text}` : "2px solid transparent" }} />)}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={{ ...primaryBtn(t), flex: 1 }} onClick={createNew}>Create and move</button>
            <button style={secondaryBtn(t)} onClick={() => setCreating(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setCreating(true)} style={{ width: "100%", padding: 11, borderRadius: 12, cursor: "pointer", color: t.accent, border: `1px dashed ${t.accent}88`, background: "transparent" }}>+ New account</button>
      )}
      <button style={{ ...secondaryBtn(t), width: "100%", marginTop: 12 }} onClick={onCancel}>Cancel</button>
    </Modal>
  );
}

// small muted "paid via" line: single mode shows just the word, splits show the
// breakdown ("credit 3,550 · cash −50"). Absent for v1 rows with no mode set.
export function ModeLine({ t, payments }) {
  if (!payments || payments.length === 0) return null;
  if (payments.length === 1) return <span style={{ fontSize: 11, color: t.dim }}>{modeShort[payments[0].mode]}</span>;
  return <span style={{ fontSize: 11, color: t.dim }}>{payments.map((p) => `${modeShort[p.mode]} ${p.amount < 0 ? "−" : ""}${fmt(p.amount)}`).join(" · ")}</span>;
}

function TxRow({ x, t, acct, grp, tagConfig, currentAccount, selectMode, selected, onToggleSelect, onEdit, onDelete, onViewInvoice }) {
  const [open, setOpen] = useState(false);
  const repay = isRepayable(x, tagConfig);
  const rec = received(x);
  const isCombined = Array.isArray(x.items) && x.items.length > 0; // v2
  let headline, sub = null, headColor = t.text, sign = "";
  if (x.type === "income") { sign = "+"; headColor = t.green; headline = fmt(x.amount); }
  else if (x.type === "transfer") {
    const incoming = x.toAccount === currentAccount;
    sign = incoming ? "+" : "−"; headColor = t.dim; headline = fmt(x.amount);
  } else {
    sign = "−"; headline = fmt(x.amount - rec);
    if (repay && rec > 0) {
      sub = <span style={{ fontSize: 12, color: t.dim }}><span style={{ color: t.red }}>−</span>{fmt(x.amount)}{"  "}<span style={{ color: t.green }}>+</span>{fmt(rec)}{outstanding(x) > 0 ? `  · ${fmt(outstanding(x))} owed` : "  · settled"}</span>;
    } else if (repay && x.owed > 0) {
      sub = <span style={{ fontSize: 12, color: t.amber }}>{fmt(outstanding(x))} owed back</span>;
    }
  }
  let label = x.note || "(no note)";
  if (x.type === "transfer") label = (x.toAccount === currentAccount ? "From " : "To ") + acct(x.toAccount === currentAccount ? x.account : x.toAccount)?.name;

  const actions = (
    <div style={{ display: "flex", gap: 8, marginTop: 12 }} onClick={(e) => e.stopPropagation()}>
      <button style={miniBtn(t)} onClick={() => onEdit(x)}>Edit</button>
      {x.invoice && <button style={miniBtn(t)} onClick={() => onViewInvoice(x.invoice)}>View invoice</button>}
      {x.proof && <button style={miniBtn(t)} onClick={() => onViewInvoice(x.proof)}>View proof</button>}
      <button style={{ ...miniBtn(t), color: t.red, borderColor: t.red + "55" }} onClick={() => onDelete(x.id)}>Delete</button>
    </div>
  );

  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, borderBottom: `1px solid ${t.line}`, padding: "12px 8px", borderRadius: 10, cursor: "pointer", background: selectMode && selected ? t.accent + "14" : "transparent" }} onClick={() => selectMode ? onToggleSelect() : setOpen(!open)}>
      {selectMode && (
        <span style={{ flexShrink: 0, marginTop: 2, width: 20, height: 20, borderRadius: 6, border: `1.5px solid ${selected ? t.accent : t.dim}`, background: selected ? t.accent : "transparent", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>{selected ? "✓" : ""}</span>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 15, fontWeight: 500 }}>{label}</span>
            {x.receiver && <span style={{ fontSize: 13, color: t.dim, fontWeight: 300 }}>→ {x.receiver}</span>}
            {x.group && <span style={{ ...pill(t), background: grp(x.group)?.color + "22", color: grp(x.group)?.color }}>{grp(x.group)?.name}</span>}
            {x.invoice && <span title="has invoice" style={{ fontSize: 12, color: t.dim }}>📎</span>}
            {x.proof && <span title="has payment proof" style={{ fontSize: 12, color: t.dim }}>🧾</span>}
            {isCombined && (
              <span style={{ ...pill(t), display: "inline-flex", alignItems: "center", gap: 4 }}>
                {x.items.length} items <span style={{ fontSize: 10, transform: open ? "rotate(90deg)" : "none", display: "inline-block", transition: "transform .15s" }}>›</span>
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 5, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: t.dim }}>{niceDate(x.date)}</span>
            {visibleTags(x.tags, tagConfig).map((tag) => <span key={tag} style={pill(t)}>{tag}</span>)}
            <ModeLine t={t} payments={x.payments} />
          </div>
        </div>
        <div style={{ textAlign: "right", marginLeft: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: headColor }}>{sign}{headline}</div>
          {sub && <div style={{ marginTop: 3 }}>{sub}</div>}
        </div>
      </div>
      {isCombined && open && !selectMode && (
        <div onClick={(e) => e.stopPropagation()}>
          <div style={{ marginTop: 10, marginLeft: 6, borderLeft: `2px solid ${t.line}`, paddingLeft: 12 }}>
            {x.items.map((it) => (
              <div key={it.id} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px dashed ${t.line}` }}>
                <span style={{ fontSize: 13.5 }}>{it.note || "(item)"}</span>
                <span style={{ fontSize: 13.5, color: t.dim }}>−{fmt(it.amount)}</span>
              </div>
            ))}
          </div>
          {actions}
        </div>
      )}
      {!isCombined && open && !selectMode && actions}
      </div>
    </div>
  );
}

// ── TAG CLOUD (clipping) ──────────────────────────────────────────────────────
function TagCloud({ t, tags, selected, onToggle, limit = 10 }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? tags : tags.slice(0, limit);
  const hidden = tags.length - shown.length;
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", maxHeight: expanded ? 180 : "none", overflowY: expanded ? "auto" : "visible" }}>
      {shown.map((tag) => {
        const on = selected.includes(tag);
        return <button key={tag} onClick={() => onToggle(tag)} style={{ ...pill(t), cursor: "pointer", fontSize: 13, padding: "6px 12px", background: on ? t.accent : t.card, color: on ? "#fff" : t.text, border: `1px solid ${on ? t.accent : t.line}` }}>{tag}</button>;
      })}
      {hidden > 0 && !expanded && <button onClick={() => setExpanded(true)} style={{ ...pill(t), cursor: "pointer", fontSize: 13, padding: "6px 12px", color: t.accent, border: `1px dashed ${t.accent}55` }}>+{hidden} more</button>}
      {expanded && tags.length > limit && <button onClick={() => setExpanded(false)} style={{ ...pill(t), cursor: "pointer", fontSize: 13, padding: "6px 12px", color: t.dim, border: `1px dashed ${t.line}` }}>show less</button>}
    </div>
  );
}

// ── ANALYZE ───────────────────────────────────────────────────────────────────
export function Analyze({ t, tx, acct, grp, accounts, groups, tagConfig }) {
  const [acctFilter, setAcctFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const [selected, setSelected] = useState([]);
  const [mode, setMode] = useState("AND");
  const [negate, setNegate] = useState(false); // v2: NOT — invert the tag match
  const [typeFilter, setTypeFilter] = useState("all");
  const [modeFilter, setModeFilter] = useState("all"); // v2: payment mode filter
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [datePreset, setDatePreset] = useState("all");

  const applyPreset = (preset) => {
    setDatePreset(preset);
    const now = new Date();
    const iso = (d) => d.toISOString().slice(0, 10);
    if (preset === "all") { setFromDate(""); setToDate(""); }
    else if (preset === "month") { setFromDate(iso(new Date(now.getFullYear(), now.getMonth(), 1))); setToDate(iso(new Date(now.getFullYear(), now.getMonth() + 1, 0))); }
    else if (preset === "lastmonth") { setFromDate(iso(new Date(now.getFullYear(), now.getMonth() - 1, 1))); setToDate(iso(new Date(now.getFullYear(), now.getMonth(), 0))); }
    else if (preset === "3mo") { setFromDate(iso(new Date(now.getFullYear(), now.getMonth() - 2, 1))); setToDate(iso(new Date(now.getFullYear(), now.getMonth() + 1, 0))); }
    else if (preset === "year") { setFromDate(iso(new Date(now.getFullYear(), 0, 1))); setToDate(iso(new Date(now.getFullYear(), 11, 31))); }
  };

  const scopeTx = useMemo(() => tx.filter((x) => {
    if (acctFilter !== "all" && x.account !== acctFilter && x.toAccount !== acctFilter) return false;
    if (groupFilter === "none" && x.group) return false;
    if (groupFilter !== "all" && groupFilter !== "none" && x.group !== groupFilter) return false;
    if (fromDate && x.date < fromDate) return false;
    if (toDate && x.date > toDate) return false;
    return true;
  }), [tx, acctFilter, groupFilter, fromDate, toDate]);

  const scopeTags = useMemo(() => [...new Set(scopeTx.flatMap((x) => visibleTags(x.tags, tagConfig)))].sort(), [scopeTx, tagConfig]); // v2: ghosts hidden
  const toggle = (tag) => setSelected((s) => {
    const next = s.includes(tag) ? s.filter((x) => x !== tag) : [...s, tag];
    if (next.length === 0) setNegate(false); // no tags → NOT resets and greys out
    return next;
  });

  const filtered = useMemo(() => scopeTx.filter((x) => {
    if (typeFilter !== "all" && x.type !== typeFilter) return false;
    // v2: payment mode filter — "none" surfaces entries with no mode set (v1 data)
    if (modeFilter === "none") { if (x.payments && x.payments.length) return false; }
    else if (modeFilter !== "all") { if (!(x.payments || []).some((p) => p.mode === modeFilter)) return false; }
    if (selected.length === 0) return true;
    // AND/OR builds the base match; NOT inverts it so you see everything that
    // ISN'T the selected combo. e.g. tags {hotel, food} + AND + NOT → all rows
    // that are NOT (hotel AND food).
    const match = mode === "AND" ? selected.every((tg) => x.tags.includes(tg)) : selected.some((tg) => x.tags.includes(tg));
    return negate ? !match : match;
  }), [scopeTx, selected, mode, negate, typeFilter, modeFilter]);

  const totals = useMemo(() => {
    const byMode = modeFilter !== "all" && modeFilter !== "none";
    let income = 0, expense = 0, repaid = 0;
    for (const x of filtered) {
      // v2: when slicing by one mode, split payments contribute only that
      // mode's share (e.g. ₹3,550 on card + −₹50 cash → card view counts 3,550)
      const share = byMode ? (x.payments || []).filter((p) => p.mode === modeFilter).reduce((s, p) => s + p.amount, 0) : x.amount;
      if (x.type === "income") income += share;
      if (x.type === "expense") { expense += share; if (!byMode) repaid += received(x); }
    }
    return { income, expense, repaid, net: income - expense + repaid, count: filtered.length };
  }, [filtered, modeFilter]);

  const scopeLabel = () => {
    const parts = [];
    if (acctFilter !== "all") parts.push(acct(acctFilter)?.name);
    if (groupFilter === "none") parts.push("No group");
    else if (groupFilter !== "all") parts.push(grp(groupFilter)?.name);
    if (selected.length) parts.push((negate ? "not " : "") + selected.join(mode === "AND" ? " + " : " / "));
    if (typeFilter !== "all") parts.push(typeFilter);
    if (modeFilter === "none") parts.push("no payment mode");
    else if (modeFilter !== "all") parts.push("via " + modeFilter);
    if (fromDate || toDate) parts.push(`${fromDate || "start"} → ${toDate || "now"}`);
    return parts.join(" · ") || "All transactions";
  };

  const doExport = () => exportStatement({
    scope: scopeLabel(), rows: filtered, totals,
    lookups: { acctName: (id) => acct(id)?.name, grpName: (id) => grp(id)?.name, tagConfig },
  });

  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        <select value={acctFilter} onChange={(e) => setAcctFilter(e.target.value)} style={sel(t)}>
          <option value="all">All accounts</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select value={groupFilter} onChange={(e) => { setGroupFilter(e.target.value); setSelected([]); setNegate(false); }} style={sel(t)}>
          <option value="all">All groups</option>
          <option value="none">— No group —</option>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={sel(t)}>
          <option value="all">All types</option>
          <option value="income">Income</option>
          <option value="expense">Expense</option>
          <option value="transfer">Transfer</option>
        </select>
        <select value={modeFilter} onChange={(e) => setModeFilter(e.target.value)} style={sel(t)}>
          <option value="all">All payment modes</option>
          {MODES.map((m) => <option key={m} value={m}>{m[0].toUpperCase() + m.slice(1)}</option>)}
          <option value="none">— No mode set —</option>
        </select>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        {[["all", "All time"], ["month", "This month"], ["lastmonth", "Last month"], ["3mo", "Last 3 mo"], ["year", "This year"]].map(([id, label]) => (
          <button key={id} onClick={() => applyPreset(id)} style={{ ...pill(t), cursor: "pointer", fontSize: 12, padding: "6px 11px", background: datePreset === id ? t.accent : t.card, color: datePreset === id ? "#fff" : t.text, border: `1px solid ${datePreset === id ? t.accent : t.line}` }}>{label}</button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14 }}>
        <input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setDatePreset("custom"); }} style={{ ...sel(t), flex: 1 }} />
        <span style={{ color: t.dim, fontSize: 13 }}>to</span>
        <input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setDatePreset("custom"); }} style={{ ...sel(t), flex: 1 }} />
      </div>

      <div style={{ fontSize: 12, letterSpacing: 1, color: t.dim, margin: "2px 2px 10px" }}>
        SLICE BY TAGS{groupFilter !== "all" && groupFilter !== "none" ? ` · within ${grp(groupFilter)?.name}` : ""}
      </div>
      {scopeTags.length === 0 ? <div style={{ color: t.dim, fontSize: 14, marginBottom: 14 }}>No tags in this scope.</div>
        : <div style={{ marginBottom: 14 }}><TagCloud t={t} tags={scopeTags} selected={selected} onToggle={toggle} /></div>}

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
        <Seg t={t} options={["AND", "OR"]} value={mode} onChange={setMode} disabled={selected.length < 2} />
        <button
          onClick={() => selected.length && setNegate((v) => !v)}
          disabled={selected.length === 0}
          title="Show transactions that do NOT match the selected tags"
          style={{ padding: "8px 16px", borderRadius: 12, border: `1px solid ${negate ? t.red : t.line}`, cursor: selected.length ? "pointer" : "not-allowed", fontSize: 13, fontWeight: 600, background: negate ? t.red : t.card, color: selected.length === 0 ? t.dim : (negate ? "#fff" : t.text), opacity: selected.length === 0 ? 0.4 : 1 }}>
          NOT
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
        <Stat t={t} label="Income" value={fmt(totals.income)} color={t.green} />
        <Stat t={t} label="Spent (net)" value={fmt(totals.expense - totals.repaid)} color={t.text} />
        <Stat t={t} label="Net" value={(totals.net < 0 ? "−" : "") + fmt(totals.net)} color={totals.net < 0 ? t.red : t.green} />
      </div>
      {totals.repaid > 0 && <div style={{ fontSize: 12, color: t.dim, marginBottom: 12 }}>includes {fmt(totals.repaid)} repaid back · gross spend {fmt(totals.expense)}</div>}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: t.dim }}>{totals.count} matching</span>
        <button style={miniBtn(t)} disabled={!filtered.length} onClick={doExport}>⬇ Export PDF</button>
      </div>
      {filtered.map((x) => (
        <div key={x.id} style={{ borderBottom: `1px solid ${t.line}`, padding: "10px 4px", display: "flex", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 14 }}>{x.note || "(no note)"}{x.receiver && <span style={{ fontSize: 12, color: t.dim, fontWeight: 300 }}> → {x.receiver}</span>}</div>
            <div style={{ display: "flex", gap: 5, marginTop: 4, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 10, color: t.dim }}>{niceDate(x.date)}</span>
              <span style={{ ...pill(t), fontSize: 10 }}>{acct(x.account)?.name}</span>
              {x.group && <span style={{ ...pill(t), fontSize: 10 }}>{grp(x.group)?.name}</span>}
              {visibleTags(x.tags, tagConfig).map((tg) => <span key={tg} style={{ ...pill(t), fontSize: 10 }}>{tg}</span>)}
              <ModeLine t={t} payments={x.payments} />
            </div>
          </div>
          <div style={{ fontWeight: 700, color: x.type === "income" ? t.green : t.text, whiteSpace: "nowrap", marginLeft: 8 }}>
            {x.type === "income" ? "+" : x.type === "expense" ? "−" : "↔"}{fmt(x.type === "expense" ? x.amount - received(x) : x.amount)}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── OWED ──────────────────────────────────────────────────────────────────────
export function Owed({ t, tx, acct, tagConfig, onAddRepayment, onRemoveRepayment, onEdit }) {
  const repayable = tx.filter((x) => isRepayable(x, tagConfig) && x.owed > 0);
  const pending = repayable.filter((x) => outstanding(x) > 0);
  const done = repayable.filter((x) => outstanding(x) === 0);
  const totalOwed = pending.reduce((s, x) => s + outstanding(x), 0);
  const [logging, setLogging] = useState(null);

  return (
    <div>
      <Stat t={t} label="Outstanding (still owed to you)" value={fmt(totalOwed)} color={t.amber} big />
      <div style={{ fontSize: 12, letterSpacing: 1, color: t.dim, margin: "18px 2px 8px" }}>PENDING</div>
      {pending.length === 0 && <div style={{ color: t.dim, fontSize: 14, padding: 12 }}>Nothing outstanding. Nice.</div>}
      {pending.map((x) => (
        <div key={x.id} style={{ borderBottom: `1px solid ${t.line}`, padding: "12px 4px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15 }} onClick={() => onEdit(x)}>{x.note}</div>
              <div style={{ fontSize: 12, color: t.dim, marginTop: 3 }}>{niceDate(x.date)} · {acct(x.account)?.name} · paid {fmt(x.amount)}, owed {fmt(x.owed)}</div>
              {received(x) > 0 && (
                <div style={{ fontSize: 12, color: t.dim, marginTop: 4 }}>got back: {x.repayments.map((r) => (
                  <span key={r.id} style={{ ...pill(t), marginRight: 4, fontSize: 11 }}>{fmt(r.amount)} <span style={{ cursor: "pointer", color: t.red }} onClick={() => onRemoveRepayment(x.id, r.id)}>×</span></span>
                ))}</div>
              )}
            </div>
            <div style={{ textAlign: "right", marginLeft: 10 }}>
              <div style={{ fontWeight: 700, color: t.amber }}>{fmt(outstanding(x))}</div>
              <div style={{ fontSize: 11, color: t.dim }}>of {fmt(x.owed)}</div>
            </div>
          </div>
          {logging === x.id
            ? <RepaymentInput t={t} max={outstanding(x)} onCancel={() => setLogging(null)} onSubmit={(amt) => { onAddRepayment(x.id, amt); setLogging(null); }} />
            : (
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button style={miniBtn(t)} onClick={() => setLogging(x.id)}>+ record repayment</button>
                <button style={{ ...miniBtn(t), color: t.green, borderColor: t.green + "55" }} onClick={() => onAddRepayment(x.id, outstanding(x))}>✓ paid in full</button>
              </div>
            )}
        </div>
      ))}

      <div style={{ fontSize: 12, letterSpacing: 1, color: t.dim, margin: "22px 2px 8px" }}>SETTLED</div>
      {done.length === 0 && <div style={{ color: t.dim, fontSize: 14, padding: 12 }}>No history yet.</div>}
      {done.map((x) => (
        <div key={x.id} style={{ borderBottom: `1px solid ${t.line}`, padding: "10px 4px", display: "flex", justifyContent: "space-between", opacity: 0.7 }}>
          <div>
            <div style={{ fontSize: 14 }}>{x.note}</div>
            <div style={{ fontSize: 12, color: t.dim, marginTop: 3 }}>{niceDate(x.date)} · {acct(x.account)?.name}</div>
          </div>
          <span style={{ color: t.green, fontWeight: 600 }}>{fmt(x.owed)} ✓</span>
        </div>
      ))}
    </div>
  );
}

function RepaymentInput({ t, max, onCancel, onSubmit }) {
  const [v, setV] = useState("");
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
      <input autoFocus type="number" inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} placeholder={`up to ${fmt(max)}`} style={{ ...inp(t), flex: 1 }} />
      <button style={primaryBtn(t)} onClick={() => { const a = parseFloat(v); if (a > 0) onSubmit(Math.min(a, max)); }}>Add</button>
      <button style={secondaryBtn(t)} onClick={onCancel}>✕</button>
    </div>
  );
}

// ── SETTINGS ──────────────────────────────────────────────────────────────────
export function Settings({ t, accounts, setAccounts, groups, setGroups, tx, setTx, allTags, tagConfig, setTagConfig, currentAccount, setCurrentAccount, onAddToGroup, onSignOut, driveEmail }) {
  const [tab, setTab] = useState("accounts");
  return (
    <div>
      <div style={{ display: "flex", gap: 4, padding: 4, background: t.card, borderRadius: 12, border: `1px solid ${t.line}`, marginBottom: 18 }}>
        {[["accounts", "Accounts"], ["groups", "Groups"], ["tags", "Tag features"]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ flex: 1, padding: 8, borderRadius: 9, border: "none", cursor: "pointer", background: tab === id ? t.accent : "transparent", color: tab === id ? "#fff" : t.dim, fontSize: 13, fontWeight: 600 }}>{label}</button>
        ))}
      </div>
      {tab === "accounts" && <AccountsManager t={t} accounts={accounts} setAccounts={setAccounts} tx={tx} setTx={setTx} currentAccount={currentAccount} setCurrentAccount={setCurrentAccount} />}
      {tab === "groups" && <GroupsManager t={t} groups={groups} setGroups={setGroups} tx={tx} setTx={setTx} allTags={allTags} onAddToGroup={onAddToGroup} />}
      {tab === "tags" && <TagFeatures t={t} allTags={allTags} tagConfig={tagConfig} setTagConfig={setTagConfig} />}

      <div style={{ marginTop: 28, paddingTop: 18, borderTop: `1px solid ${t.line}` }}>
        <div style={{ fontSize: 12, color: t.dim, marginBottom: 8 }}>Synced to Google Drive{driveEmail ? ` · ${driveEmail}` : ""}</div>
        <button style={{ ...secondaryBtn(t), width: "100%" }} onClick={onSignOut}>Sign out</button>
      </div>
    </div>
  );
}

function Editor({ t, title, name, setName, color, setColor, onSave, onCancel, placeholder }) {
  return (
    <div style={{ marginTop: 16, padding: 14, border: `1px solid ${t.line}`, borderRadius: 14, background: t.card }}>
      <div style={{ fontSize: 13, color: t.dim, marginBottom: 10 }}>{title}</div>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder={placeholder} style={{ ...inp(t), marginBottom: 10 }} />
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {COLORS.map((c) => <button key={c} onClick={() => setColor(c)} style={{ width: 26, height: 26, borderRadius: "50%", background: c, cursor: "pointer", border: color === c ? `2px solid ${t.text}` : "2px solid transparent" }} />)}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button style={{ ...primaryBtn(t), flex: 1 }} onClick={onSave}>Save</button>
        <button style={secondaryBtn(t)} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function CloseModal({ t, entity, others, kind, count, allowUngroup, onCancel, onConfirm }) {
  const [moveTo, setMoveTo] = useState(others[0]?.id);
  return (
    <Modal t={t} onClose={onCancel}>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>{kind === "group" ? "Delete" : "Close"} “{entity.name}”?</div>
      <div style={{ fontSize: 14, color: t.dim, marginBottom: 18 }}>{count > 0 ? `${count} transaction${count > 1 ? "s" : ""} reference this ${kind}. What happens to them?` : `This ${kind} has no transactions.`}</div>
      {count > 0 ? (
        <>
          {allowUngroup && <button style={{ ...primaryBtn(t), width: "100%", marginBottom: 8 }} onClick={() => onConfirm(entity.id, "move", null)}>Keep transactions, just ungroup them</button>}
          {others.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, color: t.dim, marginBottom: 8 }}>{allowUngroup ? "Or move them to:" : "Move transactions to:"}</div>
              <select value={moveTo} onChange={(e) => setMoveTo(e.target.value)} style={{ ...sel(t), width: "100%" }}>{others.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
              <button style={{ ...secondaryBtn(t), marginTop: 10, width: "100%" }} onClick={() => onConfirm(entity.id, "move", moveTo)}>Move & {kind === "group" ? "delete" : "close"}</button>
            </div>
          )}
          <button style={{ ...secondaryBtn(t), width: "100%", color: t.red, borderColor: t.red + "55" }} onClick={() => onConfirm(entity.id, "delete")}>Delete all transactions too</button>
        </>
      ) : <button style={{ ...primaryBtn(t), width: "100%" }} onClick={() => onConfirm(entity.id, "none")}>{kind === "group" ? "Delete" : "Close"} {kind}</button>}
      <button style={{ ...secondaryBtn(t), width: "100%", marginTop: 8 }} onClick={onCancel}>Cancel</button>
    </Modal>
  );
}

function AccountsManager({ t, accounts, setAccounts, tx, setTx, currentAccount, setCurrentAccount }) {
  const [editId, setEditId] = useState(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [closing, setClosing] = useState(null);
  const startNew = () => { setEditId("new"); setName(""); setColor(COLORS[0]); };
  const startEdit = (a) => { setEditId(a.id); setName(a.name); setColor(a.color); };
  const save = () => {
    if (!name.trim()) return;
    if (editId === "new") setAccounts((p) => [...p, { id: "a_" + uid(), name: name.trim(), color }]);
    else setAccounts((p) => p.map((a) => a.id === editId ? { ...a, name: name.trim(), color } : a));
    setEditId(null);
  };
  const closeAccount = (accId, action, moveTo) => {
    if (action === "move" && moveTo) setTx((prev) => prev.map((x) => { let n = { ...x }; if (n.account === accId) n.account = moveTo; if (n.toAccount === accId) n.toAccount = moveTo; return n; }).filter((x) => !(x.type === "transfer" && x.account === x.toAccount)));
    else if (action === "delete") setTx((prev) => prev.filter((x) => x.account !== accId && x.toAccount !== accId));
    setAccounts((p) => p.filter((x) => x.id !== accId));
    if (currentAccount === accId) { const r = accounts.find((a) => a.id !== accId); if (r) setCurrentAccount(r.id); }
    setClosing(null);
  };
  return (
    <div>
      {accounts.map((a) => (
        <div key={a.id} style={{ borderBottom: `1px solid ${t.line}`, padding: "12px 4px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 12, height: 12, borderRadius: "50%", background: a.color }} />
            <div><div style={{ fontSize: 15, fontWeight: 500 }}>{a.name}</div><div style={{ fontSize: 13, color: t.dim }}>{balanceOf(tx, a.id) < 0 ? "−" : ""}{fmt(balanceOf(tx, a.id))}</div></div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button style={miniBtn(t)} onClick={() => startEdit(a)}>Rename</button>
            {accounts.length > 1 && <button style={{ ...miniBtn(t), color: t.red, borderColor: t.red + "55" }} onClick={() => setClosing(a)}>Close</button>}
          </div>
        </div>
      ))}
      {editId ? <Editor t={t} title={editId === "new" ? "New account" : "Edit account"} name={name} setName={setName} color={color} setColor={setColor} onSave={save} onCancel={() => setEditId(null)} placeholder="e.g. Personal" />
        : <button style={{ ...primaryBtn(t), marginTop: 16, width: "100%" }} onClick={startNew}>+ New account</button>}
      {closing && <CloseModal t={t} entity={closing} others={accounts.filter((a) => a.id !== closing.id)} kind="account" count={tx.filter((x) => x.account === closing.id || x.toAccount === closing.id).length} onCancel={() => setClosing(null)} onConfirm={closeAccount} />}
    </div>
  );
}

function GroupsManager({ t, groups, setGroups, tx, setTx, allTags, onAddToGroup }) {
  const [editId, setEditId] = useState(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[5]);
  const [closing, setClosing] = useState(null);
  const [tagging, setTagging] = useState(null);
  const startNew = () => { setEditId("new"); setName(""); setColor(COLORS[5]); };
  const startEdit = (g) => { setEditId(g.id); setName(g.name); setColor(g.color); };
  const save = () => {
    if (!name.trim()) return;
    if (editId === "new") setGroups((p) => [...p, { id: "g_" + uid(), name: name.trim(), color }]);
    else setGroups((p) => p.map((g) => g.id === editId ? { ...g, name: name.trim(), color } : g));
    setEditId(null);
  };
  const closeGroup = (gId, action, moveTo) => {
    if (action === "move") setTx((prev) => prev.map((x) => x.group === gId ? { ...x, group: moveTo || null } : x));
    else if (action === "delete") setTx((prev) => prev.filter((x) => x.group !== gId));
    setGroups((p) => p.filter((g) => g.id !== gId));
    setClosing(null);
  };
  const bulkTag = (gId, tag) => {
    const clean = tag.trim().toLowerCase().replace(/\s+/g, "-");
    if (!clean) return;
    setTx((prev) => prev.map((x) => x.group === gId && !x.tags.includes(clean) ? { ...x, tags: [...x.tags, clean] } : x));
  };
  return (
    <div>
      {groups.length === 0 && <div style={{ color: t.dim, fontSize: 14, padding: 12 }}>No groups yet. Create one to collect related expenses.</div>}
      {groups.map((g) => {
        const count = tx.filter((x) => x.group === g.id).length;
        const total = tx.filter((x) => x.group === g.id && x.type === "expense").reduce((s, x) => s + (x.amount - received(x)), 0);
        return (
          <div key={g.id} style={{ borderBottom: `1px solid ${t.line}`, padding: "12px 4px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 12, height: 12, borderRadius: "50%", background: g.color }} />
                <div><div style={{ fontSize: 15, fontWeight: 500 }}>{g.name}</div><div style={{ fontSize: 13, color: t.dim }}>{count} item{count !== 1 ? "s" : ""} · {fmt(total)} net spend</div></div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button style={miniBtn(t)} onClick={() => startEdit(g)}>Edit</button>
                <button style={{ ...miniBtn(t), color: t.red, borderColor: t.red + "55" }} onClick={() => setClosing(g)}>Delete</button>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <button style={miniBtn(t)} onClick={() => onAddToGroup(g.id)}>+ Add expense here</button>
              <button style={miniBtn(t)} onClick={() => setTagging(tagging === g.id ? null : g.id)}>Tag all</button>
            </div>
            {tagging === g.id && <div style={{ marginTop: 8 }}><BulkTagInput t={t} allTags={allTags} onApply={(tag) => bulkTag(g.id, tag)} /></div>}
          </div>
        );
      })}
      {editId ? <Editor t={t} title={editId === "new" ? "New group" : "Edit group"} name={name} setName={setName} color={color} setColor={setColor} onSave={save} onCancel={() => setEditId(null)} placeholder="e.g. Goa trip" />
        : <button style={{ ...primaryBtn(t), marginTop: 16, width: "100%" }} onClick={startNew}>+ New group</button>}
      {closing && <CloseModal t={t} entity={closing} others={groups.filter((g) => g.id !== closing.id)} kind="group" count={tx.filter((x) => x.group === closing.id).length} allowUngroup onCancel={() => setClosing(null)} onConfirm={closeGroup} />}
    </div>
  );
}

function BulkTagInput({ t, allTags, onApply }) {
  const [v, setV] = useState("");
  const sug = allTags.filter((tg) => tg.includes(v.toLowerCase()) && v).slice(0, 5);
  return (
    <div>
      <div style={{ display: "flex", gap: 8 }}>
        <input value={v} onChange={(e) => setV(e.target.value)} placeholder="tag to apply to all in group" style={{ ...inp(t), flex: 1 }} onKeyDown={(e) => { if (e.key === "Enter") { onApply(v); setV(""); } }} />
        <button style={primaryBtn(t)} onClick={() => { onApply(v); setV(""); }}>Apply</button>
      </div>
      {sug.length > 0 && <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>{sug.map((tg) => <span key={tg} style={{ ...pill(t), cursor: "pointer" }} onClick={() => { onApply(tg); setV(""); }}>{tg}</span>)}</div>}
    </div>
  );
}

function TagFeatures({ t, allTags, tagConfig, setTagConfig }) {
  const [openFeature, setOpenFeature] = useState(null);
  const toggleKey = (tag, key) => setTagConfig((c) => ({ ...c, [tag]: { ...c[tag], [key]: !c[tag]?.[key] } }));
  // each feature is a boolean key on tagConfig[tag]; features stack freely —
  // one tag can be ghost + proof + repay all at once.
  const FEATURES = [
    { id: "repay", name: "Repayment tracking", desc: "Expenses with an enabled tag track owed/received amounts and appear in the Owed tab. For combined multi-item entries, owed applies to the entry total." },
    { id: "invoice", name: "Invoice attachment", desc: "Transactions with an enabled tag get an option to attach a receipt/invoice image, stored in your Drive." },
    { id: "proof", name: "Payment proof tracking", desc: "Same mechanics as invoices: transactions with an enabled tag get an option to attach a payment-proof image, stored in your Drive. A transaction can carry both an invoice and a proof." },
    { id: "receiver", name: "Receiver tagging", desc: "Transactions with an enabled tag get a Receiver field (who the money was for). Shown in light grey next to the note." },
    { id: "ghost", name: "Ghost tags", desc: "Ghost tags stay on transactions and keep powering any other features enabled on them, but the tag itself is hidden on Home, in Analyze (including the slice cloud), and in PDF exports. You'll only see it in the add/edit form." },
  ];
  if (openFeature) {
    const f = FEATURES.find((x) => x.id === openFeature);
    return (
      <div>
        <button style={{ ...miniBtn(t), marginBottom: 14 }} onClick={() => setOpenFeature(null)}>‹ Back to features</button>
        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>{f.name}</div>
        <div style={{ fontSize: 13, color: t.dim, marginBottom: 16, lineHeight: 1.5 }}>{f.desc}</div>
        <div style={{ fontSize: 12, letterSpacing: 1, color: t.dim, marginBottom: 4 }}>ENABLE PER TAG</div>
        {allTags.length === 0 && <div style={{ color: t.dim, fontSize: 14 }}>No tags yet — add some transactions first.</div>}
        {allTags.map((tag) => (
          <div key={tag} style={{ borderBottom: `1px solid ${t.line}`, padding: "12px 4px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 15 }}>{tag}</span>
              {/* show the tag's other enabled features so combos are visible */}
              {Object.entries(tagConfig[tag] || {}).filter(([k, v]) => v && k !== f.id).map(([k]) => (
                <span key={k} style={{ ...pill(t), fontSize: 10 }}>{k}</span>
              ))}
            </div>
            <Toggle t={t} on={!!tagConfig[tag]?.[f.id]} onClick={() => toggleKey(tag, f.id)} />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div>
      <div style={{ fontSize: 13, color: t.dim, marginBottom: 16, lineHeight: 1.5 }}>Special features you can switch on for individual tags. Features stack — one tag can have several enabled (e.g. ghost + payment proof).</div>
      {FEATURES.map((f) => {
        const countOn = allTags.filter((tg) => tagConfig[tg]?.[f.id]).length;
        return (
          <button key={f.id} onClick={() => setOpenFeature(f.id)} style={{ width: "100%", textAlign: "left", borderBottom: `1px solid ${t.line}`, padding: "14px 4px", background: "transparent", border: "none", borderBottomStyle: "solid", cursor: "pointer", color: t.text, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div><div style={{ fontSize: 15, fontWeight: 500 }}>{f.name}</div><div style={{ fontSize: 12, color: t.dim, marginTop: 3 }}>{countOn} tag{countOn !== 1 ? "s" : ""} enabled</div></div>
            <span style={{ color: t.dim, fontSize: 18 }}>›</span>
          </button>
        );
      })}
    </div>
  );
}

// invoice viewer — fetches the receipt from Drive on demand
export function InvoiceViewer({ t, invoice, onClose }) {
  const [url, setUrl] = useState(null);
  const [err, setErr] = useState(false);
  React.useEffect(() => {
    let active = true;
    receiptUrl(invoice.driveId).then((u) => { if (active) setUrl(u); }).catch(() => setErr(true));
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [invoice.driveId]);
  return (
    <Modal t={t} onClose={onClose}>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>{invoice.name || "Invoice"}</div>
      {err ? <div style={{ color: t.dim, fontSize: 14 }}>Couldn't load this receipt.</div>
        : url ? <img src={url} alt="invoice" style={{ width: "100%", borderRadius: 12, display: "block" }} />
          : <div style={{ color: t.dim, fontSize: 14, padding: 20, textAlign: "center" }}>Loading…</div>}
      <button style={{ ...secondaryBtn(t), width: "100%", marginTop: 14 }} onClick={onClose}>Close</button>
    </Modal>
  );
}
