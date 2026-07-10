import { useRef, useState } from "react";
import { Paperclip, Send, X, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { sendMessage, createAttachmentUploadUrl, type Attachment } from "@/lib/messages.functions";

const ATTACHMENT_BUCKET = "message-attachments";
const MAX_FILE_MB = 20;

type PendingFile = { file: File; path?: string; uploading: boolean };

export function Composer({ threadId, onSent }: { threadId: string; onSent?: () => void }) {
  const [text, setText] = useState("");
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const send = useServerFn(sendMessage);
  const getUploadUrl = useServerFn(createAttachmentUploadUrl);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const additions: PendingFile[] = [];
    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        toast.error(`${file.name} exceeds ${MAX_FILE_MB} MB`);
        continue;
      }
      additions.push({ file, uploading: true });
    }
    if (!additions.length) return;
    setPending((p) => [...p, ...additions]);

    for (const item of additions) {
      try {
        const { path, token } = await getUploadUrl({
          data: { threadId, filename: item.file.name },
        });
        const { error } = await supabase.storage
          .from(ATTACHMENT_BUCKET)
          .uploadToSignedUrl(path, token, item.file, { contentType: item.file.type });
        if (error) throw error;
        setPending((p) =>
          p.map((x) => (x.file === item.file ? { ...x, path, uploading: false } : x)),
        );
      } catch (e: any) {
        toast.error(`Upload failed: ${e.message ?? e}`);
        setPending((p) => p.filter((x) => x.file !== item.file));
      }
    }
  };

  const removePending = (file: File) => setPending((p) => p.filter((x) => x.file !== file));

  const submit = async () => {
    const body = text.trim();
    const ready = pending.filter((p) => !!p.path && !p.uploading);
    if (!body && ready.length === 0) return;
    if (pending.some((p) => p.uploading)) {
      toast.info("Waiting for uploads to finish…");
      return;
    }
    setSending(true);
    try {
      const attachments: Attachment[] = ready.map((p) => ({
        path: p.path!,
        name: p.file.name,
        mime: p.file.type || "application/octet-stream",
        size: p.file.size,
      }));
      await send({ data: { threadId, body, attachments } });
      setText("");
      setPending([]);
      onSent?.();
    } catch (e: any) {
      toast.error(`Send failed: ${e.message ?? e}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="border-t bg-background p-3">
      {pending.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {pending.map((p) => (
            <div
              key={p.file.name + p.file.size}
              className="flex items-center gap-2 rounded-md border bg-secondary/50 px-2 py-1 text-xs"
            >
              {p.uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Paperclip className="h-3 w-3" />}
              <span className="max-w-[160px] truncate">{p.file.name}</span>
              <button onClick={() => removePending(p.file)} className="opacity-60 hover:opacity-100">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
          title="Attach"
        >
          <Paperclip className="h-5 w-5" />
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Write a message… (⌘/Ctrl+Enter to send)"
          rows={2}
          className="flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
        />
        <button
          type="button"
          onClick={submit}
          disabled={sending || (!text.trim() && pending.length === 0)}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Send
        </button>
      </div>
    </div>
  );
}
