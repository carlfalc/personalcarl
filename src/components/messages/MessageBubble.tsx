import { useState } from "react";
import { Trash2, Paperclip, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MessageRow } from "@/lib/messages.functions";

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function MessageBubble({
  message,
  isMine,
  showSeen,
  onDelete,
}: {
  message: MessageRow;
  isMine: boolean;
  showSeen: boolean;
  onDelete: (id: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const deleted = !!message.deleted_at;

  return (
    <div
      className={cn("group flex w-full", isMine ? "justify-end" : "justify-start")}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className={cn("flex max-w-[75%] items-end gap-2", isMine && "flex-row-reverse")}>
        <div
          className={cn(
            "rounded-2xl px-3 py-2 text-sm leading-snug shadow-sm",
            isMine
              ? "bg-primary text-primary-foreground rounded-br-sm"
              : "bg-secondary text-foreground rounded-bl-sm",
            deleted && "italic opacity-70",
          )}
        >
          {deleted ? (
            <span>message deleted</span>
          ) : (
            <>
              {message.body && <div className="whitespace-pre-wrap break-words">{message.body}</div>}
              {message.attachments?.length > 0 && (
                <div className={cn("mt-2 flex flex-col gap-1.5", message.body && "border-t pt-2 border-black/10")}>
                  {message.attachments.map((a) => {
                    const isImg = a.mime?.startsWith("image/");
                    if (isImg && a.signedUrl) {
                      return (
                        <a key={a.path} href={a.signedUrl} target="_blank" rel="noreferrer">
                          <img src={a.signedUrl} alt={a.name} className="max-h-64 rounded-md" />
                        </a>
                      );
                    }
                    return (
                      <a
                        key={a.path}
                        href={a.signedUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={cn(
                          "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs",
                          isMine ? "bg-primary-foreground/10" : "bg-background/60",
                        )}
                      >
                        <Paperclip className="h-3.5 w-3.5" />
                        <span className="flex-1 truncate">{a.name}</span>
                        <Download className="h-3.5 w-3.5 opacity-70" />
                      </a>
                    );
                  })}
                </div>
              )}
            </>
          )}
          <div
            className={cn(
              "mt-1 flex items-center gap-1 text-[10px]",
              isMine ? "text-primary-foreground/70 justify-end" : "text-muted-foreground",
            )}
          >
            <span>{formatTime(message.created_at)}</span>
            {isMine && !deleted && (
              <span className="ml-1">{showSeen ? "✓✓ Seen" : "✓ Sent"}</span>
            )}
          </div>
        </div>

        {isMine && !deleted && hovered && (
          <button
            type="button"
            onClick={() => onDelete(message.id)}
            className="rounded-full p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            title="Delete message"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
