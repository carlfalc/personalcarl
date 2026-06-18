import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/roster")({
  head: () => ({
    meta: [
      { title: "Glasshouse Roster" },
      { name: "description", content: "Weekly staff roster for Glasshouse." },
    ],
  }),
  component: RosterPage,
});

type Entry = {
  staff: string;
  day: string;
  off?: boolean;
  start?: string;
  end?: string;
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const STAFF = ["Jayda", "Lauren", "Abigail", "Sarah", "Izabella", "Danielle"];

const INITIAL: Entry[] = [
  { staff: "Jayda", day: "Mon", off: true },
  { staff: "Jayda", day: "Tue", start: "06:00", end: "10:30" },
  { staff: "Jayda", day: "Wed", start: "06:00", end: "10:30" },
  { staff: "Jayda", day: "Thu", start: "06:00", end: "10:30" },
  { staff: "Jayda", day: "Fri", start: "06:00", end: "14:00" },
  { staff: "Jayda", day: "Sat", start: "07:00", end: "15:00" },
  { staff: "Jayda", day: "Sun", off: true },
  { staff: "Lauren", day: "Tue", start: "15:00", end: "21:30" },
  { staff: "Lauren", day: "Wed", start: "15:00", end: "21:30" },
  { staff: "Lauren", day: "Fri", start: "16:00", end: "21:00" },
  { staff: "Lauren", day: "Sat", start: "13:00", end: "20:00" },
  { staff: "Abigail", day: "Thu", start: "16:00", end: "21:00" },
  { staff: "Abigail", day: "Fri", start: "10:30", end: "15:00" },
  { staff: "Abigail", day: "Sat", start: "10:30", end: "15:00" },
  { staff: "Sarah", day: "Mon", start: "13:00", end: "21:00" },
  { staff: "Sarah", day: "Tue", start: "13:00", end: "21:00" },
  { staff: "Sarah", day: "Wed", start: "13:00", end: "21:00" },
  { staff: "Sarah", day: "Thu", off: true },
  { staff: "Sarah", day: "Fri", start: "13:00", end: "21:00" },
  { staff: "Sarah", day: "Sat", start: "13:00", end: "21:00" },
  { staff: "Sarah", day: "Sun", off: true },
  { staff: "Izabella", day: "Mon", start: "07:00", end: "10:30" },
  { staff: "Izabella", day: "Tue", start: "15:00", end: "21:30" },
  { staff: "Izabella", day: "Thu", start: "15:00", end: "21:30" },
  { staff: "Izabella", day: "Sat", start: "10:00", end: "18:00" },
  { staff: "Izabella", day: "Sun", start: "07:00", end: "15:00" },
  { staff: "Danielle", day: "Tue", start: "17:00", end: "22:00" },
  { staff: "Danielle", day: "Wed", start: "17:00", end: "21:00" },
  { staff: "Danielle", day: "Thu", start: "16:00", end: "21:30" },
  { staff: "Danielle", day: "Fri", start: "16:00", end: "21:00" },
  { staff: "Danielle", day: "Sat", start: "16:00", end: "22:00" },
];

const toMins = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const fmtHrs = (m: number) => {
  const h = m / 60;
  return h % 1 === 0 ? `${h}h` : `${h.toFixed(1)}h`;
};
const entryHrs = (e: Entry) => (e.off ? 0 : toMins(e.end!) - toMins(e.start!));
const fmt = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "pm" : "am";
  const hh = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return m === 0 ? `${hh}${ampm}` : `${hh}:${m.toString().padStart(2, "0")}${ampm}`;
};

