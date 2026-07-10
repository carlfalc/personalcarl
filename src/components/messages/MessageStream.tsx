import { useEffect, useRef } from "react";
import { MessageBubble } from "./MessageBubble";
import type { MessageRow } from "@/lib/messages.functions";

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date(today);
  yest.setDate(today.getDate() - 1);
  const same = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (same(d, today)) return "Today";
  if (same(d, yest)) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

export function MessageStream({
  messages,
  currentUserId,
  otherLastReadAt,
  onDelete,
}: {
  messages: MessageRow[];
  currentUserId: string;
  otherLastReadAt: string | null;
  onDelete: (id: string) => void;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const lastMineIdx = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].sender_user_id === currentUserId && !messages[i].deleted_at) return i;
    }
    return -1;
  })();

  let lastDay = "";
  return (
    <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-4">
      {messages.length === 0 && (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Send the first message to start the conversation.
        </div>
      )}
      {messages.map((m, i) => {
        const label = dayLabel(m.created_at);
        const showDay = label !== lastDay;
        lastDay = label;
        const isMine = m.sender_user_id === currentUserId;
        const showSeen =
          isMine &&
          i === lastMineIdx &&
          !!otherLastReadAt &&
          new Date(otherLastReadAt).getTime() >= new Date(m.created_at).getTime();
        return (
          <div key={m.id} className="flex flex-col gap-1">
            {showDay && (
              <div className="my-2 flex items-center gap-2">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
                <div className="h-px flex-1 bg-border" />
              </div>
            )}
            <MessageBubble message={m} isMine={isMine} showSeen={showSeen} onDelete={onDelete} />
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}
