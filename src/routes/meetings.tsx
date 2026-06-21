import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Plus, MapPin, Clock, Paperclip, Upload, FileIcon, X, Mail, Pencil, Check } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { createCalendarEvent, getEventRsvps } from "@/lib/meetings.functions";

export const Route = createFileRoute("/meetings")({
  head: () => ({ meta: [{ title: "Meetings — Personal OS" }] }),
  component: MeetingsPage,
});

type Meeting = {
  id: string;
  title: string;
  datetime: string;
  location: string | null;
  notes: string | null;
  google_event_id: string | null;
};

type MeetingDoc = {
  id: string;
  meeting_id: string;
  file_path: string;
  filename: string;
  size_bytes: number | null;
  mime_type: string | null;
};

type Participant = { email: string; sendInvite: boolean };

const isGmail = (email: string) =>
  /@(gmail\.com|googlemail\.com)$/i.test(email.trim());

const isValidEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

function MeetingsPage() {
  useRealtimeTable("meetings", ["meetings"]);
  useRealtimeTable("meeting_documents", ["meeting-documents"]);
  const qc = useQueryClient();
  const createEvent = useServerFn(createCalendarEvent);
  const [form, setForm] = useState({ title: "", datetime: "", location: "", notes: "" });
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [emailDraft, setEmailDraft] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const newFileRef = useRef<HTMLInputElement>(null);

  const { data: meetings = [] } = useQuery({
    queryKey: ["meetings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings").select("*").order("datetime", { ascending: true });
      if (error) throw error;
      return data as Meeting[];
    },
  });

  const { data: docs = [] } = useQuery({
    queryKey: ["meeting-documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_documents").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as MeetingDoc[];
    },
  });

  const addParticipant = () => {
    const e = emailDraft.trim();
    if (!isValidEmail(e)) { toast.error("Enter a valid email"); return; }
    if (participants.some((p) => p.email.toLowerCase() === e.toLowerCase())) {
      setEmailDraft(""); return;
    }
    setParticipants([...participants, { email: e, sendInvite: isGmail(e) }]);
    setEmailDraft("");
  };

  const create = useMutation({
    mutationFn: async () => {
      const startIso = new Date(form.datetime).toISOString();
      const endIso = new Date(new Date(form.datetime).getTime() + 60 * 60 * 1000).toISOString();
      const inviteEmails = participants.filter((p) => p.sendInvite).map((p) => p.email);

      // 1. Create Google Calendar event first (if invites requested) so we can store event id.
      let googleEventId: string | null = null;
      if (inviteEmails.length > 0) {
        try {
          const res = await createEvent({
            data: {
              title: form.title.trim(),
              startIso,
              endIso,
              location: form.location || null,
              description: [
                form.notes || "",
                participants.length ? `Participants: ${participants.map((p) => p.email).join(", ")}` : "",
              ].filter(Boolean).join("\n\n"),
              attendees: inviteEmails,
            },
          });
          googleEventId = res.eventId ?? null;
          toast.success(`Calendar invite sent to ${inviteEmails.length} attendee(s)`);
        } catch (e) {
          toast.error(`Calendar invite failed: ${e instanceof Error ? e.message : "unknown"}`);
        }
      }

      // 2. Build notes including participants list.
      const participantsLine = participants.length
        ? `Participants: ${participants.map((p) => p.email).join(", ")}`
        : "";
      const finalNotes = [form.notes, participantsLine].filter(Boolean).join("\n\n") || null;

      // 3. Insert meeting.
      const { data: inserted, error } = await supabase
        .from("meetings")
        .insert({
          title: form.title.trim(),
          datetime: startIso,
          location: form.location || null,
          notes: finalNotes,
          google_event_id: googleEventId,
        })
        .select("id")
        .single();
      if (error) throw error;

      // 4. Upload any pending attachments.
      if (pendingFiles.length > 0 && inserted?.id) {
        for (const file of pendingFiles) {
          const safeName = file.name.replace(/[^\w.\-]+/g, "_");
          const path = `${inserted.id}/${Date.now()}-${safeName}`;
          const { error: upErr } = await supabase.storage
            .from("meeting-documents")
            .upload(path, file, { contentType: file.type || undefined });
          if (upErr) { toast.error(`Upload failed: ${upErr.message}`); continue; }
          await supabase.from("meeting_documents").insert({
            meeting_id: inserted.id,
            file_path: path,
            filename: file.name,
            size_bytes: file.size,
            mime_type: file.type || null,
          });
        }
        qc.invalidateQueries({ queryKey: ["meeting-documents"] });
      }
    },
    onSuccess: () => {
      setForm({ title: "", datetime: "", location: "", notes: "" });
      setParticipants([]);
      setPendingFiles([]);
      setEmailDraft("");
      qc.invalidateQueries({ queryKey: ["meetings"] });
      toast.success("Meeting added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("meetings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meetings"] }),
  });

  const now = Date.now();
  const upcoming = meetings.filter((m) => new Date(m.datetime).getTime() >= now);
  const past = meetings.filter((m) => new Date(m.datetime).getTime() < now);
  const docsByMeeting = (mid: string) => docs.filter((d) => d.meeting_id === mid);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader title="Meetings" subtitle="Where you need to be." />

      <Card className="mb-8 space-y-3 p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Title">
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="1:1 with…"
            />
          </Field>
          <Field label="When">
            <Input
              type="datetime-local"
              value={form.datetime}
              onChange={(e) => setForm({ ...form, datetime: e.target.value })}
            />
          </Field>
          <Field label="Location">
            <Input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="Zoom, office…"
            />
          </Field>
          <Field label="Notes" className="sm:col-span-2">
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              placeholder="Agenda, context…"
            />
          </Field>

          <Field label="Participants (emails)" className="sm:col-span-2">
            <div className="flex gap-2">
              <Input
                type="email"
                value={emailDraft}
                onChange={(e) => setEmailDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addParticipant(); } }}
                placeholder="jane@gmail.com"
              />
              <Button type="button" variant="secondary" onClick={addParticipant}>
                <Plus className="mr-1 h-4 w-4" /> Add
              </Button>
            </div>
            {participants.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {participants.map((p, i) => (
                  <li key={p.email} className="flex items-center gap-2 rounded-md bg-muted/40 px-2 py-1.5 text-sm">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="flex-1 truncate">{p.email}</span>
                    {isGmail(p.email) && (
                      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Checkbox
                          checked={p.sendInvite}
                          onCheckedChange={(v) => {
                            const next = [...participants];
                            next[i] = { ...next[i], sendInvite: v === true };
                            setParticipants(next);
                          }}
                        />
                        Send calendar invite
                      </label>
                    )}
                    <Button
                      type="button" variant="ghost" size="icon" className="h-6 w-6"
                      onClick={() => setParticipants(participants.filter((_, j) => j !== i))}
                    >
                      <X className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Field>

          <Field label="Attachments" className="sm:col-span-2">
            <div className="flex items-center gap-2">
              <Button
                type="button" variant="secondary" size="sm"
                onClick={() => newFileRef.current?.click()}
              >
                <Upload className="mr-1 h-4 w-4" /> Add files
              </Button>
              <input
                ref={newFileRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = e.target.files;
                  if (!files) return;
                  setPendingFiles([...pendingFiles, ...Array.from(files)]);
                  if (newFileRef.current) newFileRef.current.value = "";
                }}
              />
              <span className="text-xs text-muted-foreground">
                {pendingFiles.length === 0 ? "No files queued" : `${pendingFiles.length} file(s) queued`}
              </span>
            </div>
            {pendingFiles.length > 0 && (
              <ul className="mt-2 space-y-1">
                {pendingFiles.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-md bg-muted/40 px-2 py-1 text-xs">
                    <FileIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="flex-1 truncate">{f.name}</span>
                    <Button
                      type="button" variant="ghost" size="icon" className="h-6 w-6"
                      onClick={() => setPendingFiles(pendingFiles.filter((_, j) => j !== i))}
                    >
                      <X className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Field>
        </div>
        <div className="flex justify-end">
          <Button
            disabled={!form.title.trim() || !form.datetime || create.isPending}
            onClick={() => create.mutate()}
          >
            <Plus className="mr-1 h-4 w-4" /> {create.isPending ? "Saving…" : "Add meeting"}
          </Button>
        </div>
      </Card>

      <Section
        title="Upcoming"
        items={upcoming}
        docsByMeeting={docsByMeeting}
        onDel={(id) => del.mutate(id)}
      />
      {past.length > 0 && (
        <div className="mt-8">
          <Section
            title="Past"
            items={past}
            docsByMeeting={docsByMeeting}
            onDel={(id) => del.mutate(id)}
            faded
          />
        </div>
      )}
    </div>
  );
}


function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Section({
  title, items, onDel, faded, docsByMeeting,
}: {
  title: string;
  items: Meeting[];
  onDel: (id: string) => void;
  faded?: boolean;
  docsByMeeting: (mid: string) => MeetingDoc[];
}) {
  if (items.length === 0) {
    return (
      <>
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</h2>
        <p className="py-6 text-sm text-muted-foreground">Nothing here.</p>
      </>
    );
  }
  return (
    <>
      <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</h2>
      <div className={`space-y-3 ${faded ? "opacity-70" : ""}`}>
        {items.map((m) => (
          <MeetingCard key={m.id} m={m} docs={docsByMeeting(m.id)} onDel={onDel} />
        ))}
      </div>
    </>
  );
}

function toLocalInputValue(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function MeetingCard({ m, docs, onDel }: { m: Meeting; docs: MeetingDoc[]; onDel: (id: string) => void }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    title: m.title,
    datetime: toLocalInputValue(m.datetime),
    location: m.location ?? "",
    notes: m.notes ?? "",
  });

  const startEdit = () => {
    setDraft({
      title: m.title,
      datetime: toLocalInputValue(m.datetime),
      location: m.location ?? "",
      notes: m.notes ?? "",
    });
    setEditing(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!draft.title.trim() || !draft.datetime) throw new Error("Title and date are required");
      const { error } = await supabase.from("meetings").update({
        title: draft.title.trim(),
        datetime: new Date(draft.datetime).toISOString(),
        location: draft.location || null,
        notes: draft.notes || null,
      }).eq("id", m.id);
      if (error) throw error;
    },
    onSuccess: () => {
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["meetings"] });
      toast.success("Meeting updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="group p-4 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          {editing ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <Input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="Title"
              />
              <Input
                type="datetime-local"
                value={draft.datetime}
                onChange={(e) => setDraft({ ...draft, datetime: e.target.value })}
              />
              <Input
                value={draft.location}
                onChange={(e) => setDraft({ ...draft, location: e.target.value })}
                placeholder="Location"
                className="sm:col-span-2"
              />
              <Textarea
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                rows={3}
                placeholder="Notes"
                className="sm:col-span-2"
              />
            </div>
          ) : (
            <>
              <div className="font-medium">{m.title}</div>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {format(new Date(m.datetime), "EEE d MMM, HH:mm")}
                </span>
                {m.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {m.location}
                  </span>
                )}
              </div>
              {m.notes && (
                <p className="mt-2 whitespace-pre-wrap text-sm text-foreground/80">{m.notes}</p>
              )}
            </>
          )}
        </div>
        <Button
          variant="ghost" size="icon"
          className="opacity-0 transition group-hover:opacity-100"
          onClick={() => onDel(m.id)}
        >
          <Trash2 className="h-4 w-4 text-muted-foreground" />
        </Button>
      </div>

      <DocumentsBlock
        meetingId={m.id}
        docs={docs}
        editing={editing}
        onEditToggle={() => (editing ? setEditing(false) : startEdit())}
        onSave={() => save.mutate()}
        saving={save.isPending}
      />
    </Card>
  );
}