const STYLE = `
.gh-wrap{max-width:1080px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#1d1d1b}
.gh-topbar{display:flex;align-items:flex-end;justify-content:space-between;gap:1rem;flex-wrap:wrap;margin-bottom:1rem;border-bottom:2px solid #0d3a2c;padding-bottom:.75rem}
.gh-brand{display:flex;align-items:baseline;gap:12px}
.gh-brand h1{font-size:30px;font-weight:700;color:#0d3a2c;letter-spacing:.2px;margin:0}
.gh-brand span{font-size:16px;color:#5b5b55}
.gh-toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.gh-seg{display:inline-flex;border:1px solid #cdcbc1;border-radius:8px;overflow:hidden}
.gh-seg button{font-size:12px;padding:7px 12px;border:0;background:transparent;color:#5b5b55;cursor:pointer}
.gh-seg button.active{background:#0d3a2c;color:#fff}
.gh-tool{font-size:12px;padding:7px 13px;border-radius:8px;border:1px solid #cdcbc1;background:transparent;color:#1d1d1b;cursor:pointer}
.gh-tool:hover{background:#f4f3ec}
.gh-tool.primary{background:#0d3a2c;color:#fff;border-color:#0d3a2c}
.gh-grid{display:grid;grid-template-columns:96px repeat(7,1fr) 76px;gap:3px;font-size:12px}
.gh-grid.staff{grid-template-columns:96px repeat(7,1fr)}
.gh-header{font-size:11px;font-weight:600;color:#5b5b55;text-align:center;padding:6px 2px;text-transform:uppercase;letter-spacing:.3px}
.gh-header.total-h{color:#0d3a2c}
.gh-cell{padding:6px 4px;min-height:40px;display:flex;flex-direction:column;gap:3px}
.gh-namecell{background:#F7F4EC;border-radius:4px;justify-content:center}
.gh-name{font-weight:600;color:#0d3a2c;font-size:12.5px;display:flex;align-items:center;gap:6px}
.gh-hours-badge{font-size:10px;font-weight:600;color:#8d8d85;margin-left:auto}
.gh-shift{background:#E1F5EE;color:#085041;border-radius:3px;padding:4px 6px;font-size:10px;font-weight:600;line-height:1.3;cursor:pointer;text-align:center;border:0}
.gh-shift:hover{opacity:.85}
.gh-off{background:#f4f3ec;color:#8d8d85;font-size:10px;font-weight:600;border-radius:3px;padding:4px 6px;text-align:center;cursor:pointer;border:0}
.gh-off:hover{opacity:.85}
.gh-empty{border:1px dashed #e3e1d8;border-radius:3px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#8d8d85;font-size:16px;min-height:30px;background:transparent}
.gh-empty:hover{background:#f4f3ec}
.gh-totalcell{background:#F7F4EC;border-radius:4px;align-items:center;justify-content:center}
.gh-totalcell .v{font-weight:700;color:#0d3a2c;font-size:13px}
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
@media print{.gh-toolbar{display:none}.gh-empty{display:none}.gh-modal-backdrop{display:none!important}}
.gh-modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:100;display:flex;align-items:center;justify-content:center}
.gh-modal-card{background:#fff;border:1px solid #e3e1d8;border-radius:12px;padding:1.25rem;width:300px}
.gh-modal-card h3{font-size:15px;font-weight:600;margin:0 0 4px}
`;

type ModalState =
  | { kind: "add"; staff: string; day: string }
  | { kind: "edit"; index: number }
  | null;

