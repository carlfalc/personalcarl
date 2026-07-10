import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listThreads,
  listMessages,
  markRead,
  deleteMessage,
  upsertThread,
  setThreadArchived,
  deleteThread,
  type MessageRow,
} from "@/lib/messages.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/hooks/useAuthSession";
import { ThreadList } from "@/components/messages/ThreadList";
import { MessageStream } from "@/components/messages/MessageStream";
import { Composer } from "@/components/messages/Composer";

const MYMANAGER_INBOX_USER_ID = import.meta.env.VITE_MYMANAGER_INBOX_USER_ID as string | undefined;
const DEFAULT_SLUG = "mymanager";
const DEFAULT_TITLE = "mymanager.co.nz";


export const Route = createFileRoute("/messages")({
  component: MessagesPage,
});

function MessagesPage() {
  const qc = useQueryClient();
  const { userId } = useAuthSession();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const listThreadsFn = useServerFn(listThreads);
  const listMessagesFn = useServerFn(listMessages);
  const markReadFn = useServerFn(markRead);
  const deleteMessageFn = useServerFn(deleteMessage);
  const upsertThreadFn = useServerFn(upsertThread);
  const setArchivedFn = useServerFn(setThreadArchived);
  const deleteThreadFn = useServerFn(deleteThread);

  const threadsQuery = useQuery({
    queryKey: ["messages", "threads"],
    queryFn: () => listThreadsFn(),
    enabled: !!userId,
  });

  const messagesQuery = useQuery({
    queryKey: ["messages", "list", activeId],
    queryFn: () => listMessagesFn({ data: { threadId: activeId! } }),
    enabled: !!activeId,
  });

  const activeThread = useMemo(
    () => threadsQuery.data?.find((t) => t.id === activeId) ?? null,
    [threadsQuery.data, activeId],
  );

  // Auto-select first non-archived thread
  useEffect(() => {
    if (!activeId && threadsQuery.data && threadsQuery.data.length) {
      const first = threadsQuery.data.find((t) => !t.archived) ?? threadsQuery.data[0];
      setActiveId(first.id);
    }
  }, [threadsQuery.data, activeId]);

  // Realtime: any change in messages/threads/reads → refetch
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`user:${userId}:messages`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => {
        qc.invalidateQueries({ queryKey: ["messages"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reads" }, () => {
        qc.invalidateQueries({ queryKey: ["messages"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "message_threads" }, () => {
        qc.invalidateQueries({ queryKey: ["messages", "threads"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, qc]);

  // Mark read when opening or receiving in active thread
  useEffect(() => {
    if (!activeId || !messagesQuery.data) return;
    markReadFn({ data: { threadId: activeId } }).then(() => {
      qc.invalidateQueries({ queryKey: ["messages", "threads"] });
      qc.invalidateQueries({ queryKey: ["messages", "unread-total"] });
    });
  }, [activeId, messagesQuery.data, markReadFn, qc]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this message for everyone?")) return;
    await deleteMessageFn({ data: { messageId: id } });
    qc.invalidateQueries({ queryKey: ["messages"] });
  };

  const handleNew = async () => {
    const slug = window.prompt(
      "Employee slug (letters, numbers, dashes — e.g. jamison):",
    )?.trim().toLowerCase();
    if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
      if (slug) toast.error("Invalid slug");
      return;
    }
    const title = window.prompt("Display name for this conversation:", slug)?.trim();
    if (!title) return;
    const staffUserId = window.prompt(
      "Staff account user ID (the mymanager.co.nz inbox user's UUID):",
    )?.trim();
    if (!staffUserId) return;
    try {
      const t = await upsertThreadFn({ data: { slug, title, staffUserId } });
      qc.invalidateQueries({ queryKey: ["messages", "threads"] });
      setActiveId(t.id);
      toast.success(`Thread ready: ${title}`);
    } catch (e: any) {
      toast.error(e.message ?? "Could not create thread");
    }
  };

  const handleArchive = async (id: string, archived: boolean) => {
    await setArchivedFn({ data: { threadId: id, archived } });
    qc.invalidateQueries({ queryKey: ["messages", "threads"] });
    toast.success(archived ? "Archived" : "Unarchived");
  };

  const handleDeleteThread = async (id: string) => {
    await deleteThreadFn({ data: { threadId: id } });
    if (activeId === id) setActiveId(null);
    qc.invalidateQueries({ queryKey: ["messages", "threads"] });
    toast.success("Conversation deleted");
  };

  const visibleThreads = (threadsQuery.data ?? []).filter((t) => showArchived || !t.archived);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <div className="border-b bg-background px-4 py-3">
        <h1 className="text-lg font-semibold">Messages</h1>
        <p className="text-xs text-muted-foreground">Direct threads with your employees</p>
      </div>
      <div className="flex items-center gap-2 border-b px-4 py-1.5 text-xs text-muted-foreground">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          Show archived
        </label>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div className="w-full max-w-[320px] shrink-0 border-r">
          <ThreadList
            threads={visibleThreads}
            activeId={activeId}
            onSelect={setActiveId}
            onNew={handleNew}
            onArchive={handleArchive}
            onDelete={handleDeleteThread}
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          {activeThread ? (
            <>
              <div className="flex items-center justify-between border-b bg-background px-4 py-2">
                <div>
                  <div className="text-sm font-semibold">{activeThread.title}</div>
                  <div className="text-[11px] text-muted-foreground">
                    slug: <code>{activeThread.slug}</code>
                  </div>
                </div>
              </div>
              <MessageStream
                messages={(messagesQuery.data ?? []) as MessageRow[]}
                currentUserId={userId ?? ""}
                otherLastReadAt={activeThread.other_last_read_at}
                onDelete={handleDelete}
              />
              <Composer
                threadId={activeThread.id}
                onSent={() => qc.invalidateQueries({ queryKey: ["messages"] })}
              />
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              Select or start a conversation.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
