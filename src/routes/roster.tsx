import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/roster")({
  head: () => ({
    meta: [
      { title: "Glasshouse Roster" },
      { name: "description", content: "Weekly staff roster for Glasshouse." },
    ],
  }),
  component: RosterPage,
});

type RosterType = "staff" | "manager";
type Row = {
  id: string;
  staff_name: string;
  position: number;
  day: string;
  is_off: boolean;
  start_time: string | null;
  end_time: string | null;
  roster_type: RosterType;
};
type Snapshot = { id: string; saved_at: string; label: string | null; data: Row[]; roster_type: RosterType };
type Meta = { roster_type: RosterType; week_start_date: string | null; week_start_day: number | null };
type MetaVal = { date: string | null; day: number | null };

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_ABBR = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

const toMins = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const fmtHrs = (m: number) => {
  const h = m / 60;
  return h % 1 === 0 ? `${h}h` : `${h.toFixed(1)}h`;
};
const entryHrs = (r: Row) => {
  if (r.is_off || !r.start_time || !r.end_time) return 0;
  let d = toMins(r.end_time) - toMins(r.start_time);
  if (d < 0) d += 24 * 60;
  return d;
};
const fmt = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "pm" : "am";
  const hh = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return m === 0 ? `${hh}${ampm}` : `${hh}:${m.toString().padStart(2, "0")}${ampm}`;
};
const coversNoon = (r: Row) => {
  if (r.is_off || !r.start_time || !r.end_time) return false;
  const s = toMins(r.start_time);
  let e = toMins(r.end_time);
  if (e < s) e += 24 * 60;
  return s <= 12 * 60 && e > 12 * 60;
};
const afterFive = (r: Row) => {
  if (r.is_off || !r.start_time || !r.end_time) return false;
  let e = toMins(r.end_time);
  const s = toMins(r.start_time);
  if (e < s) e += 24 * 60;
  return e > 17 * 60;
};

const STYLE = `
.gh-wrap{max-width:1080px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#1d1d1b}
.gh-topbar{display:flex;align-items:flex-end;justify-content:space-between;gap:1rem;flex-wrap:wrap;margin-bottom:1rem;border-bottom:2px solid #0d3a2c;padding-bottom:.75rem}
.gh-brand{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap}
.gh-brand h1{font-size:30px;font-weight:700;color:#0d3a2c;letter-spacing:.2px;margin:0}
.gh-brand span{font-size:16px;color:#5b5b55}
.gh-rtoggle{display:inline-flex;border:1px solid #C9A961;border-radius:8px;overflow:hidden;margin-left:6px}
.gh-rtoggle button{font-size:12px;padding:7px 12px;border:0;background:#fff8e6;color:#0d3a2c;cursor:pointer;font-weight:600}
.gh-rtoggle button.active{background:#C9A961;color:#0d3a2c}
.gh-datepick{display:flex;align-items:center;gap:6px;margin-left:8px;font-size:12px;color:#5b5b55}
.gh-datepick input,.gh-daypick{font-size:12px;padding:5px 7px;border:1px solid #cdcbc1;border-radius:6px;background:#fff;color:#1d1d1b}
.gh-toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.gh-seg{display:inline-flex;border:1px solid #cdcbc1;border-radius:8px;overflow:hidden}
.gh-seg button{font-size:12px;padding:7px 12px;border:0;background:transparent;color:#5b5b55;cursor:pointer}
.gh-seg button.active{background:#0d3a2c;color:#fff}
.gh-tool{font-size:12px;padding:7px 13px;border-radius:8px;border:1px solid #cdcbc1;background:transparent;color:#1d1d1b;cursor:pointer}
.gh-tool:hover{background:#f4f3ec}
.gh-tool.primary{background:#0d3a2c;color:#fff;border-color:#0d3a2c}
.gh-tool.accent{background:#C9A961;color:#0d3a2c;border-color:#C9A961}
.gh-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}
.gh-grid{display:grid;grid-template-columns:120px repeat(7,minmax(96px,1fr)) 76px;gap:3px;font-size:12px;min-width:960px}
.gh-grid.nototal{grid-template-columns:120px repeat(7,minmax(96px,1fr));min-width:884px}
.gh-header{font-size:11px;font-weight:600;color:#5b5b55;text-align:center;padding:6px 2px;text-transform:uppercase;letter-spacing:.3px}
.gh-header.total-h{color:#0d3a2c}
.gh-cell{padding:6px 4px;min-height:40px;display:flex;flex-direction:column;gap:3px;min-width:0}
.gh-namecell{background:#F7F4EC;border-radius:4px;justify-content:center;position:relative}
.gh-name{font-weight:600;color:#0d3a2c;font-size:12.5px;display:flex;align-items:center;gap:6px}
.gh-name .nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.gh-name .xbtn{border:0;background:transparent;color:#b3261e;cursor:pointer;font-size:14px;line-height:1;padding:2px 4px;border-radius:4px}
.gh-name .xbtn:hover{background:#fdeceb}
.gh-hours-badge{font-size:10px;font-weight:600;color:#8d8d85}
.gh-shift{background:#E1F5EE;color:#085041;border-radius:3px;padding:4px 6px;font-size:10px;font-weight:600;line-height:1.3;cursor:pointer;text-align:center;border:0;white-space:nowrap}
.gh-shift:hover{opacity:.85}
.gh-off{background:#f4f3ec;color:#8d8d85;font-size:10px;font-weight:600;border-radius:3px;padding:4px 6px;text-align:center;cursor:pointer;border:0}
.gh-off:hover{opacity:.85}
.gh-empty{border:1px dashed #e3e1d8;border-radius:3px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#8d8d85;font-size:16px;min-height:30px;background:transparent}
.gh-empty:hover{background:#f4f3ec}
.gh-totalcell{background:#F7F4EC;border-radius:4px;align-items:center;justify-content:center}
.gh-totalcell .v{font-weight:700;color:#0d3a2c;font-size:13px}
.gh-countcell{background:#fff8e6;border-radius:4px;align-items:center;justify-content:center}
.gh-countcell .v{font-weight:700;color:#0d3a2c;font-size:13px}
.gh-countlabel{background:#C9A961;border-radius:4px;align-items:center;justify-content:center;color:#0d3a2c;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.3px;padding:0 8px;text-align:center}
.gh-grandrow{display:flex;align-items:center;justify-content:flex-end;gap:14px;background:#C9A961;border-radius:4px;padding:9px 14px;margin-top:3px;color:#0d3a2c}
.gh-grandrow .lbl{font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:.4px;margin-right:auto}
.gh-grandrow .v{font-weight:700;font-size:16px}
.gh-note{font-size:11px;color:#5b5b55;margin-top:.75rem}
.gh-modal-box{display:flex;flex-direction:column;gap:12px}
.gh-modal-row{display:flex;flex-direction:column;gap:4px}
.gh-modal-row label{font-size:12px;color:#5b5b55}
.gh-modal-row select,.gh-modal-row input{font-size:13px;padding:7px 8px;border:1px solid #cdcbc1;border-radius:8px;background:#fff;color:#1d1d1b}
.gh-btn-row{display:flex;gap:8px;justify-content:flex-end;margin-top:4px}
.gh-btn{font-size:12px;padding:7px 14px;border-radius:8px;border:1px solid #cdcbc1;background:transparent;color:#1d1d1b;cursor:pointer}
.gh-btn.primary{background:#0d3a2c;color:#fff;border-color:#0d3a2c}
.gh-btn.danger{background:#fdeceb;color:#b3261e;border-color:#f1c2bf}
.gh-snap-panel{margin-top:1.5rem;border:1px solid #e3e1d8;border-radius:8px;padding:12px}
.gh-snap-panel h3{margin:0 0 8px;font-size:13px;font-weight:700;color:#0d3a2c;text-transform:uppercase;letter-spacing:.3px}
.gh-snap-list{display:flex;flex-direction:column;gap:6px}
.gh-snap-row{display:flex;align-items:center;gap:8px;padding:6px 8px;background:#F7F4EC;border-radius:6px;font-size:12px}
.gh-snap-row .when{flex:1;color:#1d1d1b;font-weight:600}
@media print{
  @page{size:A4 landscape;margin:10mm}
  html,body{background:#fff!important}
  [data-sidebar],aside,nav[aria-label*="sidebar" i]{display:none!important}
  header:not(.gh-topbar){display:none!important}
  .gh-toolbar,.gh-empty,.gh-snap-panel,.gh-rtoggle,.gh-name .xbtn,.gh-daypick{display:none!important}
  .gh-modal-backdrop{display:none!important}
  .gh-datepick input{border:0;background:transparent;padding:0}
  .gh-scroll{overflow:visible!important}
  .gh-grid,.gh-grid.nototal{min-width:0!important;gap:0!important;font-size:11px}
  .gh-header{border:1px solid #0d3a2c;background:#0d3a2c;color:#fff!important;padding:6px 4px}
  .gh-cell{border:1px solid #0d3a2c;border-top:0;padding:6px 4px;min-height:46px}
  .gh-grid > .gh-header + .gh-header,
  .gh-grid > .gh-cell + .gh-cell{border-left:0}
  .gh-namecell{background:#F7F4EC!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .gh-shift,.gh-off{background:transparent!important;color:#0d3a2c!important;padding:2px 0;font-size:11px}
  *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
}
.gh-modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:100;display:flex;align-items:center;justify-content:center}
.gh-modal-card{background:#fff;border:1px solid #e3e1d8;border-radius:12px;padding:1.25rem;width:320px}
.gh-modal-card h3{font-size:15px;font-weight:600;margin:0 0 4px}
`;

