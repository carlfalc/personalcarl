import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Stethoscope, Pencil, Plus, Trash2, Upload, Sparkles, Save,
  Download, ChevronDown, ChevronRight, ArrowUp, ArrowDown, Check, X,
  FileText, Image as ImageIcon, CircleCheck,
} from "lucide-react";
import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/hooks/useAuthSession";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  getMedicalProfile, saveMedicalProfile, markCheckupDone,
  listPrescriptions, savePrescription, deletePrescription,
  listBloodReports, saveBloodReport, deleteBloodReport,
  analyzeBloodResults, type BloodReport,
} from "@/lib/medical.functions";

export const Route = createFileRoute("/medical")({
  head: () => ({
    meta: [
      { title: "Medical — Personal OS" },
      { name: "description", content: "Doctor details, prescriptions, checkup reminders, and AI blood-test overviews." },
    ],
  }),
  component: MedicalPage,
});

const FREQUENCY_OPTIONS = [1, 2, 3, 4, 6, 9, 10, 11, 12];
const DOSAGE_UNITS = ["mg", "mcg", "g", "ml", "tabs", "capsules", "puffs", "drops", "IU"];
const FREQUENCY_LABELS = [
  "Once daily", "Twice daily", "Three times daily", "Four times daily",
  "Every morning", "Every evening", "Weekly", "As needed",
];

const SEVERITY_STYLES: Record<string, { dot: string; label: string; text: string }> = {
  very_bad:  { dot: "bg-red-600",    label: "Very bad", text: "text-red-700" },
  bad:       { dot: "bg-orange-500", label: "Bad",      text: "text-orange-700" },
  neutral:   { dot: "bg-slate-400",  label: "Neutral",  text: "text-slate-700" },
  good:      { dot: "bg-emerald-500",label: "Good",     text: "text-emerald-700" },
  very_good: { dot: "bg-green-600",  label: "Very good",text: "text-green-700" },
};

function MedicalPage() {
  return (
    <div className="px-4 py-5 sm:px-6 sm:py-6 lg:px-8 space-y-6">
      <PageHeader
        title="Medical"
        subtitle="Your doctor & clinic details, prescriptions, checkup reminders, and AI-assisted blood test overviews."
      />
      <MyDetailsCard />
      <PrescriptionsCard />
      <BloodTestsCard />
    </div>
  );
}

/* ============================================================
   My details
   ============================================================ */