function buildStaffHTML(entries: Entry[]) {
  let rows = "";
  rows += '<div class="gh-header"></div>' + DAYS.map((d) => `<div class="gh-header">${d}</div>`).join("");
  STAFF.forEach((person) => {
    rows += `<div class="gh-cell gh-namecell"><span class="gh-name">${person}</span></div>`;
    DAYS.forEach((day) => {
      const ce = entries.filter((e) => e.staff === person && e.day === day);
      let c = '<div class="gh-cell">';
      ce.forEach((e) => {
        c += e.off
          ? '<div class="gh-off">off</div>'
          : `<div class="gh-shift">${fmt(e.start!)}\u2013${fmt(e.end!)}</div>`;
      });
      c += "</div>";
      rows += c;
    });
  });
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Glasshouse Roster</title><style>${STYLE}</style></head><body><div class="gh-wrap"><div class="gh-topbar"><div class="gh-brand"><h1>Glasshouse</h1><span>Roster</span></div></div><div class="gh-grid staff">${rows}</div></div></body></html>`;
}

function RosterPage() {
  const [entries, setEntries] = useState<Entry[]>(INITIAL);
  const [mode, setMode] = useState<"manager" | "staff">("manager");
  const [modal, setModal] = useState<ModalState>(null);
  const [mStaff, setMStaff] = useState("");
  const [mType, setMType] = useState<"work" | "off">("work");
  const [mStart, setMStart] = useState("06:00");
  const [mEnd, setMEnd] = useState("10:30");

  const staffView = mode === "staff";

  const personMins = (p: string) =>
    entries.filter((e) => e.staff === p).reduce((a, e) => a + entryHrs(e), 0);

  const grand = useMemo(() => STAFF.reduce((a, p) => a + personMins(p), 0), [entries]);

  const openAdd = (staff: string, day: string) => {
    setModal({ kind: "add", staff, day });
    setMStaff(staff);
    setMType("work");
    setMStart("06:00");
    setMEnd("10:30");
  };
  const openEdit = (index: number) => {
    const e = entries[index];
    setModal({ kind: "edit", index });
    setMStaff(e.staff);
    setMType(e.off ? "off" : "work");
    setMStart(e.off ? "06:00" : e.start!);
    setMEnd(e.off ? "10:30" : e.end!);
  };
  const closeModal = () => setModal(null);
  const saveEntry = () => {
    if (!modal) return;
    const day = modal.kind === "edit" ? entries[modal.index].day : modal.day;
    const e: Entry =
      mType === "off"
        ? { staff: mStaff, day, off: true }
        : { staff: mStaff, day, start: mStart, end: mEnd };
    if (modal.kind === "edit") {
      const next = entries.slice();
      next[modal.index] = e;
      setEntries(next);
    } else {
      setEntries([...entries, e]);
    }
    closeModal();
  };
  const deleteEntry = () => {
    if (modal?.kind !== "edit") return;
    setEntries(entries.filter((_, i) => i !== modal.index));
    closeModal();
  };

  const downloadStaff = () => {
    const blob = new Blob([buildStaffHTML(entries)], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Glasshouse_Roster_Staff.html";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };
  const shareStaff = async () => {
    const html = buildStaffHTML(entries);
    try {
      const file = new File([html], "Glasshouse_Roster_Staff.html", { type: "text/html" });
      const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
      if (nav.canShare && nav.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "Glasshouse Roster", text: "Glasshouse staff roster" } as ShareData);
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
            <span>Roster</span>
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
            <button className="gh-tool" onClick={() => window.print()}>Print</button>
            <button className="gh-tool" onClick={shareStaff}>Share staff copy</button>
            <button className="gh-tool primary" onClick={downloadStaff}>Download staff copy</button>
          </div>
        </div>

        <div className={`gh-grid${staffView ? " staff" : ""}`}>
          <div className="gh-header" />
          {DAYS.map((d) => (
            <div key={d} className="gh-header">{d}</div>
          ))}
          {!staffView && <div className="gh-header total-h">Total</div>}

          {STAFF.map((person) => {
            const mins = personMins(person);
            return (
              <RosterRow
                key={person}
                person={person}
                mins={mins}
                staffView={staffView}
                entries={entries}
                onAdd={openAdd}
                onEdit={openEdit}
              />
            );
          })}
        </div>

        {!staffView && (
          <div className="gh-grandrow">
            <span className="lbl">Total</span>
            <span className="v">{fmtHrs(grand)}</span>
          </div>
        )}

        <p className="gh-note">
          {staffView
            ? "Staff view — shift times only. This is the version shared with staff (no total hours shown)."
            : "Click + to add a shift or mark a day off · Click a shift to edit or remove. Totals update automatically."}
        </p>
      </div>

      {modal && (
        <div className="gh-modal-backdrop" onClick={closeModal}>
          <div className="gh-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="gh-modal-box">
              <h3>{modal.kind === "edit" ? "Edit shift" : "Add shift"}</h3>
              <div className="gh-modal-row">
                <label>Staff member</label>
                <select value={mStaff} onChange={(e) => setMStaff(e.target.value)}>
                  {STAFF.map((s) => (
                    <option key={s} value={s}>{s}</option>
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
  entries,
  onAdd,
  onEdit,
}: {
  person: string;
  mins: number;
  staffView: boolean;
  entries: Entry[];
  onAdd: (staff: string, day: string) => void;
  onEdit: (index: number) => void;
}) {
  return (
    <>
      <div className="gh-cell gh-namecell">
        <span className="gh-name">
          {person}
          {!staffView && <span className="gh-hours-badge">{mins ? fmtHrs(mins) : ""}</span>}
        </span>
      </div>
      {DAYS.map((day) => {
        const cellEntries = entries
          .map((e, i) => ({ e, i }))
          .filter((o) => o.e.staff === person && o.e.day === day);
        return (
          <div key={day} className="gh-cell">
            {cellEntries.map((o) =>
              o.e.off ? (
                <button
                  key={o.i}
                  className="gh-off"
                  onClick={staffView ? undefined : () => onEdit(o.i)}
                  disabled={staffView}
                >
                  off
                </button>
              ) : (
                <button
                  key={o.i}
                  className="gh-shift"
                  onClick={staffView ? undefined : () => onEdit(o.i)}
                  disabled={staffView}
                >
                  {fmt(o.e.start!)}–{fmt(o.e.end!)}
                </button>
              ),
            )}
            {!staffView && (
              <button className="gh-empty" onClick={() => onAdd(person, day)}>+</button>
            )}
          </div>
        );
      })}
      {!staffView && (
        <div className="gh-cell gh-totalcell">
          <span className="v">{mins ? fmtHrs(mins) : "–"}</span>
        </div>
      )}
    </>
  );
}
