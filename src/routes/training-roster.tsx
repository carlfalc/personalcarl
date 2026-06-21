import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/training-roster")({
  head: () => ({
    meta: [
      { title: "Glasshouse Training Roster" },
      { name: "description", content: "Weekly staff training roster for Glasshouse." },
    ],
  }),
  component: TrainingRosterPage,
});

type Row = {
  id: string;
  staff_name: string;
  position: number;
  day: string;
  start_time: string | null;
  end_time: string | null;
  training_text: string;
};
type Snapshot = { id: string; saved_at: string; label: string | null; data: Row[] };
type MetaVal = { date: string | null; day: number | null };

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_ABBR = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

const fmt = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "pm" : "am";
  const hh = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return m === 0 ? `${hh}${ampm}` : `${hh}:${m.toString().padStart(2, "0")}${ampm}`;
};

const STYLE = `
.gh-wrap{max-width:1080px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#1d1d1b}
.gh-topbar{display:flex;align-items:flex-end;justify-content:space-between;gap:1rem;flex-wrap:wrap;margin-bottom:1rem;border-bottom:2px solid #0d3a2c;padding-bottom:.75rem}
.gh-brand{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap}
.gh-brand h1{font-size:30px;font-weight:700;color:#0d3a2c;letter-spacing:.2px;margin:0}
.gh-brand span{font-size:16px;color:#5b5b55}
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
.gh-grid{display:grid;grid-template-columns:120px repeat(7,minmax(120px,1fr));gap:3px;font-size:12px;min-width:980px}
.gh-header{font-size:11px;font-weight:600;color:#5b5b55;text-align:center;padding:6px 2px;text-transform:uppercase;letter-spacing:.3px}
.gh-cell{padding:6px 4px;min-height:44px;display:flex;flex-direction:column;gap:4px;min-width:0}
.gh-namecell{background:#F7F4EC;border-radius:4px;justify-content:center;position:relative}
.gh-name{font-weight:600;color:#0d3a2c;font-size:12.5px;display:flex;align-items:center;gap:6px}
.gh-name .nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.gh-name .xbtn{border:0;background:transparent;color:#b3261e;cursor:pointer;font-size:14px;line-height:1;padding:2px 4px;border-radius:4px}
.gh-name .xbtn:hover{background:#fdeceb}
.gh-train{background:#E1F5EE;color:#085041;border-radius:3px;padding:4px 6px;font-size:10px;font-weight:600;line-height:1.3;cursor:pointer;text-align:left;border:0;display:flex;flex-direction:column;gap:2px;width:100%}
.gh-train-wrap{position:relative;width:100%}
.gh-copybtn{position:absolute;top:2px;right:2px;border:0;background:rgba(255,255,255,.75);color:#0d3a2c;font-size:11px;line-height:1;padding:2px 4px;border-radius:3px;cursor:pointer;font-weight:700}
.gh-copybtn:hover{background:#fff}
.gh-paste{border:1px dashed #C9A961!important;background:#fff8e6!important;color:#0d3a2c!important;font-weight:700!important;font-size:10px!important}
.gh-paste:hover{background:#fbeec5!important}
.gh-clipbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;background:#fff8e6;border:1px solid #C9A961;border-radius:8px;padding:8px 12px;margin-bottom:10px;font-size:12px;color:#0d3a2c}
.gh-clipbar-label{font-weight:700}
.gh-clipbar-time{font-weight:600;background:#E1F5EE;color:#085041;padding:2px 6px;border-radius:3px}
.gh-clipbar-text{color:#1d1d1b}
.gh-clipbar-hint{color:#5b5b55;font-style:italic;flex:1;min-width:0}
.gh-train:hover{opacity:.85}
.gh-train .t{font-weight:700;white-space:nowrap}
.gh-train .desc{font-weight:500;color:#0d3a2c;white-space:normal;word-break:break-word;font-size:10px;line-height:1.25}
.gh-empty{border:1px dashed #e3e1d8;border-radius:3px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#8d8d85;font-size:16px;min-height:30px;background:transparent}
.gh-empty:hover{background:#f4f3ec}
.gh-note{font-size:11px;color:#5b5b55;margin-top:.75rem}
.gh-modal-box{display:flex;flex-direction:column;gap:12px}
.gh-modal-row{display:flex;flex-direction:column;gap:4px}
.gh-modal-row label{font-size:12px;color:#5b5b55}
.gh-modal-row select,.gh-modal-row input,.gh-modal-row textarea{font-size:13px;padding:7px 8px;border:1px solid #cdcbc1;border-radius:8px;background:#fff;color:#1d1d1b;font-family:inherit}
.gh-modal-row textarea{min-height:64px;resize:vertical}
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
  .gh-toolbar,.gh-empty,.gh-snap-panel,.gh-name .xbtn,.gh-daypick{display:none!important}
  .gh-modal-backdrop{display:none!important}
  .gh-datepick input{border:0;background:transparent;padding:0}
  .gh-scroll{overflow:visible!important}
  .gh-grid{min-width:0!important;gap:0!important;font-size:10.5px}
  .gh-header{border:1px solid #0d3a2c;background:#0d3a2c;color:#fff!important;padding:6px 4px}
  .gh-cell{border:1px solid #0d3a2c;border-top:0;padding:5px 4px;min-height:54px;vertical-align:top}
  .gh-grid > .gh-header + .gh-header,
  .gh-grid > .gh-cell + .gh-cell{border-left:0}
  .gh-namecell{background:#F7F4EC!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .gh-train{background:transparent!important;color:#0d3a2c!important;padding:2px 0;font-size:10.5px;border-bottom:1px dotted #b9b9af;border-radius:0}
  .gh-train:last-child{border-bottom:0}
  *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
}
.gh-modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:100;display:flex;align-items:center;justify-content:center}
.gh-modal-card{background:#fff;border:1px solid #e3e1d8;border-radius:12px;padding:1.25rem;width:340px}
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

function buildHTML(weekDate: string | null, startDay: number | null, staff: string[], rows: Row[]) {
  const orderedDays = startDay != null ? [...DAYS.slice(startDay), ...DAYS.slice(0, startDay)] : DAYS;
  let html = "";
  html += '<div class="gh-header"></div>' + orderedDays.map((d) => `<div class="gh-header">${d}</div>`).join("");
  staff.forEach((person) => {
    html += `<div class="gh-cell gh-namecell"><span class="gh-name">${person}</span></div>`;
    orderedDays.forEach((day) => {
      const ce = rows.filter((e) => e.staff_name === person && e.day === day);
      let c = '<div class="gh-cell">';
      ce.forEach((e) => {
        const time = e.start_time && e.end_time ? `${fmt(e.start_time)}\u2013${fmt(e.end_time)}` : "";
        const desc = (e.training_text || "").replace(/[<>&]/g, (ch) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[ch]!);
        c += `<div class="gh-train"><span class="t">${time}</span><span class="desc">${desc}</span></div>`;
      });
      c += "</div>";
      html += c;
    });
  });
  const dateHtml = weekDate
    ? `<span>Pay week commencing ${prettyDate(weekDate)}</span>`
    : (startDay != null ? `<span>Pay week commencing ${DAY_ABBR[startDay]}</span>` : "");
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Training Roster</title><style>${STYLE}</style></head><body><div class="gh-wrap"><div class="gh-topbar"><div class="gh-brand"><h1>Glasshouse</h1><span>Training Roster</span>${dateHtml}</div></div><div class="gh-grid">${html}</div></div></body></html>`;
}

function TrainingRosterPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [staffRosterNames, setStaffRosterNames] = useState<string[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [meta, setMeta] = useState<MetaVal>({ date: null, day: null });
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"manager" | "staff">("manager");
  const [modal, setModal] = useState<ModalState>(null);
  const [mStaff, setMStaff] = useState("");
  const [mDay, setMDay] = useState("Mon");
  const [mStart, setMStart] = useState("06:00");
  const [mEnd, setMEnd] = useState("10:30");
  const [mText, setMText] = useState("");
  const [mNewName, setMNewName] = useState("");
  const [clipboard, setClipboard] = useState<{ start_time: string; end_time: string; training_text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [a, b, c, d] = await Promise.all([
        supabase.from("roster_training").select("*").order("position").order("day"),
        supabase.from("roster_training_snapshots").select("id,saved_at,label,data").order("saved_at", { ascending: false }).limit(100),
        supabase.from("roster_training_meta").select("week_start_date,week_start_day").eq("id", 1).maybeSingle(),
        supabase.from("roster_staff").select("staff_name").eq("roster_type", "staff"),
      ]);
      if (cancelled) return;
      if (a.data) setRows(a.data as Row[]);
      if (b.data) setSnapshots(b.data as Snapshot[]);
      if (c.data) setMeta({ date: c.data.week_start_date, day: c.data.week_start_day });
      if (d.data) {
        const names = Array.from(new Set((d.data as { staff_name: string }[]).map((x) => x.staff_name)));
        setStaffRosterNames(names);
      }
      setLoading(false);
    };
    load();
    const ch = supabase
      .channel("training-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "roster_training" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "roster_training_snapshots" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "roster_training_meta" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "roster_staff" }, () => load())
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, []);

  const weekDate = meta.date;
  const weekStartDay = meta.day;
  const orderedDays = useMemo(
    () => (weekStartDay != null ? [...DAYS.slice(weekStartDay), ...DAYS.slice(0, weekStartDay)] : DAYS),
    [weekStartDay],
  );

  const staffList = useMemo(() => {
    const set = new Set<string>(staffRosterNames);
    rows.forEach((r) => set.add(r.staff_name));
    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    );
  }, [rows, staffRosterNames]);

  const staffView = mode === "staff";

  const openAdd = (staff: string, day: string) => {
    setModal({ kind: "add", staff, day });
    setMStaff(staff);
    setMDay(day);
    setMStart("06:00");
    setMEnd("10:30");
    setMText("");
  };
  const openEdit = (id: string) => {
    const r = rows.find((x) => x.id === id);
    if (!r) return;
    setModal({ kind: "edit", id });
    setMStaff(r.staff_name);
    setMDay(r.day);
    setMStart(r.start_time || "06:00");
    setMEnd(r.end_time || "10:30");
    setMText(r.training_text || "");
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
      await supabase.from("roster_training").insert({
        staff_name: name,
        position: pos,
        day: "Mon",
        start_time: null,
        end_time: null,
        training_text: "",
      });
      closeModal();
      return;
    }
    const pos =
      rows.find((r) => r.staff_name === mStaff)?.position ??
      (rows.length ? Math.max(...rows.map((r) => r.position)) + 1 : 0);
    const payload = {
      staff_name: mStaff,
      day: mDay,
      position: pos,
      start_time: mStart,
      end_time: mEnd,
      training_text: mText.trim(),
    };
    if (modal.kind === "edit") {
      await supabase.from("roster_training").update(payload).eq("id", modal.id);
    } else {
      await supabase.from("roster_training").insert(payload);
    }
    closeModal();
  };
  const deleteEntry = async () => {
    if (modal?.kind !== "edit") return;
    await supabase.from("roster_training").delete().eq("id", modal.id);
    closeModal();
  };
  const deleteStaff = async (name: string) => {
    await supabase.from("roster_training").delete().eq("staff_name", name);
  };
  const copyEntry = (r: Row) => {
    if (!r.start_time || !r.end_time) return;
    setClipboard({ start_time: r.start_time, end_time: r.end_time, training_text: r.training_text || "" });
  };
  const pasteInto = async (staff: string, day: string) => {
    if (!clipboard) return;
    const pos =
      rows.find((r) => r.staff_name === staff)?.position ??
      (rows.length ? Math.max(...rows.map((r) => r.position)) + 1 : 0);
    await supabase.from("roster_training").insert({
      staff_name: staff,
      day,
      position: pos,
      start_time: clipboard.start_time,
      end_time: clipboard.end_time,
      training_text: clipboard.training_text,
    });
    setClipboard(null);
  };

  const setWeekDate = async (d: string) => {
    setMeta((m) => ({ ...m, date: d || null }));
    await supabase.from("roster_training_meta").upsert({ id: 1, week_start_date: d || null, week_start_day: weekStartDay, updated_at: new Date().toISOString() });
  };
  const setWeekStartDay = async (v: string) => {
    const day = v === "" ? null : Number(v);
    setMeta((m) => ({ ...m, day }));
    await supabase.from("roster_training_meta").upsert({ id: 1, week_start_date: weekDate, week_start_day: day, updated_at: new Date().toISOString() });
  };

  const saveSnapshot = async () => {
    if (!weekDate && !confirm("No date set for this roster yet. Save anyway?")) return;
    const { data: u } = await supabase.auth.getUser();
    await supabase.from("roster_training_snapshots").insert({
      saved_by: u.user?.id ?? null,
      label: weekDate ? `Week of ${prettyDate(weekDate)}` : null,
      data: rows,
    });
  };
  const loadSnapshot = async (snap: Snapshot) => {
    if (!confirm("Replace the current training roster with this saved version?")) return;
    await supabase.from("roster_training").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    const toInsert = snap.data.map(({ id: _id, ...rest }) => rest);
    if (toInsert.length) await supabase.from("roster_training").insert(toInsert);
  };
  const deleteSnapshot = async (id: string) => {
    await supabase.from("roster_training_snapshots").delete().eq("id", id);
  };

  const downloadStaff = () => {
    const blob = new Blob([buildHTML(weekDate, weekStartDay, staffList, rows)], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Glasshouse_Training_Roster.html";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };
  const shareStaff = async () => {
    const html = buildHTML(weekDate, weekStartDay, staffList, rows);
    try {
      const file = new File([html], "Glasshouse_Training_Roster.html", { type: "text/html" });
      const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
      if (nav.canShare && nav.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "Glasshouse Training Roster", text: "Glasshouse Training Roster" } as ShareData);
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
            <span>Training Roster</span>
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
              <button className="gh-tool primary" onClick={openAddStaff}>+ Add staff member</button>
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
          <p className="gh-note">Loading training roster…</p>
        ) : (
          <>
            {!staffView && clipboard && (
              <div className="gh-clipbar">
                <span className="gh-clipbar-label">📋 Copied:</span>
                <span className="gh-clipbar-time">
                  {fmt(clipboard.start_time)}–{fmt(clipboard.end_time)}
                </span>
                {clipboard.training_text && (
                  <span className="gh-clipbar-text">{clipboard.training_text}</span>
                )}
                <span className="gh-clipbar-hint">— click any empty cell to paste</span>
                <button className="gh-btn" onClick={() => setClipboard(null)}>Clear</button>
              </div>
            )}
            <div className="gh-scroll">
              <div className="gh-grid">
                <div className="gh-header" />
                {orderedDays.map((d) => (
                  <div key={d} className="gh-header">{d}</div>
                ))}

                {staffList.map((person) => (
                  <TrainingRow
                    key={person}
                    person={person}
                    staffView={staffView}
                    rows={rows}
                    days={orderedDays}
                    onAdd={openAdd}
                    onEdit={openEdit}
                    onDeleteStaff={deleteStaff}
                    onCopy={copyEntry}
                    onPaste={pasteInto}
                    hasClipboard={!!clipboard}
                  />
                ))}
              </div>
            </div>

            <p className="gh-note">
              {staffView
                ? "Staff view — training sessions only. This is the version shared with staff."
                : "Click + to add a training session · click an entry to edit · ⧉ on an entry copies it (paste into any empty cell) · × on a name removes that person."}
            </p>


            {!staffView && (
              <div className="gh-snap-panel">
                <h3>Saved training rosters</h3>
                {snapshots.length === 0 ? (
                  <p className="gh-note" style={{ marginTop: 0 }}>No saved versions yet. Click "Save roster" to snapshot the current week.</p>
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
                  <h3>Add staff member</h3>
                  <div className="gh-modal-row">
                    <label>Name</label>
                    <input
                      type="text"
                      autoFocus
                      value={mNewName}
                      onChange={(e) => setMNewName(e.target.value)}
                      placeholder="e.g. Jamie Smith"
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
                  <h3>{modal.kind === "edit" ? "Edit training" : "Add training"}</h3>
                  <div className="gh-modal-row">
                    <label>Staff member</label>
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
                    <label>Start</label>
                    <input type="time" value={mStart} onChange={(e) => setMStart(e.target.value)} />
                  </div>
                  <div className="gh-modal-row">
                    <label>End</label>
                    <input type="time" value={mEnd} onChange={(e) => setMEnd(e.target.value)} />
                  </div>
                  <div className="gh-modal-row">
                    <label>Training (e.g. "Coffee", "Front of house customer service")</label>
                    <textarea
                      value={mText}
                      onChange={(e) => setMText(e.target.value)}
                      placeholder="What is the training on, and who is it for?"
                    />
                  </div>
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

function TrainingRow({
  person,
  staffView,
  rows,
  days,
  onAdd,
  onEdit,
  onDeleteStaff,
  onCopy,
  onPaste,
  hasClipboard,
}: {
  person: string;
  staffView: boolean;
  rows: Row[];
  days: string[];
  onAdd: (staff: string, day: string) => void;
  onEdit: (id: string) => void;
  onDeleteStaff: (name: string) => void;
  onCopy: (r: Row) => void;
  onPaste: (staff: string, day: string) => void;
  hasClipboard: boolean;
}) {
  return (
    <>
      <div className="gh-cell gh-namecell">
        <span className="gh-name">
          <span className="nm">{person}</span>
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
            {cellEntries.map((r) => {
              const time = r.start_time && r.end_time ? `${fmt(r.start_time)}–${fmt(r.end_time)}` : "";
              return (
                <div key={r.id} className="gh-train-wrap">
                  <button
                    className="gh-train"
                    onClick={staffView ? undefined : () => onEdit(r.id)}
                    disabled={staffView}
                    type="button"
                  >
                    {time && <span className="t">{time}</span>}
                    {r.training_text && <span className="desc">{r.training_text}</span>}
                    {!time && !r.training_text && <span className="desc">(empty)</span>}
                  </button>
                  {!staffView && r.start_time && r.end_time && (
                    <button
                      className="gh-copybtn"
                      title="Copy this training (time + comment)"
                      onClick={(e) => { e.stopPropagation(); onCopy(r); }}
                      type="button"
                    >
                      ⧉
                    </button>
                  )}
                </div>
              );
            })}
            {!staffView && (
              hasClipboard ? (
                <button
                  className="gh-empty gh-paste"
                  title="Paste copied training here"
                  onClick={() => onPaste(person, day)}
                >
                  📋 Paste
                </button>
              ) : (
                <button className="gh-empty" onClick={() => onAdd(person, day)}>+</button>
              )
            )}
          </div>
        );
      })}
    </>
  );
}

