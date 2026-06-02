import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Mic, MicOff, Sparkles, Send, Mail } from "lucide-react";
import { toast } from "sonner";
import {
  transcribeAudio,
  polishToEmail,
  createGmailDraft,
  listRecentDrafts,
} from "@/lib/email.functions";

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

  const draftsQ = useQuery({ queryKey: ["recent-drafts"], queryFn: () => listDrafts() });

  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

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
    mutationFn: () => createDraft({ data: { to, subject, body } }),
    onSuccess: () => {
      toast.success("Draft saved to Gmail");
      qc.invalidateQueries({ queryKey: ["recent-drafts"] });
      setTranscript(""); setTo(""); setSubject(""); setBody("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-rose-200 to-rose-400 flex items-center justify-center">
          <Mail className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Voice → Gmail Drafts</h1>
          <p className="text-sm text-muted-foreground">Speak, polish with AI, save to your Gmail Drafts folder.</p>
        </div>
      </div>

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
        <div className="space-y-2">
          <Label htmlFor="to">To</Label>
          <Input id="to" value={to} onChange={(e) => setTo(e.target.value)} placeholder="recipient@example.com" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="subject">Subject</Label>
          <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="body">Body</Label>
          <Textarea id="body" value={body} onChange={(e) => setBody(e.target.value)} rows={8} />
        </div>
        <Button
          className="w-full"
          onClick={() => handleSaveDraft.mutate()}
          disabled={!subject.trim() || !body.trim() || handleSaveDraft.isPending}
        >
          <Send className="h-4 w-4 mr-2" />
          {handleSaveDraft.isPending ? "Saving…" : "Save to Gmail Drafts"}
        </Button>
      </Card>

      {draftsQ.data && draftsQ.data.length > 0 && (
        <Card className="p-5 space-y-3">
          <h2 className="font-semibold">Recent drafts</h2>
          <div className="space-y-2">
            {draftsQ.data.map((d) => (
              <div key={d.id} className="text-sm border-b last:border-0 pb-2">
                <div className="font-medium">{d.subject}</div>
                <div className="text-xs text-muted-foreground">
                  {d.recipient || "(no recipient)"} · {new Date(d.created_at).toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground line-clamp-1">{d.body_preview}</div>
              </div>
            ))}
          </div>
          <a
            href="https://mail.google.com/mail/u/0/#drafts"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-primary inline-flex items-center gap-1"
          >
            Open Gmail Drafts ↗
          </a>
        </Card>
      )}
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
