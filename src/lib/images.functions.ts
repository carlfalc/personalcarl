import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ImageRow = {
  id: string;
  storage_path: string;
  caption: string | null;
  width: number | null;
  height: number | null;
  mime_type: string | null;
  size_bytes: number | null;
  source: string;
  created_at: string;
  signed_url: string;
};

export const listImages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ImageRow[]> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("images")
      .select("id, storage_path, caption, width, height, mime_type, size_bytes, source, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Omit<ImageRow, "signed_url">[];
    if (rows.length === 0) return [];
    const paths = rows.map((r) => r.storage_path);
    const { data: signed, error: sErr } = await supabase.storage
      .from("telegram-images")
      .createSignedUrls(paths, 60 * 60);
    if (sErr) throw new Error(sErr.message);
    const byPath = new Map<string, string>();
    (signed ?? []).forEach((s, i) => byPath.set(paths[i], s.signedUrl ?? ""));
    return rows.map((r) => ({ ...r, signed_url: byPath.get(r.storage_path) ?? "" }));
  });

export const deleteImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error: gErr } = await supabase
      .from("images")
      .select("storage_path")
      .eq("id", data.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (gErr) throw new Error(gErr.message);
    if (!row) throw new Error("Image not found");
    await supabase.storage.from("telegram-images").remove([row.storage_path as string]);
    const { error: dErr } = await supabase.from("images").delete().eq("id", data.id);
    if (dErr) throw new Error(dErr.message);
    return { ok: true };
  });

export const getImagesForAttach = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { ids: string[] }) =>
    z.object({ ids: z.array(z.string().uuid()).min(1).max(10) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("images")
      .select("id, storage_path, mime_type, caption")
      .in("id", data.ids)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as Array<{ id: string; storage_path: string; mime_type: string | null; caption: string | null }>;
    if (list.length === 0) return [];
    const { data: signed } = await supabase.storage
      .from("telegram-images")
      .createSignedUrls(list.map((r) => r.storage_path), 60 * 60);
    const urls = new Map<string, string>();
    (signed ?? []).forEach((s, i) => urls.set(list[i].storage_path, s.signedUrl ?? ""));
    return list.map((r) => ({
      id: r.id,
      mime_type: r.mime_type ?? "image/jpeg",
      caption: r.caption,
      signed_url: urls.get(r.storage_path) ?? "",
    }));
  });

export const recordUploadedImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    storage_path: string;
    mime_type?: string | null;
    size_bytes?: number | null;
    width?: number | null;
    height?: number | null;
    caption?: string | null;
  }) =>
    z.object({
      storage_path: z.string().min(1),
      mime_type: z.string().nullable().optional(),
      size_bytes: z.number().int().nonnegative().nullable().optional(),
      width: z.number().int().positive().nullable().optional(),
      height: z.number().int().positive().nullable().optional(),
      caption: z.string().max(500).nullable().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!data.storage_path.startsWith(`${userId}/`)) {
      throw new Error("Invalid storage path");
    }
    const { data: row, error } = await supabase
      .from("images")
      .insert({
        user_id: userId,
        storage_path: data.storage_path,
        mime_type: data.mime_type ?? null,
        size_bytes: data.size_bytes ?? null,
        width: data.width ?? null,
        height: data.height ?? null,
        caption: data.caption ?? null,
        source: "upload",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });
