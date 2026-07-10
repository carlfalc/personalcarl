import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ATTACHMENT_BUCKET = "message-attachments";

export type Attachment = {
  path: string;
  name: string;
  mime: string;
  size: number;
  signedUrl?: string;
};

export type MessageRow = {
  id: string;
  thread_id: string;
  sender_user_id: string;
  body: string;
  attachments: Attachment[];
  deleted_at: string | null;
  created_at: string;
};

export type ThreadSummary = {
  id: string;
  slug: string;
  title: string;
  owner_user_id: string;
  staff_user_id: string;
  archived: boolean;
  updated_at: string;
  last_message: { body: string; created_at: string; sender_user_id: string } | null;
  unread_count: number;
  other_last_read_at: string | null;
};

/** List all threads the current user is a participant in. */
export const listThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ThreadSummary[]> => {
    const { supabase, userId } = context;
    const { data: threads, error } = await supabase
      .from("message_threads")
      .select("id, slug, title, owner_user_id, staff_user_id, archived, updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw error;
    if (!threads || threads.length === 0) return [];

    const threadIds = threads.map((t) => t.id);
    const [{ data: reads }, { data: recent }] = await Promise.all([
      supabase.from("message_reads").select("thread_id, user_id, last_read_at").in("thread_id", threadIds),
      supabase
        .from("messages")
        .select("id, thread_id, body, created_at, sender_user_id, deleted_at")
        .in("thread_id", threadIds)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    const myReadByThread = new Map<string, string>();
    const otherReadByThread = new Map<string, string>();
    (reads ?? []).forEach((r) => {
      if (r.user_id === userId) myReadByThread.set(r.thread_id, r.last_read_at);
      else otherReadByThread.set(r.thread_id, r.last_read_at);
    });

    const lastByThread = new Map<string, { body: string; created_at: string; sender_user_id: string }>();
    for (const m of recent ?? []) {
      if (!lastByThread.has(m.thread_id)) {
        lastByThread.set(m.thread_id, {
          body: m.deleted_at ? "(message deleted)" : m.body,
          created_at: m.created_at,
          sender_user_id: m.sender_user_id,
        });
      }
    }

    // Unread counts
    const unread = await Promise.all(
      threads.map(async (t) => {
        const since = myReadByThread.get(t.id) ?? "1970-01-01T00:00:00Z";
        const { count } = await supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("thread_id", t.id)
          .gt("created_at", since)
          .neq("sender_user_id", userId);
        return [t.id, count ?? 0] as const;
      }),
    );
    const unreadMap = new Map(unread);

    return threads.map((t) => ({
      ...t,
      last_message: lastByThread.get(t.id) ?? null,
      unread_count: unreadMap.get(t.id) ?? 0,
      other_last_read_at: otherReadByThread.get(t.id) ?? null,
    }));
  });

/** Total unread across all threads (for sidebar badge). */
export const getUnreadTotal = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<number> => {
    const { supabase, userId } = context;
    const { data: threads } = await supabase.from("message_threads").select("id");
    if (!threads?.length) return 0;
    const { data: reads } = await supabase
      .from("message_reads")
      .select("thread_id, last_read_at")
      .eq("user_id", userId);
    const readMap = new Map((reads ?? []).map((r) => [r.thread_id, r.last_read_at]));
    let total = 0;
    for (const t of threads) {
      const since = readMap.get(t.id) ?? "1970-01-01T00:00:00Z";
      const { count } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("thread_id", t.id)
        .gt("created_at", since)
        .neq("sender_user_id", userId);
      total += count ?? 0;
    }
    return total;
  });

/** Load a page of messages for a thread (newest last). */
export const listMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { threadId: string; before?: string; limit?: number }) =>
    z.object({
      threadId: z.string().uuid(),
      before: z.string().datetime().optional(),
      limit: z.number().int().min(1).max(200).optional(),
    }).parse(data),
  )
  .handler(async ({ data, context }): Promise<MessageRow[]> => {
    const { supabase } = context;
    let q = supabase
      .from("messages")
      .select("*")
      .eq("thread_id", data.threadId)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 60);
    if (data.before) q = q.lt("created_at", data.before);
    const { data: rows, error } = await q;
    if (error) throw error;
    const messages = (rows ?? []).reverse() as MessageRow[];

    // Sign attachment URLs (10 min)
    for (const m of messages) {
      if (Array.isArray(m.attachments) && m.attachments.length) {
        m.attachments = await Promise.all(
          m.attachments.map(async (a) => {
            if (!a?.path) return a;
            const { data: signed } = await supabase.storage
              .from(ATTACHMENT_BUCKET)
              .createSignedUrl(a.path, 60 * 10);
            return { ...a, signedUrl: signed?.signedUrl };
          }),
        );
      }
    }
    return messages;
  });

