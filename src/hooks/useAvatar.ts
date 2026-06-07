import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Cached = { path: string; url: string; expires: number };
let cached: Cached | null = null;
const listeners = new Set<() => void>();

export function notifyAvatarChanged() {
  cached = null;
  for (const l of listeners) l();
}

export function useAvatar() {
  const [url, setUrl] = useState<string | null>(cached?.url ?? null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      // Use cache while still fresh (5 min buffer)
      if (cached && cached.expires > Date.now() + 5 * 60 * 1000) {
        setUrl(cached.url);
        return;
      }
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) {
        if (!cancelled) setUrl(null);
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("id", uid)
        .maybeSingle();
      const path = (profile as any)?.avatar_url as string | null;
      if (!path) {
        cached = null;
        if (!cancelled) setUrl(null);
        return;
      }
      const expSecs = 60 * 60 * 24 * 7; // 7 days
      const { data: signed } = await supabase.storage
        .from("avatars")
        .createSignedUrl(path, expSecs);
      if (signed?.signedUrl) {
        cached = { path, url: signed.signedUrl, expires: Date.now() + expSecs * 1000 };
        if (!cancelled) setUrl(signed.signedUrl);
      }
    };

    const tick = () => load();
    listeners.add(tick);
    load();

    return () => {
      cancelled = true;
      listeners.delete(tick);
    };
  }, []);

  return url;
}
