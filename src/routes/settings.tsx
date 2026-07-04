import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Pencil, Trash2, Plus, Save, Cake } from "lucide-react";
import { toast } from "sonner";
import { Country, City } from "country-state-city";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/hooks/useAuthSession";
import { useAvatar, notifyAvatarChanged } from "@/hooks/useAvatar";
import { useUserName } from "@/hooks/useUserName";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings / About Me — Personal OS" }] }),
  component: SettingsPage,
});

type Birthday = { id: string; name: string; birth_date: string; notes: string | null };

type Category = "interest" | "project" | "preference" | "family" | "business" | "technology" | "travel";
type Memory = {
  id: string;
  fact: string;
  category: Category;
  confidence: number;
  source: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  relationship: string | null;
  birth_date: string | null;
};

const OTHER_MEMORY_CATEGORIES: { key: Category; label: string }[] = [
  { key: "interest", label: "Interests" },
  { key: "project", label: "Projects" },
  { key: "preference", label: "Preferences" },
  { key: "business", label: "Business" },
  { key: "technology", label: "Technology" },
  { key: "travel", label: "Travel" },
];

/**
 * Diary summary runs on the server at 21:30 Pacific/Auckland. Show the
 * equivalent wall-clock time in the user's country so the sentence reads
 * correctly for wherever they are.
 */
function diarySummarySentence(
  countryIso: string,
  countries: Array<{ isoCode: string; name: string; timezones?: Array<{ zoneName: string }> }>,
): string {
  const country = countries.find((c) => c.isoCode === countryIso);
  const tz = country?.timezones?.[0]?.zoneName;
  const countryName = country?.name;

  // Build "today 21:30 in Auckland" as a real instant, then format in target tz.
  try {
    const nowUtc = new Date();
    const aklParts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Pacific/Auckland",
      year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(nowUtc);
    const y = aklParts.find((p) => p.type === "year")!.value;
    const m = aklParts.find((p) => p.type === "month")!.value;
    const d = aklParts.find((p) => p.type === "day")!.value;
    // 21:30 Auckland → find matching UTC by trial: use the offset from formatToParts.
    // Simpler: build via a formatted string parser using the timezone offset.
    const aklOffsetMin = tzOffsetMinutes("Pacific/Auckland", new Date(`${y}-${m}-${d}T12:00:00Z`));
    const utcTs = Date.UTC(Number(y), Number(m) - 1, Number(d), 21, 30) - aklOffsetMin * 60_000;
    const instant = new Date(utcTs);

    if (!tz || !countryName) {
      return "Each night at 21:30 NZ, merges today's diary entries into one tidy paragraph (if 2+ entries).";
    }
    const localTime = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false,
    }).format(instant);
    return `Each night at ${localTime} ${countryName} time, merges today's diary entries into one tidy paragraph (if 2+ entries).`;
  } catch {
    return "Each night at 21:30 NZ, merges today's diary entries into one tidy paragraph (if 2+ entries).";
  }
}

/** Get a timezone's offset in minutes east of UTC at a given instant. */
function tzOffsetMinutes(tz: string, at: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const parts = Object.fromEntries(dtf.formatToParts(at).map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour), Number(parts.minute), Number(parts.second),
  );
  return Math.round((asUtc - at.getTime()) / 60_000);
}