/** Create or ensure a thread by slug (owner side only). */
export const upsertThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { slug: string; title: string; staffUserId: string }) =>
    z.object({
      slug: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),
      title: z.string().min(1).max(120),
      staffUserId: z.string().uuid(),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("message_threads")
      .select("*")
      .eq("slug", data.slug)
      .maybeSingle();
    if (existing) {
      const { data: updated, error } = await supabase
        .from("message_threads")
        .update({ title: data.title, staff_user_id: data.staffUserId })
        .eq("id", existing.id)
        .select()
        .single();
      if (error) throw error;
      return updated;
    }
    const { data: created, error } = await supabase
      .from("message_threads")
      .insert({
        slug: data.slug,
        title: data.title,
        owner_user_id: userId,
        staff_user_id: data.staffUserId,
      })
      .select()
      .single();
    if (error) throw error;
    return created;
  });

/** Send a message. Attachments must already be uploaded to storage. */
export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { threadId: string; body: string; attachments?: Attachment[] }) =>
    z.object({
      threadId: z.string().uuid(),
      body: z.string().max(10_000).default(""),
      attachments: z.array(z.object({
        path: z.string(),
        name: z.string(),
        mime: z.string(),
        size: z.number().int().nonnegative(),
      })).max(10).optional(),
    }).parse(data),
  )
  .handler(async ({ data, context }): Promise<MessageRow> => {
    const { supabase, userId } = context;
    const body = data.body.trim();
    const attachments = data.attachments ?? [];
    if (!body && attachments.length === 0) throw new Error("Empty message");
    const { data: row, error } = await supabase
      .from("messages")
      .insert({
        thread_id: data.threadId,
        sender_user_id: userId,
        body,
        attachments,
      })
      .select()
      .single();
    if (error) throw error;
    await supabase
      .from("message_threads")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", data.threadId);
    // Auto-mark sender's own last-read to now
    await supabase.from("message_reads").upsert({
      thread_id: data.threadId,
      user_id: userId,
      last_read_at: new Date().toISOString(),
    });
    return row as MessageRow;
  });

/** Mark thread as read up to now for current user. */
export const markRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { threadId: string }) =>
    z.object({ threadId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("message_reads").upsert({
      thread_id: data.threadId,
      user_id: userId,
      last_read_at: new Date().toISOString(),
    });
    if (error) throw error;
    return { ok: true };
  });

/** Soft-delete a message (sender only, enforced by RLS). */
export const deleteMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { messageId: string }) =>
    z.object({ messageId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("messages")
      .update({ deleted_at: new Date().toISOString(), body: "", attachments: [] })
      .eq("id", data.messageId);
    if (error) throw error;
    return { ok: true };
  });

/** Get a short-lived signed upload URL for an attachment. */
export const createAttachmentUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { threadId: string; filename: string }) =>
    z.object({
      threadId: z.string().uuid(),
      filename: z.string().min(1).max(200),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const safeName = data.filename.replace(/[^\w.\-]+/g, "_");
    const path = `${data.threadId}/${crypto.randomUUID()}-${safeName}`;
    const { data: signed, error } = await supabase.storage
      .from(ATTACHMENT_BUCKET)
      .createSignedUploadUrl(path);
    if (error) throw error;
    return { path, token: signed.token, signedUrl: signed.signedUrl };
  });

/** Archive / unarchive a thread. */
export const setThreadArchived = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { threadId: string; archived: boolean }) =>
    z.object({ threadId: z.string().uuid(), archived: z.boolean() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("message_threads")
      .update({ archived: data.archived })
      .eq("id", data.threadId);
    if (error) throw error;
    return { ok: true };
  });

/** Delete a thread and all its messages (owner only, enforced by RLS). */
export const deleteThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { threadId: string }) =>
    z.object({ threadId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("message_threads").delete().eq("id", data.threadId);
    if (error) throw error;
    return { ok: true };
  });