type ModalState =
  | { kind: "add"; staff: string; day: string }
  | { kind: "edit"; id: string }
  | { kind: "addStaff" }
  | null;

const prettyDate = (d: string | null) => {
  if (!d) return "";
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
};

function buildStaffHTML(title: string, weekDate: string | null, startDay: number | null, staff: string[], rows: Row[]) {
  const orderedDays = startDay != null ? [...DAYS.slice(startDay), ...DAYS.slice(0, startDay)] : DAYS;
  let html = "";
  html += '<div class="gh-header"></div>' + orderedDays.map((d) => `<div class="gh-header">${d}</div>`).join("");
  staff.forEach((person) => {
    html += `<div class="gh-cell gh-namecell"><span class="gh-name">${person}</span></div>`;
    orderedDays.forEach((day) => {
      const ce = rows.filter((e) => e.staff_name === person && e.day === day);
      let c = '<div class="gh-cell">';
      ce.forEach((e) => {
        c += e.is_off
          ? '<div class="gh-off">off</div>'
          : `<div class="gh-shift">${fmt(e.start_time!)}\u2013${fmt(e.end_time!)}</div>`;
      });
      c += "</div>";
      html += c;
    });
  });
  const dateHtml = weekDate
    ? `<span>Pay week commencing ${prettyDate(weekDate)}</span>`
    : (startDay != null ? `<span>Pay week commencing ${DAY_ABBR[startDay]}</span>` : "");
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title><style>${STYLE}</style></head><body><div class="gh-wrap"><div class="gh-topbar"><div class="gh-brand"><h1>Glasshouse</h1><span>${title}</span>${dateHtml}</div></div><div class="gh-grid nototal">${html}</div></div></body></html>`;
}

function RosterPage() {
  const [allRows, setAllRows] = useState<Row[]>([]);
  const [allSnapshots, setAllSnapshots] = useState<Snapshot[]>([]);
  const [meta, setMeta] = useState<Record<RosterType, MetaVal>>({ staff: { date: null, day: null }, manager: { date: null, day: null } });
  const [loading, setLoading] = useState(true);
  const [rosterType, setRosterType] = useState<RosterType>("staff");
  const [mode, setMode] = useState<"manager" | "staff">("manager");
  const [modal, setModal] = useState<ModalState>(null);
  const [mStaff, setMStaff] = useState("");
  const [mDay, setMDay] = useState("Mon");
  const [mType, setMType] = useState<"work" | "off">("work");
  const [mStart, setMStart] = useState("06:00");
  const [mEnd, setMEnd] = useState("10:30");
  const [mNewName, setMNewName] = useState("");

  // Load + realtime
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [a, b, c] = await Promise.all([
        supabase.from("roster_staff").select("*").order("position").order("day"),
        supabase.from("roster_snapshots").select("id,saved_at,label,data,roster_type").order("saved_at", { ascending: false }).limit(100),
        supabase.from("roster_meta").select("roster_type,week_start_date,week_start_day"),
      ]);
      if (cancelled) return;
      if (a.data) setAllRows(a.data as Row[]);
      if (b.data) setAllSnapshots(b.data as Snapshot[]);
      if (c.data) {
        const m: Record<RosterType, MetaVal> = { staff: { date: null, day: null }, manager: { date: null, day: null } };
        (c.data as Meta[]).forEach((x) => { m[x.roster_type] = { date: x.week_start_date, day: x.week_start_day }; });
        setMeta(m);
      }
      setLoading(false);
    };
    load();
    const ch = supabase
      .channel("roster-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "roster_staff" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "roster_snapshots" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "roster_meta" }, () => load())
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, []);

  const rows = useMemo(() => allRows.filter((r) => r.roster_type === rosterType), [allRows, rosterType]);
  const snapshots = useMemo(() => allSnapshots.filter((s) => s.roster_type === rosterType), [allSnapshots, rosterType]);
  const weekDate = meta[rosterType].date;
  const weekStartDay = meta[rosterType].day;
  const orderedDays = useMemo(
    () => (weekStartDay != null ? [...DAYS.slice(weekStartDay), ...DAYS.slice(0, weekStartDay)] : DAYS),
    [weekStartDay],
  );

  const staffList = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((r) => {
      const cur = map.get(r.staff_name);
      if (cur === undefined || r.position < cur) map.set(r.staff_name, r.position);
    });
    const entries = Array.from(map.entries());
    if (rosterType === "staff") {
      return entries
        .sort((a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: "base" }))
        .map(([n]) => n);
    }
    return entries
      .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
      .map(([n]) => n);
  }, [rows, rosterType]);

  const staffView = mode === "staff";
  // Manager roster always shows hours/totals (even in staff view); only the Staff roster hides them in staff view.
  const showTotals = rosterType === "manager" || !staffView;

  const personMins = (p: string) =>
    rows.filter((r) => r.staff_name === p).reduce((a, r) => a + entryHrs(r), 0);

  const grand = useMemo(() => staffList.reduce((a, p) => a + personMins(p), 0), [rows, staffList]);

  const dayCount = (day: string, pred: (r: Row) => boolean) =>
    new Set(rows.filter((r) => r.day === day && pred(r)).map((r) => r.staff_name)).size;

  const addLabel = rosterType === "manager" ? "+ Add manager" : "+ Add staff member";
  const titleSub = rosterType === "manager" ? "Management Roster" : "Roster";
  const newPlaceholder = rosterType === "manager" ? "e.g. Manager name" : "e.g. Jamie Smith";

  // Modal helpers
  const openAdd = (staff: string, day: string) => {
    setModal({ kind: "add", staff, day });
    setMStaff(staff);
    setMDay(day);
    setMType("work");
    setMStart("06:00");
    setMEnd("10:30");
  };
  const openEdit = (id: string) => {
    const r = rows.find((x) => x.id === id);
    if (!r) return;
    setModal({ kind: "edit", id });
    setMStaff(r.staff_name);
    setMDay(r.day);
    setMType(r.is_off ? "off" : "work");
    setMStart(r.is_off ? "06:00" : r.start_time || "06:00");
    setMEnd(r.is_off ? "10:30" : r.end_time || "10:30");
  };
  const openAddStaff = () => {
    setMNewName("");
    setModal({ kind: "addStaff" });
  };
  const closeModal = () => setModal(null);

  const saveEntry = async () => {
    if (!modal) return;
    if (modal.kind === "addStaff") {
      const name = mNewName.trim();
      if (!name) return closeModal();
      const pos = (rows.length ? Math.max(...rows.map((r) => r.position)) : -1) + 1;
      await supabase.from("roster_staff").insert({
        staff_name: name,
        position: pos,
        day: "Mon",
        is_off: true,
        start_time: null,
        end_time: null,
        roster_type: rosterType,
      });
      closeModal();
      return;
    }
    const pos =
      rows.find((r) => r.staff_name === mStaff)?.position ??
      (rows.length ? Math.max(...rows.map((r) => r.position)) + 1 : 0);
    const payload: {
      staff_name: string;
      day: string;
      position: number;
      roster_type: RosterType;
      is_off: boolean;
      start_time: string | null;
      end_time: string | null;
    } =
      mType === "off"
        ? { staff_name: mStaff, day: mDay, position: pos, roster_type: rosterType, is_off: true, start_time: null, end_time: null }
        : { staff_name: mStaff, day: mDay, position: pos, roster_type: rosterType, is_off: false, start_time: mStart, end_time: mEnd };
    if (modal.kind === "edit") {
      await supabase.from("roster_staff").update(payload).eq("id", modal.id);
    } else {
      await supabase.from("roster_staff").insert(payload);
    }
    closeModal();
  };
  const deleteEntry = async () => {
    if (modal?.kind !== "edit") return;
    await supabase.from("roster_staff").delete().eq("id", modal.id);
    closeModal();
  };
  const deleteStaff = async (name: string) => {
    await supabase.from("roster_staff").delete().eq("staff_name", name).eq("roster_type", rosterType);
  };

  const setWeekDate = async (d: string) => {
    setMeta((m) => ({ ...m, [rosterType]: { ...m[rosterType], date: d || null } }));
    await supabase.from("roster_meta").upsert({ roster_type: rosterType, week_start_date: d || null, week_start_day: weekStartDay, updated_at: new Date().toISOString() });
  };
  const setWeekStartDay = async (v: string) => {
    const day = v === "" ? null : Number(v);
    setMeta((m) => ({ ...m, [rosterType]: { ...m[rosterType], day } }));
    await supabase.from("roster_meta").upsert({ roster_type: rosterType, week_start_date: weekDate, week_start_day: day, updated_at: new Date().toISOString() });
  };

  const saveSnapshot = async () => {
    if (!weekDate && !confirm("No date set for this roster yet. Save anyway?")) return;
    const { data: u } = await supabase.auth.getUser();
    await supabase.from("roster_snapshots").insert({
      saved_by: u.user?.id ?? null,
      label: weekDate ? `Week of ${prettyDate(weekDate)}` : null,
      data: rows,
      roster_type: rosterType,
    });
  };
  const loadSnapshot = async (snap: Snapshot) => {
    if (!confirm("Replace the current roster with this saved version? Current shifts will be overwritten.")) return;
    await supabase.from("roster_staff").delete().eq("roster_type", rosterType);
    const toInsert = snap.data.map(({ id: _id, ...rest }) => ({ ...rest, roster_type: rosterType }));
    if (toInsert.length) await supabase.from("roster_staff").insert(toInsert);
  };
  const deleteSnapshot = async (id: string) => {
    await supabase.from("roster_snapshots").delete().eq("id", id);
  };

  const downloadStaff = () => {
    const title = rosterType === "manager" ? "Management Roster" : "Roster";
    const blob = new Blob([buildStaffHTML(title, weekDate, weekStartDay, staffList, rows)], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Glasshouse_${rosterType === "manager" ? "Management" : "Staff"}_Roster.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };
  const shareStaff = async () => {
    const title = rosterType === "manager" ? "Management Roster" : "Roster";
    const html = buildStaffHTML(title, weekDate, weekStartDay, staffList, rows);
    try {
      const file = new File([html], `Glasshouse_${rosterType === "manager" ? "Management" : "Staff"}_Roster.html`, { type: "text/html" });
      const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
      if (nav.canShare && nav.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: `Glasshouse ${title}`, text: `Glasshouse ${title}` } as ShareData);
        return;
      }
    } catch {
      /* fall through */
    }
    downloadStaff();
  };

  return (
    <div className="p-5 bg-white min-h-full">
      <style>{STYLE}</style>
      <div className="gh-wrap">
        <div className="gh-topbar">
          <div className="gh-brand">
            <h1>Glasshouse</h1>
            <span>{titleSub}</span>
            <div className="gh-rtoggle" role="tablist" aria-label="Roster type">
              <button
                className={rosterType === "staff" ? "active" : ""}
                onClick={() => setRosterType("staff")}
              >
                Staff roster
              </button>
              <button
                className={rosterType === "manager" ? "active" : ""}
                onClick={() => setRosterType("manager")}
              >
                Manager roster
              </button>
            </div>
            <label className="gh-datepick">
              Week of{weekStartDay != null ? ` ${DAY_ABBR[weekStartDay]}` : ""}
              <input
                type="date"
                value={weekDate ?? ""}
                onChange={(e) => setWeekDate(e.target.value)}
              />
              <select
                className="gh-daypick"
                aria-label="Week starts on"
                value={weekStartDay ?? ""}
                onChange={(e) => setWeekStartDay(e.target.value)}
              >
                <option value="">Week starts…</option>
                {DAYS.map((d, i) => (
                  <option key={d} value={i}>{d}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="gh-toolbar">
            <div className="gh-seg">
              <button className={mode === "manager" ? "active" : ""} onClick={() => setMode("manager")}>
                Manager view
              </button>
              <button className={mode === "staff" ? "active" : ""} onClick={() => setMode("staff")}>
                Staff view
              </button>
            </div>
            {!staffView && (
              <button className="gh-tool primary" onClick={openAddStaff}>{addLabel}</button>
            )}
            {!staffView && (
              <button className="gh-tool accent" onClick={saveSnapshot}>Save roster</button>
            )}
            <button className="gh-tool" onClick={() => window.print()}>Print</button>
            <button className="gh-tool" onClick={shareStaff}>Share staff copy</button>
            <button className="gh-tool" onClick={downloadStaff}>Download staff copy</button>
          </div>
        </div>

        {loading ? (
          <p className="gh-note">Loading roster…</p>
        ) : (
          <>
            <div className="gh-scroll">
            <div className={`gh-grid${showTotals ? "" : " nototal"}`}>
              <div className="gh-header" />
              {orderedDays.map((d) => (
                <div key={d} className="gh-header">{d}</div>
              ))}
              {showTotals && <div className="gh-header total-h">Total</div>}

              {staffList.map((person) => {
                const mins = personMins(person);
                return (
                  <RosterRow
                    key={person}
                    person={person}
                    mins={mins}
                    staffView={staffView}
                    showTotals={showTotals}
                    rows={rows}
                    days={orderedDays}
                    onAdd={openAdd}
                    onEdit={openEdit}
                    onDeleteStaff={deleteStaff}
                  />
                );
              })}

              {!staffView && (
                <>
                  <div className="gh-cell gh-countlabel">On at 12pm</div>
                  {orderedDays.map((d) => (
                    <div key={`n-${d}`} className="gh-cell gh-countcell">
                      <span className="v">{dayCount(d, coversNoon)}</span>
                    </div>
                  ))}
                  <div className="gh-cell gh-totalcell"><span className="v">–</span></div>

                  <div className="gh-cell gh-countlabel">After 5pm</div>
                  {orderedDays.map((d) => (
                    <div key={`a-${d}`} className="gh-cell gh-countcell">
                      <span className="v">{dayCount(d, afterFive)}</span>
                    </div>
                  ))}
                  <div className="gh-cell gh-totalcell"><span className="v">–</span></div>
                </>
              )}
            </div>
            </div>

            {showTotals && (
              <div className="gh-grandrow">
                <span className="lbl">Total</span>
                <span className="v">{fmtHrs(grand)}</span>
              </div>
            )}

            <p className="gh-note">
              {staffView
                ? rosterType === "manager"
                  ? "Staff view (Management Roster) — shift times shown with totals."
                  : "Staff view — shift times only. This is the version shared with staff (no totals or counts shown)."
                : "Set the week date · Click + to add a shift or mark a day off · Click a shift to edit or remove · × on a name removes that person. Changes save automatically and sync to everyone."}
            </p>

            {!staffView && (
              <div className="gh-snap-panel">
                <h3>Saved rosters ({rosterType === "manager" ? "Management" : "Staff"})</h3>
                {snapshots.length === 0 ? (
                  <p className="gh-note" style={{ marginTop: 0 }}>No saved rosters yet. Click "Save roster" to snapshot the current week.</p>
                ) : (
                  <div className="gh-snap-list">
                    {snapshots.map((s) => (
                      <div key={s.id} className="gh-snap-row">
                        <span className="when">
                          {s.label ?? new Date(s.saved_at).toLocaleString()}
                          <span style={{ color: "#8d8d85", fontWeight: 400, marginLeft: 8 }}>
                            saved {new Date(s.saved_at).toLocaleString()}
                          </span>
                        </span>
                        <button className="gh-btn" onClick={() => loadSnapshot(s)}>Load</button>
                        <button className="gh-btn danger" onClick={() => deleteSnapshot(s.id)}>Delete</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {modal && (
        <div className="gh-modal-backdrop" onClick={closeModal}>
          <div className="gh-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="gh-modal-box">
              {modal.kind === "addStaff" ? (
                <>
                  <h3>{rosterType === "manager" ? "Add manager" : "Add staff member"}</h3>
                  <div className="gh-modal-row">
                    <label>Name</label>
                    <input
                      type="text"
                      autoFocus
                      value={mNewName}
                      onChange={(e) => setMNewName(e.target.value)}
                      placeholder={newPlaceholder}
                      onKeyDown={(e) => { if (e.key === "Enter") saveEntry(); }}
                    />
                  </div>
                  <div className="gh-btn-row">
                    <button className="gh-btn" onClick={closeModal}>Cancel</button>
                    <button className="gh-btn primary" onClick={saveEntry}>Add</button>
                  </div>
                </>
              ) : (
                <>
                  <h3>{modal.kind === "edit" ? "Edit shift" : "Add shift"}</h3>
                  <div className="gh-modal-row">
                    <label>{rosterType === "manager" ? "Manager" : "Staff member"}</label>
                    <select value={mStaff} onChange={(e) => setMStaff(e.target.value)}>
                      {staffList.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div className="gh-modal-row">
                    <label>Day</label>
                    <select value={mDay} onChange={(e) => setMDay(e.target.value)}>
                      {orderedDays.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div className="gh-modal-row">
                    <label>Type</label>
                    <select value={mType} onChange={(e) => setMType(e.target.value as "work" | "off")}>
                      <option value="work">Working shift</option>
                      <option value="off">Off</option>
                    </select>
                  </div>
                  {mType === "work" && (
                    <>
                      <div className="gh-modal-row">
                        <label>Start</label>
                        <input type="time" value={mStart} onChange={(e) => setMStart(e.target.value)} />
                      </div>
                      <div className="gh-modal-row">
                        <label>End</label>
                        <input type="time" value={mEnd} onChange={(e) => setMEnd(e.target.value)} />
                      </div>
                    </>
                  )}
                  <div className="gh-btn-row">
                    <button className="gh-btn" onClick={closeModal}>Cancel</button>
                    {modal.kind === "edit" && (
                      <button className="gh-btn danger" onClick={deleteEntry}>Remove</button>
                    )}
                    <button className="gh-btn primary" onClick={saveEntry}>Save</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RosterRow({
  person,
  mins,
  staffView,
  showTotals,
  rows,
  days,
  onAdd,
  onEdit,
  onDeleteStaff,
}: {
  person: string;
  mins: number;
  staffView: boolean;
  showTotals: boolean;
  rows: Row[];
  days: string[];
  onAdd: (staff: string, day: string) => void;
  onEdit: (id: string) => void;
  onDeleteStaff: (name: string) => void;
}) {
  return (
    <>
      <div className="gh-cell gh-namecell">
        <span className="gh-name">
          <span className="nm">{person}</span>
          {!staffView && mins > 0 && <span className="gh-hours-badge">{fmtHrs(mins)}</span>}
          {!staffView && (
            <button
              className="xbtn"
              title={`Remove ${person}`}
              onClick={() => onDeleteStaff(person)}
            >
              ×
            </button>
          )}
        </span>
      </div>
      {days.map((day) => {
        const cellEntries = rows.filter((r) => r.staff_name === person && r.day === day);
        return (
          <div key={day} className="gh-cell">
            {cellEntries.map((r) =>
              r.is_off ? (
                <button
                  key={r.id}
                  className="gh-off"
                  onClick={staffView ? undefined : () => onEdit(r.id)}
                  disabled={staffView}
                >
                  off
                </button>
              ) : (
                <button
                  key={r.id}
                  className="gh-shift"
                  onClick={staffView ? undefined : () => onEdit(r.id)}
                  disabled={staffView}
                >
                  {fmt(r.start_time!)}–{fmt(r.end_time!)}
                </button>
              ),
            )}
            {!staffView && (
              <button className="gh-empty" onClick={() => onAdd(person, day)}>+</button>
            )}
          </div>
        );
      })}
      {showTotals && (
        <div className="gh-cell gh-totalcell">
          <span className="v">{mins ? fmtHrs(mins) : "–"}</span>
        </div>
      )}
    </>
  );
}