function SettingsPage() {
  const { userId } = useAuthSession();
  const qc = useQueryClient();
  useRealtimeTable("memory", ["memory"]);

  // ---- Profile ----
  const { data: profile } = useQuery({
    queryKey: ["profile-settings", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, date_of_birth, country, city, phone, telegram_chat_id, briefing_enabled, briefing_time, nudge_enabled, nudge_time, weekly_review_enabled, weekly_review_day, weekly_review_time, grocery_send_enabled, grocery_send_day, grocery_send_time, diary_summary_enabled")
        .eq("id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [userName, setUserName] = useUserName();
  const [displayName, setDisplayName] = useState(userName);
  const [dob, setDob] = useState("");
  const [country, setCountry] = useState<string>(""); // ISO code
  const [city, setCity] = useState<string>("");
  const [phone, setPhone] = useState("");

  const [chatId, setChatId] = useState("6824076380");
  const [briefingEnabled, setBriefingEnabled] = useState(true);
  const [briefingTime, setBriefingTime] = useState("07:00");
  const [nudgeEnabled, setNudgeEnabled] = useState(true);
  const [nudgeTime, setNudgeTime] = useState("18:00");
  const [reviewEnabled, setReviewEnabled] = useState(true);
  const [reviewDay, setReviewDay] = useState(0);
  const [reviewTime, setReviewTime] = useState("19:00");
  const [grocerySendEnabled, setGrocerySendEnabled] = useState(false);
  const [grocerySendDay, setGrocerySendDay] = useState<number | "every">("every");
  const [grocerySendTime, setGrocerySendTime] = useState("16:00");
  const [diarySummaryEnabled, setDiarySummaryEnabled] = useState(true);

  useEffect(() => {
    const p = profile as any;
    if (!p) return;
    if (p.display_name) setDisplayName(p.display_name);
    if (p.date_of_birth) setDob(p.date_of_birth);
    if (p.country) setCountry(p.country);
    if (p.city) setCity(p.city);
    if (p.phone) setPhone(p.phone);
    if (p.telegram_chat_id) setChatId(p.telegram_chat_id);
    if (typeof p.briefing_enabled === "boolean") setBriefingEnabled(p.briefing_enabled);
    if (p.briefing_time) setBriefingTime(String(p.briefing_time).slice(0, 5));
    if (typeof p.nudge_enabled === "boolean") setNudgeEnabled(p.nudge_enabled);
    if (p.nudge_time) setNudgeTime(String(p.nudge_time).slice(0, 5));
    if (typeof p.weekly_review_enabled === "boolean") setReviewEnabled(p.weekly_review_enabled);
    if (typeof p.weekly_review_day === "number") setReviewDay(p.weekly_review_day);
    if (p.weekly_review_time) setReviewTime(String(p.weekly_review_time).slice(0, 5));
    if (typeof p.grocery_send_enabled === "boolean") setGrocerySendEnabled(p.grocery_send_enabled);
    if (typeof p.grocery_send_day === "number") setGrocerySendDay(p.grocery_send_day);
    if (p.grocery_send_time) setGrocerySendTime(String(p.grocery_send_time).slice(0, 5));
    if (typeof p.diary_summary_enabled === "boolean") setDiarySummaryEnabled(p.diary_summary_enabled);
  }, [profile]);

  const countries = useMemo(() => Country.getAllCountries(), []);
  const cities = useMemo(
    () => (country ? City.getCitiesOfCountry(country) ?? [] : []),
    [country],
  );

  const saveProfile = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Not signed in");
      const tz = country
        ? countries.find((c) => c.isoCode === country)?.timezones?.[0]?.zoneName ?? null
        : null;
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: displayName.trim() || null,
          date_of_birth: dob || null,
          country: country || null,
          city: city || null,
          phone: phone.trim() || null,
          timezone: tz,
        } as any)
        .eq("id", userId);
      if (error) throw error;
      setUserName(displayName.trim() || "Carl");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile-settings"] });
      toast.success("Profile saved");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  // ---- Cron / Telegram save mutations ----
  const saveChatId = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Not signed in");
      const { error } = await supabase.from("profiles")
        .update({ telegram_chat_id: chatId.trim() || null }).eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["profile-settings"] }); toast.success("Telegram chat ID saved"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const saveBriefing = useMutation({
    mutationFn: async (next: { enabled: boolean; time: string }) => {
      if (!userId) throw new Error("Not signed in");
      const { error } = await supabase.from("profiles")
        .update({ briefing_enabled: next.enabled, briefing_time: next.time + ":00" }).eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["profile-settings"] }); toast.success("Morning briefing saved"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const saveNudge = useMutation({
    mutationFn: async (next: { enabled: boolean; time: string }) => {
      if (!userId) throw new Error("Not signed in");
      const { error } = await supabase.from("profiles")
        .update({ nudge_enabled: next.enabled, nudge_time: next.time + ":00" } as any).eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["profile-settings"] }); toast.success("Evening nudge saved"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const saveReview = useMutation({
    mutationFn: async (next: { enabled: boolean; day: number; time: string }) => {
      if (!userId) throw new Error("Not signed in");
      const { error } = await supabase.from("profiles")
        .update({ weekly_review_enabled: next.enabled, weekly_review_day: next.day, weekly_review_time: next.time + ":00" } as any).eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["profile-settings"] }); toast.success("Weekly review saved"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const saveGrocery = useMutation({
    mutationFn: async (next: { enabled: boolean; day: number | "every"; time: string }) => {
      if (!userId) throw new Error("Not signed in");
      const { error } = await supabase.from("profiles")
        .update({
          grocery_send_enabled: next.enabled,
          grocery_send_day: next.day === "every" ? null : next.day,
          grocery_send_time: next.time + ":00",
        } as any).eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["profile-settings"] }); toast.success("Grocery send saved"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const saveDiarySummary = useMutation({
    mutationFn: async (enabled: boolean) => {
      if (!userId) throw new Error("Not signed in");
      const { error } = await supabase.from("profiles")
        .update({ diary_summary_enabled: enabled } as any).eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["profile-settings"] }); toast.success("Daily diary summary saved"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });


  // ---- Avatar ----
  const avatarUrl = useAvatar();
  const [uploading, setUploading] = useState(false);
  const fileToAvatar = async (file: File) => {
    if (!userId) return toast.error("Not signed in");
    if (!file.type.startsWith("image/")) return toast.error("Please choose an image file");
    if (file.size > 5 * 1024 * 1024) return toast.error("Image must be under 5MB");
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
      const path = `${userId}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: prior } = await supabase.from("profiles").select("avatar_url").eq("id", userId).maybeSingle();
      const oldPath = (prior as any)?.avatar_url as string | null;
      const { error: updErr } = await supabase.from("profiles").update({ avatar_url: path } as any).eq("id", userId);
      if (updErr) throw updErr;
      if (oldPath && oldPath !== path) await supabase.storage.from("avatars").remove([oldPath]);
      notifyAvatarChanged();
      qc.invalidateQueries({ queryKey: ["profile-settings"] });
      toast.success("Avatar updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally { setUploading(false); }
  };
  const removeAvatar = async () => {
    if (!userId) return;
    setUploading(true);
    try {
      const { data: prior } = await supabase.from("profiles").select("avatar_url").eq("id", userId).maybeSingle();
      const oldPath = (prior as any)?.avatar_url as string | null;
      const { error } = await supabase.from("profiles").update({ avatar_url: null } as any).eq("id", userId);
      if (error) throw error;
      if (oldPath) await supabase.storage.from("avatars").remove([oldPath]);
      notifyAvatarChanged();
      toast.success("Avatar removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove");
    } finally { setUploading(false); }
  };

  // ---- Important people (memory: family) ----
  const { data: memories = [] } = useQuery({
    queryKey: ["memory"],
    queryFn: async () => {
      const { data, error } = await supabase.from("memory").select("*").order("updated_at", { ascending: false });
      if (error) throw error;
      return data as Memory[];
    },
  });
  const importantPeople = memories.filter((m) => m.category === "family");

  const addFact = useMutation({
    mutationFn: async ({ fact, category }: { fact: string; category: Category }) => {
      const { error } = await supabase.from("memory").insert({ fact: fact.trim(), category, source: "manual" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["memory"] }),
  });
  const updateFact = useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Partial<Memory>) => {
      const { error } = await supabase.from("memory")
        .update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["memory"] }),
  });
  const deleteFact = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("memory").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["memory"] }),
  });

  const [newPersonName, setNewPersonName] = useState("");
  const [personOpen, setPersonOpen] = useState<Memory | null>(null);
  const [otherFact, setOtherFact] = useState("");
  const [otherCategory, setOtherCategory] = useState<Category>("interest");

  return (
    <div className="px-4 py-5 sm:px-6 sm:py-6 lg:px-8 space-y-5 max-w-3xl">
      <h1 className="text-2xl font-bold">Settings / About Me</h1>

      {/* Profile card (always open) */}
      <Card className="rounded-3xl border-border/60 bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <span className="text-lg">👤</span>
          <h2 className="text-base font-bold">Your profile</h2>
        </div>

        <div className="flex items-center gap-5 mb-5">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-orange-300 to-orange-500 text-3xl shadow-sm">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Your avatar" className="h-full w-full object-cover" />
            ) : (<span>🧑‍🍳</span>)}
          </div>
          <div className="flex-1 space-y-2">
            <p className="text-xs text-muted-foreground">PNG, JPG, or WebP. Up to 5MB. Shown in the sidebar.</p>
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex">
                <input type="file" accept="image/*" className="hidden" disabled={uploading}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) fileToAvatar(f); e.target.value = ""; }} />
                <span className="inline-flex h-9 cursor-pointer items-center gap-1 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90">
                  {uploading ? "Uploading…" : avatarUrl ? "Change image" : "Upload image"}
                </span>
              </label>
              {avatarUrl && (
                <Button variant="outline" size="sm" onClick={removeAvatar} disabled={uploading}>
                  <Trash2 className="h-4 w-4 mr-1" /> Remove
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="p-name">Name</Label>
            <Input id="p-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" />
          </div>
          <div>
            <Label htmlFor="p-dob">Date of birth</Label>
            <Input id="p-dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="p-country">Country</Label>
            <select
              id="p-country"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={country}
              onChange={(e) => { setCountry(e.target.value); setCity(""); }}
            >
              <option value="">Select a country…</option>
              {countries.map((c) => (
                <option key={c.isoCode} value={c.isoCode}>{c.flag} {c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="p-city">City</Label>
            <select
              id="p-city"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              disabled={!country || cities.length === 0}
            >
              <option value="">{country ? (cities.length ? "Select a city…" : "No cities available") : "Pick a country first"}</option>
              {cities.map((c) => (
                <option key={`${c.name}-${c.stateCode}-${c.latitude}`} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="p-phone">Phone</Label>
            <Input id="p-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+64…" />
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <Button onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending}>
            <Save className="h-4 w-4 mr-1" /> Save profile
          </Button>
        </div>
      </Card>

      {/* Important people */}
      <Card className="rounded-3xl border-border/60 bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <span className="text-lg">👥</span>
          <h2 className="text-base font-bold">Important people</h2>
          <span className="text-xs text-muted-foreground">· {importantPeople.length}</span>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Family and close friends. Click a name to add relationship, birthday, phone, email.
        </p>
        <div className="flex gap-2 mb-4">
          <Input
            placeholder="Add a name…"
            value={newPersonName}
            onChange={(e) => setNewPersonName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newPersonName.trim()) {
                addFact.mutate({ fact: newPersonName.trim(), category: "family" });
                setNewPersonName("");
              }
            }}
          />
          <Button
            onClick={() => {
              if (!newPersonName.trim()) return;
              addFact.mutate({ fact: newPersonName.trim(), category: "family" });
              setNewPersonName("");
            }}
            disabled={!newPersonName.trim()}
          >
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </div>
        {importantPeople.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">No one added yet.</p>
        ) : (
          <div className="divide-y divide-border/60">
            {importantPeople.map((p) => (
              <div key={p.id} className="flex items-center gap-3 py-3">
                <button type="button" onClick={() => setPersonOpen(p)} className="min-w-0 flex-1 text-left">
                  <div className="text-sm font-semibold">{p.fact}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.relationship || "Add details"}
                    {p.birth_date && (
                      <span className="ml-2 inline-flex items-center gap-1">
                        <Cake className="h-3 w-3" />
                        {format(new Date(p.birth_date), "d MMM")}
                      </span>
                    )}
                    {p.contact_phone && <span className="ml-2">· {p.contact_phone}</span>}
                  </div>
                </button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-red-600"
                  onClick={() => deleteFact.mutate(p.id)} title="Delete">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Collapsible sections */}
      <Accordion type="multiple" className="space-y-4" defaultValue={[]}>

        {/* Telegram */}
        <AccordionItem value="telegram" className="border-none">
          <Card className="rounded-3xl border-border/60 bg-card px-5 shadow-sm">
            <AccordionTrigger className="py-4 hover:no-underline">
              <span className="flex items-center gap-2 text-base font-bold">
                <span className="text-lg">💬</span> Telegram <span className="text-xs text-muted-foreground font-normal">(enter your telegram details to integrate telegram)</span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-5 space-y-3">
              <Label htmlFor="chat-id">Telegram chat ID</Label>
              <div className="flex gap-2">
                <Input id="chat-id" value={chatId} onChange={(e) => setChatId(e.target.value)} placeholder="Your Telegram chat ID" />
                <Button onClick={() => saveChatId.mutate()} disabled={saveChatId.isPending}>
                  <Save className="h-4 w-4 mr-1" /> Save
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Used by the assistant bot to send you replies and confirmations.</p>
            </AccordionContent>
          </Card>
        </AccordionItem>

        {/* Morning briefing */}
        <AccordionItem value="briefing" className="border-none">
          <Card className="rounded-3xl border-border/60 bg-card px-5 shadow-sm">
            <AccordionTrigger className="py-4 hover:no-underline">
              <span className="flex items-center gap-2 text-base font-bold">
                <span className="text-lg">☀️</span> Morning briefing
                <span className="text-xs text-muted-foreground font-normal">{briefingEnabled ? `· ${briefingTime}` : "· off"}</span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Daily summary of meetings, tasks, birthdays & weather.</p>
                <input type="checkbox" className="h-5 w-5 accent-primary" checked={briefingEnabled}
                  onChange={(e) => { setBriefingEnabled(e.target.checked); saveBriefing.mutate({ enabled: e.target.checked, time: briefingTime }); }} />
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Label htmlFor="briefing-time">Send at</Label>
                  <Input id="briefing-time" type="time" value={briefingTime}
                    onChange={(e) => setBriefingTime(e.target.value)} disabled={!briefingEnabled} />
                </div>
                <Button onClick={() => saveBriefing.mutate({ enabled: briefingEnabled, time: briefingTime })}
                  disabled={saveBriefing.isPending}>
                  <Save className="h-4 w-4 mr-1" /> Save
                </Button>
              </div>
            </AccordionContent>
          </Card>
        </AccordionItem>

        {/* Evening nudge */}
        <AccordionItem value="nudge" className="border-none">
          <Card className="rounded-3xl border-border/60 bg-card px-5 shadow-sm">
            <AccordionTrigger className="py-4 hover:no-underline">
              <span className="flex items-center gap-2 text-base font-bold">
                <span className="text-lg">🌙</span> Evening nudge
                <span className="text-xs text-muted-foreground font-normal">{nudgeEnabled ? `· ${nudgeTime}` : "· off"}</span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Reminds you of tasks still open or overdue today.</p>
                <input type="checkbox" className="h-5 w-5 accent-primary" checked={nudgeEnabled}
                  onChange={(e) => { setNudgeEnabled(e.target.checked); saveNudge.mutate({ enabled: e.target.checked, time: nudgeTime }); }} />
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Label htmlFor="nudge-time">Send at</Label>
                  <Input id="nudge-time" type="time" value={nudgeTime}
                    onChange={(e) => setNudgeTime(e.target.value)} disabled={!nudgeEnabled} />
                </div>
                <Button onClick={() => saveNudge.mutate({ enabled: nudgeEnabled, time: nudgeTime })}
                  disabled={saveNudge.isPending}>
                  <Save className="h-4 w-4 mr-1" /> Save
                </Button>
              </div>
            </AccordionContent>
          </Card>
        </AccordionItem>

        {/* Weekly review */}
        <AccordionItem value="review" className="border-none">
          <Card className="rounded-3xl border-border/60 bg-card px-5 shadow-sm">
            <AccordionTrigger className="py-4 hover:no-underline">
              <span className="flex items-center gap-2 text-base font-bold">
                <span className="text-lg">📊</span> Weekly review
                <span className="text-xs text-muted-foreground font-normal">{reviewEnabled ? `· ${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][reviewDay]} ${reviewTime}` : "· off"}</span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Wins, carried-over tasks, week in brief, and the week ahead.</p>
                <input type="checkbox" className="h-5 w-5 accent-primary" checked={reviewEnabled}
                  onChange={(e) => setReviewEnabled(e.target.checked)} />
              </div>
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] items-end">
                <div>
                  <Label htmlFor="review-day">Day</Label>
                  <select id="review-day"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={reviewDay} onChange={(e) => setReviewDay(parseInt(e.target.value, 10))}
                    disabled={!reviewEnabled}>
                    <option value={0}>Sunday</option><option value={1}>Monday</option>
                    <option value={2}>Tuesday</option><option value={3}>Wednesday</option>
                    <option value={4}>Thursday</option><option value={5}>Friday</option>
                    <option value={6}>Saturday</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="review-time">Send at</Label>
                  <Input id="review-time" type="time" value={reviewTime}
                    onChange={(e) => setReviewTime(e.target.value)} disabled={!reviewEnabled} />
                </div>
                <Button onClick={() => saveReview.mutate({ enabled: reviewEnabled, day: reviewDay, time: reviewTime })}
                  disabled={saveReview.isPending}>
                  <Save className="h-4 w-4 mr-1" /> Save
                </Button>
              </div>
            </AccordionContent>
          </Card>
        </AccordionItem>

        {/* Grocery */}
        <AccordionItem value="grocery" className="border-none">
          <Card className="rounded-3xl border-border/60 bg-card px-5 shadow-sm">
            <AccordionTrigger className="py-4 hover:no-underline">
              <span className="flex items-center gap-2 text-base font-bold">
                <span className="text-lg">🛒</span> Grocery list
                <span className="text-xs text-muted-foreground font-normal">{grocerySendEnabled ? `· ${grocerySendDay === "every" ? "daily" : ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][grocerySendDay as number]} ${grocerySendTime}` : "· off"}</span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Sends your current shopping list to Telegram.</p>
                <input type="checkbox" className="h-5 w-5 accent-primary" checked={grocerySendEnabled}
                  onChange={(e) => setGrocerySendEnabled(e.target.checked)} />
              </div>
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] items-end">
                <div>
                  <Label htmlFor="grocery-day">Day</Label>
                  <select id="grocery-day"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={String(grocerySendDay)}
                    onChange={(e) => { const v = e.target.value; setGrocerySendDay(v === "every" ? "every" : parseInt(v, 10)); }}
                    disabled={!grocerySendEnabled}>
                    <option value="every">Every day</option>
                    <option value="0">Sunday</option><option value="1">Monday</option>
                    <option value="2">Tuesday</option><option value="3">Wednesday</option>
                    <option value="4">Thursday</option><option value="5">Friday</option>
                    <option value="6">Saturday</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="grocery-time">Send at</Label>
                  <Input id="grocery-time" type="time" value={grocerySendTime}
                    onChange={(e) => setGrocerySendTime(e.target.value)} disabled={!grocerySendEnabled} />
                </div>
                <Button onClick={() => saveGrocery.mutate({ enabled: grocerySendEnabled, day: grocerySendDay, time: grocerySendTime })}
                  disabled={saveGrocery.isPending}>
                  <Save className="h-4 w-4 mr-1" /> Save
                </Button>
              </div>
            </AccordionContent>
          </Card>
        </AccordionItem>

        {/* Diary summary */}
        <AccordionItem value="diary" className="border-none">
          <Card className="rounded-3xl border-border/60 bg-card px-5 shadow-sm">
            <AccordionTrigger className="py-4 hover:no-underline">
              <span className="flex items-center gap-2 text-base font-bold">
                <span className="text-lg">📓</span> Daily diary summary
                <span className="text-xs text-muted-foreground font-normal">{diarySummaryEnabled ? "· on" : "· off"}</span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-5">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {diarySummarySentence(country, countries)}
                </p>
                <input type="checkbox" className="h-5 w-5 accent-primary" checked={diarySummaryEnabled}
                  onChange={(e) => { setDiarySummaryEnabled(e.target.checked); saveDiarySummary.mutate(e.target.checked); }} />
              </div>
            </AccordionContent>
          </Card>
        </AccordionItem>

        {/* About-me notes */}
        <AccordionItem value="about-notes" className="border-none">
          <Card className="rounded-3xl border-border/60 bg-card px-5 shadow-sm">
            <AccordionTrigger className="py-4 hover:no-underline">
              <span className="flex items-center gap-2 text-base font-bold">
                <span className="text-lg">📝</span> About me notes
                <span className="text-xs text-muted-foreground font-normal">
                  · {memories.filter((m) => m.category !== "family").length}
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-5 space-y-4">
              <p className="text-xs text-muted-foreground">
                Facts the assistant remembers about you — interests, projects, preferences, etc.
              </p>
              <div className="flex flex-wrap gap-2">
                <Input placeholder="Add a fact about yourself…" value={otherFact}
                  onChange={(e) => setOtherFact(e.target.value)} className="flex-1 min-w-[200px]" />
                <select className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={otherCategory} onChange={(e) => setOtherCategory(e.target.value as Category)}>
                  {OTHER_MEMORY_CATEGORIES.map((c) => (
                    <option key={c.key} value={c.key}>{c.label}</option>
                  ))}
                </select>
                <Button onClick={() => {
                  if (!otherFact.trim()) return;
                  addFact.mutate({ fact: otherFact.trim(), category: otherCategory });
                  setOtherFact("");
                }} disabled={!otherFact.trim()}>
                  <Plus className="h-4 w-4 mr-1" /> Add
                </Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {OTHER_MEMORY_CATEGORIES.map(({ key, label }) => {
                  const items = memories.filter((m) => m.category === key);
                  if (items.length === 0) return null;
                  return (
                    <div key={key}>
                      <h3 className="mb-2 text-sm font-semibold">{label} <span className="text-xs text-muted-foreground">· {items.length}</span></h3>
                      <div className="space-y-1">
                        {items.map((m) => (
                          <div key={m.id} className="group flex items-center gap-2 rounded-md border border-border/40 px-2 py-1">
                            <Input defaultValue={m.fact}
                              onBlur={(e) => { if (e.target.value !== m.fact) updateFact.mutate({ id: m.id, fact: e.target.value }); }}
                              className="flex-1 border-none bg-transparent p-0 shadow-none focus-visible:ring-0" />
                            <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100"
                              onClick={() => deleteFact.mutate(m.id)}>
                              <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </AccordionContent>
          </Card>
        </AccordionItem>
      </Accordion>

      <PersonDialog
        member={personOpen}
        onClose={() => setPersonOpen(null)}
        onSave={(patch) => {
          if (personOpen) updateFact.mutate({ id: personOpen.id, ...patch });
          setPersonOpen(null);
        }}
      />
    </div>
  );
}

function PersonDialog({
  member, onClose, onSave,
}: {
  member: Memory | null;
  onClose: () => void;
  onSave: (patch: Partial<Memory>) => void;
}) {
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const open = !!member;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent key={member?.id} onOpenAutoFocus={() => {
        setName(member?.fact ?? "");
        setRelationship(member?.relationship ?? "");
        setEmail(member?.contact_email ?? "");
        setPhone(member?.contact_phone ?? "");
        setBirthDate(member?.birth_date ?? "");
      }}>
        <DialogHeader><DialogTitle>Contact details</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div><Label htmlFor="fm-name">Name</Label>
            <Input id="fm-name" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label htmlFor="fm-rel">Relationship</Label>
            <Input id="fm-rel" placeholder="e.g. Daughter, Friend" value={relationship} onChange={(e) => setRelationship(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label htmlFor="fm-email">Email</Label>
              <Input id="fm-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div><Label htmlFor="fm-phone">Phone</Label>
              <Input id="fm-phone" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          </div>
          <div><Label htmlFor="fm-bday">Birth date <span className="font-normal text-muted-foreground">— you'll receive notifications of the birthday</span></Label>
            <Input id="fm-bday" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
            <p className="mt-1 text-xs text-muted-foreground">Birthdays within 7 days appear on the dashboard.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave({
            fact: name.trim() || member?.fact || "Untitled",
            relationship: relationship.trim() || null,
            contact_email: email.trim() || null,
            contact_phone: phone.trim() || null,
            birth_date: birthDate || null,
          })}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