function DocumentsBlock({
  meetingId, docs, editing, onEditToggle, onSave, saving,
}: {
  meetingId: string;
  docs: MeetingDoc[];
  editing?: boolean;
  onEditToggle?: () => void;
  onSave?: () => void;
  saving?: boolean;
}) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      for (const file of Array.from(files)) {
        const safeName = file.name.replace(/[^\w.\-]+/g, "_");
        const path = `${user.id}/${meetingId}/${Date.now()}-${safeName}`;
        const { error: upErr } = await supabase.storage
          .from("meeting-documents")
          .upload(path, file, { contentType: file.type || undefined });
        if (upErr) throw upErr;
        const { error: insErr } = await supabase.from("meeting_documents").insert({
          meeting_id: meetingId,
          file_path: path,
          filename: file.name,
          size_bytes: file.size,
          mime_type: file.type || null,
        });
        if (insErr) throw insErr;
      }
      toast.success(`${files.length} file(s) uploaded`);
      qc.invalidateQueries({ queryKey: ["meeting-documents"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleOpen = async (d: MeetingDoc) => {
    const { data, error } = await supabase.storage
      .from("meeting-documents")
      .createSignedUrl(d.file_path, 60 * 10);
    if (error || !data) { toast.error("Could not open file"); return; }
    window.open(data.signedUrl, "_blank", "noopener");
  };

  const handleDelete = async (d: MeetingDoc) => {
    if (!window.confirm(`Delete "${d.filename}"?`)) return;
    try {
      await supabase.storage.from("meeting-documents").remove([d.file_path]);
      const { error } = await supabase.from("meeting_documents").delete().eq("id", d.id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["meeting-documents"] });
      toast.success("File deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  return (
    <div className="mt-3 border-t border-border/60 pt-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <Paperclip className="h-3.5 w-3.5" />
          Attachments {docs.length > 0 && <span>({docs.length})</span>}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost" size="sm"
            className="h-7 text-xs"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="mr-1 h-3.5 w-3.5" />
            {uploading ? "Uploading…" : "Upload"}
          </Button>
          {onEditToggle && (
            editing ? (
              <>
                <Button
                  variant="default" size="sm" className="h-7 text-xs"
                  disabled={saving}
                  onClick={onSave}
                >
                  <Check className="mr-1 h-3.5 w-3.5" />
                  {saving ? "Saving…" : "Save"}
                </Button>
                <Button
                  variant="ghost" size="sm" className="h-7 text-xs"
                  onClick={onEditToggle}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <Button
                variant="ghost" size="sm" className="h-7 text-xs"
                onClick={onEditToggle}
                title="Edit meeting"
              >
                <Pencil className="mr-1 h-3.5 w-3.5" />
                Edit
              </Button>
            )
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleUpload(e.target.files)}
        />
      </div>
      {docs.length > 0 && (
        <ul className="space-y-1">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center gap-2 rounded-md bg-muted/40 px-2 py-1 text-xs">
              <FileIcon className="h-3.5 w-3.5 text-muted-foreground" />
              <button
                type="button"
                onClick={() => handleOpen(d)}
                className="flex-1 truncate text-left hover:underline"
                title={d.filename}
              >
                {d.filename}
              </button>
              {d.size_bytes != null && (
                <span className="text-muted-foreground">{formatSize(d.size_bytes)}</span>
              )}
              <Button
                variant="ghost" size="icon"
                className="h-6 w-6"
                onClick={() => handleDelete(d)}
                title="Delete"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