function MyDetailsCard() {
  const qc = useQueryClient();
  const fetchProfile = useServerFn(getMedicalProfile);
  const saveProfile = useServerFn(saveMedicalProfile);
  const markDone = useServerFn(markCheckupDone);

  const { data: profile } = useQuery({
    queryKey: ["medical-profile"],
    queryFn: () => fetchProfile(),
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    doctor_name: "", clinic_name: "", clinic_address: "", doctor_phone: "",
    clinic_phone: "", email: "", website: "", checkup_frequency_months: "" as string,
    last_visit_date: "", notes: "",
  });

  useEffect(() => {
    if (!profile) return;
    setForm({
      doctor_name: profile.doctor_name ?? "",
      clinic_name: profile.clinic_name ?? "",
      clinic_address: profile.clinic_address ?? "",
      doctor_phone: profile.doctor_phone ?? "",
      clinic_phone: profile.clinic_phone ?? "",
      email: profile.email ?? "",
      website: profile.website ?? "",
      checkup_frequency_months: profile.checkup_frequency_months ? String(profile.checkup_frequency_months) : "",
      last_visit_date: profile.last_visit_date ?? "",
      notes: profile.notes ?? "",
    });
  }, [profile]);

  const save = useMutation({
    mutationFn: () => saveProfile({
      data: {
        doctor_name: form.doctor_name.trim() || null,
        clinic_name: form.clinic_name.trim() || null,
        clinic_address: form.clinic_address.trim() || null,
        doctor_phone: form.doctor_phone.trim() || null,
        clinic_phone: form.clinic_phone.trim() || null,
        email: form.email.trim() || null,
        website: form.website.trim() || null,
        checkup_frequency_months: form.checkup_frequency_months ? Number(form.checkup_frequency_months) : null,
        last_visit_date: form.last_visit_date || null,
        notes: form.notes.trim() || null,
      },
    }),
    onSuccess: () => {
      toast.success("Details saved");
      qc.invalidateQueries({ queryKey: ["medical-profile"] });
      qc.invalidateQueries({ queryKey: ["medical-profile-banner"] });
      setOpen(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  const done = useMutation({
    mutationFn: () => markDone(),
    onSuccess: () => {
      toast.success("Marked as visited today");
      qc.invalidateQueries({ queryKey: ["medical-profile"] });
      qc.invalidateQueries({ queryKey: ["medical-profile-banner"] });
    },
  });

  const nextDue = useMemo(() => {
    if (!profile?.last_visit_date || !profile.checkup_frequency_months) return null;
    const d = new Date(profile.last_visit_date);
    d.setMonth(d.getMonth() + profile.checkup_frequency_months);
    return d;
  }, [profile]);

  const hasDetails = profile && (profile.doctor_name || profile.clinic_name || profile.checkup_frequency_months);

  return (
    <Card className="rounded-3xl p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
            <Stethoscope className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold">My details</h2>
            <p className="text-sm text-muted-foreground">
              Doctor and clinic contact info, checkup frequency and last visit date so we can remind you.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Pencil className="h-4 w-4 mr-1" /> {hasDetails ? "Edit" : "Add my details"}
        </Button>
      </div>

      {hasDetails ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-sm">
          <Field label="Doctor" value={profile.doctor_name} />
          <Field label="Clinic" value={profile.clinic_name} />
          <Field label="Clinic address" value={profile.clinic_address} />
          <Field label="Doctor phone" value={profile.doctor_phone} />
          <Field label="Clinic phone" value={profile.clinic_phone} />
          <Field label="Email" value={profile.email} />
          <Field label="Website" value={profile.website} link />
          <Field label="Checkup every" value={profile.checkup_frequency_months ? `${profile.checkup_frequency_months} month${profile.checkup_frequency_months === 1 ? "" : "s"}` : null} />
          <Field label="Last visit" value={profile.last_visit_date} />
          {nextDue && (
            <Field
              label="Next due"
              value={nextDue.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
            />
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground italic">No details yet — click "Add my details" to start.</p>
      )}

      {profile?.checkup_frequency_months && (
        <div className="pt-2">
          <Button variant="ghost" size="sm" onClick={() => done.mutate()} disabled={done.isPending}>
            <CircleCheck className="h-4 w-4 mr-1" /> I visited the doctor today
          </Button>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>My medical details</DialogTitle>
            <DialogDescription>Only visible to you.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormRow label="Doctor name">
              <Input value={form.doctor_name} onChange={(e) => setForm({ ...form, doctor_name: e.target.value })} />
            </FormRow>
            <FormRow label="Clinic name">
              <Input value={form.clinic_name} onChange={(e) => setForm({ ...form, clinic_name: e.target.value })} />
            </FormRow>
            <FormRow label="Clinic address" span>
              <Input value={form.clinic_address} onChange={(e) => setForm({ ...form, clinic_address: e.target.value })} />
            </FormRow>
            <FormRow label="Doctor phone">
              <Input value={form.doctor_phone} onChange={(e) => setForm({ ...form, doctor_phone: e.target.value })} />
            </FormRow>
            <FormRow label="Clinic phone">
              <Input value={form.clinic_phone} onChange={(e) => setForm({ ...form, clinic_phone: e.target.value })} />
            </FormRow>
            <FormRow label="Email">
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </FormRow>
            <FormRow label="Website">
              <Input placeholder="https://" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
            </FormRow>
            <FormRow label="Checkup frequency">
              <Select value={form.checkup_frequency_months} onValueChange={(v) => setForm({ ...form, checkup_frequency_months: v })}>
                <SelectTrigger><SelectValue placeholder="Pick frequency" /></SelectTrigger>
                <SelectContent>
                  {FREQUENCY_OPTIONS.map((n) => (
                    <SelectItem key={n} value={String(n)}>Every {n} month{n === 1 ? "" : "s"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormRow>
            <FormRow label="Last visit date">
              <Input type="date" value={form.last_visit_date} onChange={(e) => setForm({ ...form, last_visit_date: e.target.value })} />
            </FormRow>
            <FormRow label="Notes" span>
              <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </FormRow>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function Field({ label, value, link }: { label: string; value?: string | number | null; link?: boolean }) {
  if (!value) return null;
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      {link ? (
        <a href={String(value).startsWith("http") ? String(value) : `https://${value}`} target="_blank" rel="noreferrer" className="text-sm font-medium text-primary hover:underline break-all">{value}</a>
      ) : (
        <div className="text-sm font-medium break-words">{value}</div>
      )}
    </div>
  );
}

function FormRow({ label, span, children }: { label: string; span?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn("space-y-1", span && "sm:col-span-2")}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

/* ============================================================
   Prescriptions
   ============================================================ */

function PrescriptionsCard() {
  const qc = useQueryClient();
  const fetchList = useServerFn(listPrescriptions);
  const saveOne = useServerFn(savePrescription);
  const deleteOne = useServerFn(deletePrescription);

  const { data: list = [] } = useQuery({
    queryKey: ["medical-prescriptions"],
    queryFn: () => fetchList(),
  });

  const [editing, setEditing] = useState<null | {
    id?: string; name: string; dosage_amount: string; dosage_unit: string; frequency: string; notes: string;
  }>(null);

  const save = useMutation({
    mutationFn: () => saveOne({
      data: {
        id: editing?.id,
        name: editing?.name.trim() ?? "",
        dosage_amount: editing?.dosage_amount ? Number(editing.dosage_amount) : null,
        dosage_unit: editing?.dosage_unit || null,
        frequency: editing?.frequency || null,
        notes: editing?.notes?.trim() || null,
      },
    }),
    onSuccess: () => {
      toast.success("Prescription saved");
      qc.invalidateQueries({ queryKey: ["medical-prescriptions"] });
      setEditing(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteOne({ data: { id } }),
    onSuccess: () => {
      toast.success("Removed");
      qc.invalidateQueries({ queryKey: ["medical-prescriptions"] });
    },
  });

  return (
    <Card className="rounded-3xl p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Current prescriptions</h2>
          <p className="text-sm text-muted-foreground">Track the medicines you take regularly — name, dosage and frequency.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setEditing({ name: "", dosage_amount: "", dosage_unit: "mg", frequency: "Once daily", notes: "" })}>
          <Plus className="h-4 w-4 mr-1" /> Add prescription
        </Button>
      </div>

      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">No prescriptions yet.</p>
      ) : (
        <ul className="divide-y divide-border">
          {list.map((p) => (
            <li key={p.id} className="flex items-start justify-between gap-3 py-3">
              <div className="min-w-0">
                <div className="font-medium">{p.name}</div>
                <div className="text-sm text-muted-foreground">
                  {p.dosage_amount ? `${p.dosage_amount} ${p.dosage_unit ?? ""}` : null}
                  {p.dosage_amount && p.frequency ? " • " : null}
                  {p.frequency}
                </div>
                {p.notes && <div className="mt-1 text-xs text-muted-foreground">{p.notes}</div>}
              </div>
              <div className="flex items-center gap-1">
                <Button size="icon" variant="ghost" onClick={() => setEditing({
                  id: p.id, name: p.name,
                  dosage_amount: p.dosage_amount != null ? String(p.dosage_amount) : "",
                  dosage_unit: p.dosage_unit ?? "mg",
                  frequency: p.frequency ?? "",
                  notes: p.notes ?? "",
                })}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => remove.mutate(p.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit prescription" : "Add prescription"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="grid gap-4 sm:grid-cols-2">
              <FormRow label="Name" span>
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="e.g. Atorvastatin" />
              </FormRow>
              <FormRow label="Dosage amount">
                <Input type="number" step="0.01" value={editing.dosage_amount} onChange={(e) => setEditing({ ...editing, dosage_amount: e.target.value })} />
              </FormRow>
              <FormRow label="Unit">
                <Select value={editing.dosage_unit} onValueChange={(v) => setEditing({ ...editing, dosage_unit: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DOSAGE_UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormRow>
              <FormRow label="Frequency" span>
                <Select value={editing.frequency} onValueChange={(v) => setEditing({ ...editing, frequency: v })}>
                  <SelectTrigger><SelectValue placeholder="Pick frequency" /></SelectTrigger>
                  <SelectContent>
                    {FREQUENCY_LABELS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormRow>
              <FormRow label="Notes" span>
                <Textarea rows={2} value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
              </FormRow>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={!editing?.name.trim() || save.isPending}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ============================================================
   Blood tests
   ============================================================ */

function BloodTestsCard() {
  const qc = useQueryClient();
  const session = useAuthSession();
  const userId = session?.userId ?? null;

  const analyze = useServerFn(analyzeBloodResults);
  const fetchReports = useServerFn(listBloodReports);
  const saveReport = useServerFn(saveBloodReport);
  const removeReport = useServerFn(deleteBloodReport);

  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [report, setReport] = useState<BloodReport | null>(null);
  const [reportPaths, setReportPaths] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profileMeta, setProfileMeta] = useState<{ name: string | null; dob: string | null }>({ name: null, dob: null });
  useEffect(() => {
    if (!userId) return;
    supabase.from("profiles").select("display_name, date_of_birth").eq("id", userId).maybeSingle()
      .then(({ data }) => setProfileMeta({ name: data?.display_name ?? null, dob: data?.date_of_birth ?? null }));
  }, [userId]);

  const { data: history = [] } = useQuery({
    queryKey: ["medical-blood-reports"],
    queryFn: () => fetchReports(),
  });

  const runAnalysis = async () => {
    if (!userId) return toast.error("Please sign in");
    if (files.length === 0) return toast.error("Add at least one file");
    setUploading(true);
    const paths: string[] = [];
    try {
      for (const f of files) {
        const ext = f.name.split(".").pop() ?? "bin";
        const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await supabase.storage.from("medical-uploads").upload(path, f, {
          upsert: false, contentType: f.type || undefined,
        });
        if (error) throw error;
        paths.push(path);
      }
      const result = await analyze({ data: { paths, userName: profileMeta.name, dob: profileMeta.dob } });
      setReport(result);
      setReportPaths(paths);
      setFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast.success("Analysis ready");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setUploading(false);
    }
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!report) return;
      return saveReport({
        data: {
          title: `Blood test — ${report.patient.date}`,
          source_paths: reportPaths,
          ai_report: report as any,
        },
      });
    },
    onSuccess: () => {
      toast.success("Report saved to your log");
      qc.invalidateQueries({ queryKey: ["medical-blood-reports"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  return (
    <Card className="rounded-3xl p-6 space-y-4">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
          <Sparkles className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-semibold">Blood test overview</h2>
          <p className="text-sm text-muted-foreground max-w-3xl">
            On your medical page you can upload below any blood results by screenshot or documents and I'll give you a
            full overview of the information and results including anything further you may want to suggest to discuss
            with your doctor or physician.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-dashed border-border p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,application/pdf"
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            className="text-sm"
          />
          <Button onClick={runAnalysis} disabled={uploading || files.length === 0}>
            {uploading ? "Analysing…" : <><Upload className="h-4 w-4 mr-1" /> Send</>}
          </Button>
        </div>
        {files.length > 0 && (
          <ul className="text-xs text-muted-foreground space-y-1">
            {files.map((f, i) => (
              <li key={i} className="flex items-center gap-2">
                {f.type.startsWith("image/") ? <ImageIcon className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                {f.name} <span>({Math.round(f.size / 1024)} KB)</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {report && (
        <ReportView
          report={report}
          onSave={() => save.mutate()}
          onDownload={() => downloadReportPdf(report)}
          onDismiss={() => setReport(null)}
          saving={save.isPending}
        />
      )}

      {history.length > 0 && (
        <div className="pt-4">
          <h3 className="text-sm font-semibold mb-3">Timeline</h3>
          <ol className="relative border-l-2 border-border pl-6 space-y-4">
            {history.map((h) => {
              const r = h.ai_report as unknown as BloodReport;
              const abnormal = r?.results?.filter((x) => x.status === "abnormal").length ?? 0;
              return (
                <TimelineItem
                  key={h.id}
                  title={h.title ?? "Blood test"}
                  when={new Date(h.reported_at)}
                  abnormalCount={abnormal}
                  totalCount={r?.results?.length ?? 0}
                  report={r}
                  onDelete={async () => {
                    await removeReport({ data: { id: h.id } });
                    qc.invalidateQueries({ queryKey: ["medical-blood-reports"] });
                  }}
                />
              );
            })}
          </ol>
        </div>
      )}
    </Card>
  );
}

function TimelineItem({ title, when, abnormalCount, totalCount, report, onDelete }: {
  title: string; when: Date; abnormalCount: number; totalCount: number; report: BloodReport; onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const hasIssues = abnormalCount > 0;
  const topNote = report?.overview?.[0]?.text;
  return (
    <li className="relative">
      <span
        className={cn(
          "absolute -left-[31px] top-3 h-4 w-4 rounded-full border-2 border-background ring-2",
          hasIssues ? "bg-amber-500 ring-amber-300" : "bg-emerald-500 ring-emerald-300"
        )}
      />
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-start justify-between gap-2 p-3">
          <button onClick={() => setOpen((o) => !o)} className="flex items-start gap-2 text-left flex-1 min-w-0">
            {open ? <ChevronDown className="h-4 w-4 mt-1" /> : <ChevronRight className="h-4 w-4 mt-1" />}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium truncate">{title}</span>
                {totalCount > 0 && (
                  <Badge variant={hasIssues ? "destructive" : "secondary"} className={cn(!hasIssues && "text-emerald-700")}>
                    {abnormalCount}/{totalCount} abnormal
                  </Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {when.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                {" • "}
                {when.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
              </div>
              {topNote && !open && (
                <div className="mt-1 text-xs text-muted-foreground line-clamp-2">{topNote}</div>
              )}
            </div>
          </button>
          <div className="flex items-center gap-1 shrink-0">
            <Button size="icon" variant="ghost" onClick={() => downloadReportPdf(report)} title="Download PDF">
              <Download className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={onDelete} title="Delete">
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
        {open && (
          <div className="border-t border-border p-3">
            <ReportBody report={report} />
          </div>
        )}
      </div>
    </li>
  );
}

function ReportView({ report, onSave, onDownload, onDismiss, saving }: {
  report: BloodReport; onSave: () => void; onDownload: () => void; onDismiss: () => void; saving: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">AI overview</h3>
          <p className="text-xs text-muted-foreground">Review below, then save to your log.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onDownload}><Download className="h-4 w-4 mr-1" /> PDF</Button>
          <Button size="sm" onClick={onSave} disabled={saving}>
            <Save className="h-4 w-4 mr-1" /> {saving ? "Saving…" : "Save"}
          </Button>
          <Button size="icon" variant="ghost" onClick={onDismiss}><X className="h-4 w-4" /></Button>
        </div>
      </div>
      <ReportBody report={report} />
    </div>
  );
}

function ReportBody({ report }: { report: BloodReport }) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-muted/40 p-3 text-sm">
        <div className="font-semibold">{report.patient.name || "Patient"}</div>
        <div className="text-xs text-muted-foreground">
          {report.patient.dob && `DOB ${report.patient.dob} • `}
          {report.patient.date} at {report.patient.time}
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold mb-2">Quick overview</h4>
        <ul className="space-y-1.5">
          {report.overview.map((o, i) => {
            const s = SEVERITY_STYLES[o.severity] ?? SEVERITY_STYLES.neutral;
            return (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", s.dot)} />
                <span>
                  <Badge variant="outline" className={cn("mr-2 text-[10px] uppercase", s.text)}>{s.label}</Badge>
                  {o.text}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {report.results.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-2">Results</h4>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2">Marker</th>
                  <th className="text-left px-3 py-2">Value</th>
                  <th className="text-left px-3 py-2">Range</th>
                  <th className="text-left px-3 py-2">Status</th>
                  <th className="text-left px-3 py-2">Note</th>
                </tr>
              </thead>
              <tbody>
                {report.results.map((r, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-3 py-2 font-medium">{r.marker}</td>
                    <td className="px-3 py-2 tabular-nums">
                      <span className="inline-flex items-center gap-1">
                        {r.value} {r.unit}
                        {r.direction === "up" && <ArrowUp className="h-3.5 w-3.5 text-green-600" />}
                        {r.direction === "down" && <ArrowDown className="h-3.5 w-3.5 text-red-600" />}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{r.range}</td>
                    <td className="px-3 py-2">
                      {r.status === "abnormal" ? (
                        <Badge variant="destructive">Abnormal</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-green-700"><Check className="h-3 w-3 mr-1" /> Normal</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {report.questions.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-2">Suggested questions for your physician</h4>
          <ul className="list-disc pl-5 text-sm space-y-1">
            {report.questions.map((q, i) => <li key={i}>{q}</li>)}
          </ul>
        </div>
      )}

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        <strong>Disclaimer:</strong> {report.disclaimer}
      </div>
    </div>
  );
}

/* ============================================================
   PDF export
   ============================================================ */

function downloadReportPdf(report: BloodReport) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  let y = margin;

  const line = (text: string, size = 11, bold = false, indent = 0) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    const wrapped = doc.splitTextToSize(text, pageW - margin * 2 - indent);
    for (const w of wrapped) {
      if (y > pageH - margin) { doc.addPage(); y = margin; }
      doc.text(w, margin + indent, y);
      y += size + 4;
    }
  };
  const gap = (h = 8) => { y += h; };

  line("Blood Test Overview", 18, true);
  gap(4);
  line(report.patient.name || "Patient", 12, true);
  if (report.patient.dob) line(`DOB: ${report.patient.dob}`, 10);
  line(`Date: ${report.patient.date} ${report.patient.time}`, 10);
  gap();

  line("Quick overview", 13, true);
  for (const o of report.overview) {
    const label = SEVERITY_STYLES[o.severity]?.label ?? "Neutral";
    line(`• [${label}] ${o.text}`, 11, false, 8);
  }
  gap();

  if (report.results.length > 0) {
    line("Results", 13, true);
    for (const r of report.results) {
      const arrow = r.direction === "up" ? "↑" : r.direction === "down" ? "↓" : "";
      const status = r.status === "abnormal" ? "ABNORMAL" : "Normal";
      line(`• ${r.marker}: ${r.value} ${r.unit} ${arrow}  (range ${r.range}) — ${status}`, 11, false, 8);
      if (r.note) line(r.note, 10, false, 20);
    }
    gap();
  }

  if (report.questions.length > 0) {
    line("Suggested questions for your physician", 13, true);
    for (const q of report.questions) line(`• ${q}`, 11, false, 8);
    gap();
  }

  line("Disclaimer", 12, true);
  line(report.disclaimer, 10);

  doc.save(`blood-report-${report.patient.date}.pdf`);
}
