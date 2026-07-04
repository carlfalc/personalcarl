import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Mic, MicOff, Sparkles, Send, Mail, ExternalLink, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import {
  transcribeAudio,
  polishToEmail,
  createGmailDraft,
  listRecentDrafts,
  lookupRecipient,
} from "@/lib/email.functions";
import { getImagesForAttach } from "@/lib/images.functions";

export const Route = createFileRoute("/email")({
  head: () => ({ meta: [{ title: "Email — Voice Drafts" }] }),
  component: EmailPage,
});

function EmailPage() {
  const qc = useQueryClient();
  const transcribe = useServerFn(transcribeAudio);
  const polish = useServerFn(polishToEmail);
  const createDraft = useServerFn(createGmailDraft);
  const listDrafts = useServerFn(listRecentDrafts);
  const lookup = useServerFn(lookupRecipient);
  const getAtts = useServerFn(getImagesForAttach);

  const draftsQ = useQuery({ queryKey: ["recent-drafts"], queryFn: () => listDrafts(), refetchInterval: 15000, refetchOnWindowFocus: true });

  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Array<{ name: string; email: string }>>([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const [attachments, setAttachments] = useState<Array<{ id: string; signed_url: string; caption: string | null; mime_type: string }>>([]);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const lookupTimer = useRef<number | null>(null);

  // Apply prefill (from dashboard "Create email" button) on mount
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("email-prefill");
      if (!raw) return;
      sessionStorage.removeItem("email-prefill");
      const p = JSON.parse(raw) as { to?: string; subject?: string; body?: string };
      if (p.to) setTo(p.to);
      if (p.subject) setSubject(p.subject);
      if (p.body) setBody(p.body);
      toast.success("Loaded email details from meeting");
    } catch {}
  }, []);

  // Load attachments queued from Images page
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("email-attachments");
      if (!raw) return;
      sessionStorage.removeItem("email-attachments");
      const ids = JSON.parse(raw) as string[];
      if (!Array.isArray(ids) || ids.length === 0) return;
      getAtts({ data: { ids } }).then((res) => {
        setAttachments(res);
        toast.success(`${res.length} image${res.length > 1 ? "s" : ""} attached`);
      }).catch(() => toast.error("Couldn't load attachments"));
    } catch {}
  }, [getAtts]);

  // Debounced recipient lookup
  useEffect(() => {
    if (lookupTimer.current) window.clearTimeout(lookupTimer.current);
    const q = to.trim();
    if (q.length < 2 || q.includes("@")) {
      setSuggestions([]);
      return;
    }
    lookupTimer.current = window.setTimeout(async () => {
      try {
        const res = await lookup({ data: { query: q } });
        setSuggestions(res.matches);
        setShowSuggest(true);
      } catch {
        setSuggestions([]);
      }
    }, 400);
    return () => {
      if (lookupTimer.current) window.clearTimeout(lookupTimer.current);
    };
  }, [to, lookup]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      mr.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        await handleTranscribe(blob);
      };
      mediaRef.current = mr;
      mr.start();
      setRecording(true);
    } catch {
      toast.error("Microphone access denied");
    }
  };

  const stopRecording = () => {
    mediaRef.current?.stop();
    setRecording(false);
  };

  const handleTranscribe = async (blob: Blob) => {
    setBusy("Transcribing…");
    try {
      const base64 = await blobToBase64(blob);
      const res = await transcribe({ data: { audioBase64: base64, mimeType: "audio/webm" } });
      setTranscript(res.transcript);
      toast.success("Transcribed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  };

  const handlePolish = async () => {
    if (!transcript.trim()) return;
    setBusy("Polishing…");
    try {
      const res = await polish({ data: { transcript } });
      setTo(res.to);
      setSubject(res.subject);
      setBody(res.body);
      toast.success("Polished");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  };

  const handleSaveDraft = useMutation({
    mutationFn: () => createDraft({ data: { to, subject, body, attachmentIds: attachments.map((a) => a.id) } }),
    onSuccess: () => {
      toast.success("Draft saved to Gmail");
      qc.invalidateQueries({ queryKey: ["recent-drafts"] });
      setTranscript(""); setTo(""); setSubject(""); setBody(""); setAttachments([]);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toRef = useRef<HTMLInputElement | null>(null);
  const loadDraft = (d: { recipient: string | null; subject: string | null; body_preview: string | null }) => {
    setTo(d.recipient ?? "");
    setSubject(d.subject ?? "");
    setBody(d.body_preview ?? "");
    setTranscript("");
    if (!d.recipient) {
      toast.info("Draft loaded — add a recipient before saving to Gmail Drafts");
      window.setTimeout(() => toRef.current?.focus(), 50);
    } else {
      toast.info("Loaded into compose — edit and re-save");
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-rose-200 to-rose-400 flex items-center justify-center">
          <Mail className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Voice → Gmail Drafts</h1>
          <p className="text-sm text-muted-foreground">Speak, polish with AI, save to your Gmail Drafts folder.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Compose column */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6 space-y-4">
            <div className="flex flex-col items-center gap-3 py-4">
              <Button
                size="lg"
                variant={recording ? "destructive" : "default"}
                className="h-20 w-20 rounded-full"
                onClick={recording ? stopRecording : startRecording}
                disabled={!!busy}
              >
                {recording ? <MicOff className="h-8 w-8" /> : <Mic className="h-8 w-8" />}
              </Button>
              <div className="text-sm text-muted-foreground">
                {recording ? "Recording… tap to stop" : busy ?? "Tap mic to record your message"}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Transcript</Label>
              <Textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="Your voice will appear here. You can also type."
                rows={4}
              />
              <Button variant="secondary" onClick={handlePolish} disabled={!transcript.trim() || !!busy}>
                <Sparkles className="h-4 w-4 mr-2" /> Polish into email
              </Button>
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <div className="space-y-2 relative">
              <Label htmlFor="to">To</Label>
              <Input
                id="to"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                onFocus={() => setShowSuggest(true)}
                onBlur={() => window.setTimeout(() => setShowSuggest(false), 150)}
                placeholder="Type a name or email — searches your past Gmail recipients"
              />
              {showSuggest && suggestions.length > 0 && (
                <div className="absolute z-10 left-0 right-0 mt-1 bg-popover border rounded-md shadow-md max-h-60 overflow-auto">
                  {suggestions.map((s) => (
                    <button
                      key={s.email}
                      type="button"
                      className="w-full text-left px-3 py-2 hover:bg-accent text-sm"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setTo(s.email);
                        setShowSuggest(false);
                      }}
                    >
                      <div className="font-medium">{s.name || s.email}</div>
                      {s.name && <div className="text-xs text-muted-foreground">{s.email}</div>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="body">Body</Label>
              <Textarea id="body" value={body} onChange={(e) => setBody(e.target.value)} rows={8} />
            </div>
            {attachments.length > 0 && (
              <div className="space-y-2">
                <Label className="flex items-center gap-1"><Paperclip className="h-3.5 w-3.5" /> Attachments ({attachments.length})</Label>
                <div className="flex flex-wrap gap-2">
                  {attachments.map((a) => (
                    <div key={a.id} className="relative group">
                      <img src={a.signed_url} alt={a.caption ?? ""} className="h-16 w-16 rounded-md object-cover border" />
                      <button
                        type="button"
                        onClick={() => setAttachments((prev) => prev.filter((x) => x.id !== a.id))}
                        className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-500"
                        aria-label="Remove"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <Button
              className="w-full"
              onClick={() => handleSaveDraft.mutate()}
              disabled={!subject.trim() || !body.trim() || handleSaveDraft.isPending}
            >
              <Send className="h-4 w-4 mr-2" />
              {handleSaveDraft.isPending ? "Saving…" : "Save to Gmail Drafts"}
            </Button>
          </Card>
        </div>

        {/* Drafts log column */}
        <div className="lg:col-span-1">
          <Card className="p-5 space-y-3 sticky top-6 bg-rose-50/40 dark:bg-rose-950/10 border-rose-200/60">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Completed drafts</h2>
              <a
                href="https://mail.google.com/mail/u/0/#drafts"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary inline-flex items-center gap-1"
                title="Open Gmail Drafts"
              >
                Gmail <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <p className="text-xs text-muted-foreground">
              Click any draft to load it back into compose for editing.
            </p>
            {!draftsQ.data || draftsQ.data.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center">
                No drafts yet — save one to see it here.
              </div>
            ) : (
              <div className="space-y-1 max-h-[60vh] overflow-auto pr-1">
                {draftsQ.data.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => loadDraft(d)}
                    className="w-full text-left rounded-md px-3 py-2 hover:bg-rose-100/60 dark:hover:bg-rose-900/20 transition border border-transparent hover:border-rose-200"
                  >
                    <div className="font-medium text-sm line-clamp-1">{d.subject || "(no subject)"}</div>
                    <div className="text-xs text-muted-foreground line-clamp-1">
                      {d.recipient || "(no recipient)"}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(d.created_at).toLocaleString()}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => {
      const result = r.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}
