import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Country, City } from "country-state-city";
import { toast } from "sonner";
import {
  Plus, Trash2, Plane, Train, Bus, Car, Hotel, MapPin, Mic, MicOff,
  ChevronDown, ChevronRight, Info, ExternalLink, Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/hooks/useAuthSession";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { nearbyPlaces, stationInfo } from "@/lib/itinerary.functions";

export const Route = createFileRoute("/itinerary")({
  head: () => ({ meta: [{ title: "Itinerary — Personal OS" }] }),
  component: ItineraryPage,
});

type LegType = "flight" | "train" | "bus" | "vehicle" | "accommodation";

type Itinerary = {
  id: string;
  name: string;
  country: string | null;
  city: string | null;
  start_date: string | null;
  end_date: string | null;
  travel_modes: string[];
};

type Leg = {
  id: string;
  itinerary_id: string;
  position: number;
  type: LegType;
  from_label: string | null;
  to_label: string | null;
  depart_at: string | null;
  arrive_at: string | null;
  details: Record<string, unknown>;
};

const TRAVEL_MODES: { key: LegType; label: string; icon: typeof Plane }[] = [
  { key: "vehicle", label: "Vehicle", icon: Car },
  { key: "train", label: "Train", icon: Train },
  { key: "flight", label: "Plane", icon: Plane },
  { key: "bus", label: "Bus", icon: Bus },
];

const LEG_ICONS: Record<LegType, typeof Plane> = {
  flight: Plane, train: Train, bus: Bus, vehicle: Car, accommodation: Hotel,
};

function ItineraryPage() {
  const { userId } = useAuthSession();
  const qc = useQueryClient();
  useRealtimeTable("itineraries", ["itineraries"]);
  useRealtimeTable("itinerary_legs", ["itinerary-legs"]);

  const { data: itineraries = [] } = useQuery({
    queryKey: ["itineraries"],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("itineraries" as never)
        .select("*")
        .order("start_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as unknown as Itinerary[];
    },
  });

  const createItinerary = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("itineraries" as never)
        .insert({ user_id: userId, name: "New trip", travel_modes: [] } as never)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Itinerary;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["itineraries"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="Itinerary"
        subtitle="Plan trips, legs, accommodation, and get local recommendations"
        action={
          <Button onClick={() => createItinerary.mutate()}>
            <Plus className="h-4 w-4 mr-2" /> New itinerary
          </Button>
        }
      />

      {itineraries.length === 0 && (
        <Card className="p-8 text-center text-muted-foreground">
          No itineraries yet. Click <b>New itinerary</b> to start planning your trip.
        </Card>
      )}

      <Accordion type="multiple" className="space-y-3">
        {itineraries.map((it) => (
          <ItineraryCard key={it.id} itinerary={it} />
        ))}
      </Accordion>
    </div>
  );
}

function ItineraryCard({ itinerary }: { itinerary: Itinerary }) {
  const qc = useQueryClient();
  const countries = useMemo(() => Country.getAllCountries(), []);
  const cities = useMemo(
    () => (itinerary.country ? City.getCitiesOfCountry(itinerary.country) ?? [] : []),
    [itinerary.country],
  );

  const [form, setForm] = useState({
    name: itinerary.name,
    country: itinerary.country ?? "",
    city: itinerary.city ?? "",
    start_date: itinerary.start_date ?? "",
    end_date: itinerary.end_date ?? "",
    travel_modes: itinerary.travel_modes ?? [],
  });
  useEffect(() => {
    setForm({
      name: itinerary.name,
      country: itinerary.country ?? "",
      city: itinerary.city ?? "",
      start_date: itinerary.start_date ?? "",
      end_date: itinerary.end_date ?? "",
      travel_modes: itinerary.travel_modes ?? [],
    });
  }, [itinerary.id]);

  const save = useMutation({
    mutationFn: async (patch: Partial<Itinerary>) => {
      const { error } = await supabase
        .from("itineraries" as never)
        .update(patch as never)
        .eq("id", itinerary.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["itineraries"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("itineraries" as never).delete().eq("id", itinerary.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["itineraries"] });
      toast.success("Itinerary deleted");
    },
  });

  const toggleMode = (mode: LegType) => {
    const next = form.travel_modes.includes(mode)
      ? form.travel_modes.filter((m) => m !== mode)
      : [...form.travel_modes, mode];
    setForm({ ...form, travel_modes: next });
    save.mutate({ travel_modes: next });
  };

  return (
    <AccordionItem value={itinerary.id} className="border rounded-lg bg-card">
      <AccordionTrigger className="px-4 hover:no-underline">
        <div className="flex items-center gap-3 text-left">
          <MapPin className="h-4 w-4 text-primary" />
          <div>
            <div className="font-semibold">{itinerary.name || "Untitled trip"}</div>
            <div className="text-xs text-muted-foreground">
              {itinerary.city ? `${itinerary.city}, ` : ""}
              {countries.find((c) => c.isoCode === itinerary.country)?.name ?? "No destination"}
              {itinerary.start_date && ` · ${itinerary.start_date}`}
              {itinerary.end_date && ` → ${itinerary.end_date}`}
            </div>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4 space-y-5">
        {/* Header form */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label>Itinerary name</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              onBlur={() => save.mutate({ name: form.name })}
              placeholder="e.g. Japan Spring 2026"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Start date</Label>
              <Input
                type="date"
                value={form.start_date}
                onChange={(e) => {
                  setForm({ ...form, start_date: e.target.value });
                  save.mutate({ start_date: e.target.value || null });
                }}
              />
            </div>
            <div>
              <Label>End date</Label>
              <Input
                type="date"
                value={form.end_date}
                onChange={(e) => {
                  setForm({ ...form, end_date: e.target.value });
                  save.mutate({ end_date: e.target.value || null });
                }}
              />
            </div>
          </div>
          <div>
            <Label>Country</Label>
            <Select
              value={form.country}
              onValueChange={(v) => {
                setForm({ ...form, country: v, city: "" });
                save.mutate({ country: v, city: null });
              }}
            >
              <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {countries.map((c) => (
                  <SelectItem key={c.isoCode} value={c.isoCode}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>City</Label>
            <Select
              value={form.city}
              onValueChange={(v) => {
                setForm({ ...form, city: v });
                save.mutate({ city: v });
              }}
              disabled={!form.country}
            >
              <SelectTrigger><SelectValue placeholder={form.country ? "Select city" : "Pick country first"} /></SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {cities.map((c) => (
                  <SelectItem key={`${c.name}-${c.latitude}-${c.longitude}`} value={c.name}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label className="mb-2 block">Travel modes (select one or more)</Label>
          <div className="flex flex-wrap gap-2">
            {TRAVEL_MODES.map((m) => {
              const active = form.travel_modes.includes(m.key);
              const Icon = m.icon;
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => toggleMode(m.key)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm transition ${
                    active ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"
                  }`}
                >
                  <Icon className="h-4 w-4" /> {m.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Legs */}
        <LegsSection itinerary={itinerary} country={countries.find((c) => c.isoCode === form.country)?.name} city={form.city} />

        <div className="pt-2 border-t flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => del.mutate()}>
            <Trash2 className="h-4 w-4 mr-1" /> Delete itinerary
          </Button>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

function LegsSection({ itinerary, country, city }: { itinerary: Itinerary; country?: string; city: string }) {
  const qc = useQueryClient();
  const { data: legs = [] } = useQuery({
    queryKey: ["itinerary-legs", itinerary.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("itinerary_legs" as never)
        .select("*")
        .eq("itinerary_id", itinerary.id)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Leg[];
    },
  });

  const addLeg = useMutation({
    mutationFn: async (type: LegType) => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Not signed in");
      const { error } = await supabase.from("itinerary_legs" as never).insert({
        itinerary_id: itinerary.id,
        user_id: uid,
        type,
        position: legs.length,
        details: {},
      } as never);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["itinerary-legs", itinerary.id] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const allowedModes: LegType[] = [
    ...(itinerary.travel_modes as LegType[]),
    "accommodation",
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Legs</h3>
        <div className="flex flex-wrap gap-1.5">
          {allowedModes.map((m) => {
            const Icon = LEG_ICONS[m];
            return (
              <Button key={m} size="sm" variant="outline" onClick={() => addLeg.mutate(m)}>
                <Icon className="h-3.5 w-3.5 mr-1" /> Add {m === "accommodation" ? "stay" : m}
              </Button>
            );
          })}
        </div>
      </div>
      {legs.length === 0 && (
        <p className="text-sm text-muted-foreground italic">
          No legs yet. Add flights, trains, buses, vehicles, or accommodation above.
        </p>
      )}
      {legs.map((leg) => (
        <LegCard key={leg.id} leg={leg} itineraryId={itinerary.id} country={country} city={city} />
      ))}
    </div>
  );
}

function LegCard({ leg, itineraryId, country, city }: { leg: Leg; itineraryId: string; country?: string; city: string }) {
  const qc = useQueryClient();
  const Icon = LEG_ICONS[leg.type];
  const [expanded, setExpanded] = useState(true);
  const [local, setLocal] = useState({
    from_label: leg.from_label ?? "",
    to_label: leg.to_label ?? "",
    depart_at: leg.depart_at ? leg.depart_at.slice(0, 16) : "",
    arrive_at: leg.arrive_at ? leg.arrive_at.slice(0, 16) : "",
    details: (leg.details ?? {}) as Record<string, string>,
  });

  const save = useMutation({
    mutationFn: async (patch: Partial<Leg>) => {
      const { error } = await supabase.from("itinerary_legs" as never).update(patch as never).eq("id", leg.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["itinerary-legs", itineraryId] }),
  });

  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("itinerary_legs" as never).delete().eq("id", leg.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["itinerary-legs", itineraryId] }),
  });

  const commit = () => {
    save.mutate({
      from_label: local.from_label || null,
      to_label: local.to_label || null,
      depart_at: local.depart_at ? new Date(local.depart_at).toISOString() : null,
      arrive_at: local.arrive_at ? new Date(local.arrive_at).toISOString() : null,
      details: local.details as never,
    });
  };

  const setDetail = (k: string, v: string) => setLocal({ ...local, details: { ...local.details, [k]: v } });

  const title = leg.type === "accommodation"
    ? (local.details.name || "Accommodation")
    : `${local.from_label || "?"} → ${local.to_label || "?"}`;

  return (
    <Card className="p-3">
      <div className="flex items-center gap-2">
        <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-2 flex-1 text-left">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <Icon className="h-4 w-4 text-primary" />
          <span className="font-medium capitalize">{leg.type}</span>
          <span className="text-sm text-muted-foreground truncate">— {title}</span>
        </button>
        <Button variant="ghost" size="sm" onClick={() => del.mutate()}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {expanded && (
        <div className="mt-3 space-y-3">
          {leg.type === "accommodation" ? (
            <AccommodationFields local={local} setLocal={setLocal} setDetail={setDetail} commit={commit} country={country} city={city} legId={leg.id} />
          ) : (
            <TransportFields type={leg.type} local={local} setLocal={setLocal} setDetail={setDetail} commit={commit} />
          )}
        </div>
      )}
    </Card>
  );
}

function TransportFields({
  type, local, setLocal, setDetail, commit,
}: {
  type: LegType;
  local: { from_label: string; to_label: string; depart_at: string; arrive_at: string; details: Record<string, string> };
  setLocal: (v: typeof local) => void;
  setDetail: (k: string, v: string) => void;
  commit: () => void;
}) {
  const [showInfo, setShowInfo] = useState(false);
  const stationInfoFn = useServerFn(stationInfo);
  const [info, setInfo] = useState<Awaited<ReturnType<typeof stationInfo>> | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(false);

  const kind = type === "flight" ? "airport" : type === "train" ? "train" : "bus";
  const infoLabel = type === "flight" ? "airport" : type === "train" ? "train station" : "bus terminal";

  const loadInfo = async () => {
    const name = local.to_label || local.from_label;
    if (!name) { toast.error("Enter a from/to first"); return; }
    setLoadingInfo(true);
    try {
      const r = await stationInfoFn({ data: { kind: kind as "airport" | "train" | "bus", name } });
      setInfo(r);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoadingInfo(false);
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label>From</Label>
          <Input
            value={local.from_label}
            onChange={(e) => setLocal({ ...local, from_label: e.target.value })}
            onBlur={commit}
            placeholder={type === "flight" ? "e.g. AKL" : "Origin"}
          />
        </div>
        <div>
          <Label>To</Label>
          <Input
            value={local.to_label}
            onChange={(e) => setLocal({ ...local, to_label: e.target.value })}
            onBlur={commit}
            placeholder={type === "flight" ? "e.g. NRT" : "Destination"}
          />
        </div>
        <div>
          <Label>Depart</Label>
          <Input type="datetime-local" value={local.depart_at} onChange={(e) => setLocal({ ...local, depart_at: e.target.value })} onBlur={commit} />
        </div>
        <div>
          <Label>Arrive</Label>
          <Input type="datetime-local" value={local.arrive_at} onChange={(e) => setLocal({ ...local, arrive_at: e.target.value })} onBlur={commit} />
        </div>
        {type === "flight" && (
          <>
            <div>
              <Label>Airline</Label>
              <Input value={local.details.airline ?? ""} onChange={(e) => setDetail("airline", e.target.value)} onBlur={commit} placeholder="e.g. Air NZ" />
            </div>
            <div>
              <Label>Flight number</Label>
              <Input value={local.details.number ?? ""} onChange={(e) => setDetail("number", e.target.value)} onBlur={commit} placeholder="e.g. NZ99" />
            </div>
          </>
        )}
        {(type === "train" || type === "bus") && (
          <>
            <div>
              <Label>Operator</Label>
              <Input value={local.details.operator ?? ""} onChange={(e) => setDetail("operator", e.target.value)} onBlur={commit} />
            </div>
            <div>
              <Label>{type === "train" ? "Train" : "Route"} number</Label>
              <Input value={local.details.number ?? ""} onChange={(e) => setDetail("number", e.target.value)} onBlur={commit} />
            </div>
          </>
        )}
        {type === "vehicle" && (
          <div className="md:col-span-2">
            <Label>Vehicle / driver notes</Label>
            <Input value={local.details.vehicle ?? ""} onChange={(e) => setDetail("vehicle", e.target.value)} onBlur={commit} placeholder="e.g. Rental — Toyota Corolla" />
          </div>
        )}
        <div className="md:col-span-2">
          <Label>Notes</Label>
          <Textarea value={local.details.notes ?? ""} onChange={(e) => setDetail("notes", e.target.value)} onBlur={commit} rows={2} />
        </div>
      </div>

      {type !== "vehicle" && (
        <div className="border-t pt-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={showInfo} onChange={(e) => setShowInfo(e.target.checked)} />
            <Info className="h-4 w-4" /> Show {infoLabel} info (lounges, parking, transit)
          </label>
          {showInfo && (
            <div className="mt-2 space-y-2">
              <Button size="sm" variant="outline" onClick={loadInfo} disabled={loadingInfo}>
                <Sparkles className="h-3.5 w-3.5 mr-1" />
                {loadingInfo ? "Loading…" : info ? "Refresh" : `Get ${infoLabel} info`}
              </Button>
              {info && (
                <div className="text-sm space-y-2 bg-muted/40 rounded p-3">
                  {info.summary && <p>{info.summary}</p>}
                  {info.lounges.length > 0 && <div><b>Lounges:</b> {info.lounges.join(", ")}</div>}
                  {info.parking.length > 0 && <div><b>Parking:</b> {info.parking.join(", ")}</div>}
                  {info.transit.length > 0 && <div><b>Transit:</b> {info.transit.join(", ")}</div>}
                  {info.tips.length > 0 && (
                    <div><b>Tips:</b><ul className="list-disc ml-5">{info.tips.map((t, i) => <li key={i}>{t}</li>)}</ul></div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}

function AccommodationFields({
  local, setLocal, setDetail, commit, country, city, legId,
}: {
  local: { from_label: string; to_label: string; depart_at: string; arrive_at: string; details: Record<string, string> };
  setLocal: (v: typeof local) => void;
  setDetail: (k: string, v: string) => void;
  commit: () => void;
  country?: string;
  city: string;
  legId: string;
}) {
  const address = local.details.address ?? "";
  const name = local.details.name ?? "";
  const mapQuery = encodeURIComponent([name, address, city, country].filter(Boolean).join(", "));
  const embedUrl = mapQuery ? `https://www.google.com/maps?q=${mapQuery}&output=embed` : null;
  const openUrl = mapQuery ? `https://www.google.com/maps/search/?api=1&query=${mapQuery}` : null;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label>Place name</Label>
          <Input value={name} onChange={(e) => setDetail("name", e.target.value)} onBlur={commit} placeholder="e.g. Park Hyatt Tokyo" />
        </div>
        <div>
          <Label>Address</Label>
          <Input value={address} onChange={(e) => setDetail("address", e.target.value)} onBlur={commit} placeholder="Street, city" />
        </div>
        <div>
          <Label>Check-in</Label>
          <Input type="datetime-local" value={local.depart_at} onChange={(e) => setLocal({ ...local, depart_at: e.target.value })} onBlur={commit} />
        </div>
        <div>
          <Label>Check-out</Label>
          <Input type="datetime-local" value={local.arrive_at} onChange={(e) => setLocal({ ...local, arrive_at: e.target.value })} onBlur={commit} />
        </div>
        <div className="md:col-span-2">
          <Label>Notes</Label>
          <Textarea value={local.details.notes ?? ""} onChange={(e) => setDetail("notes", e.target.value)} onBlur={commit} rows={2} />
        </div>
      </div>

      {embedUrl && (
        <div className="rounded-lg overflow-hidden border">
          <iframe
            title={`Map of ${name || address}`}
            src={embedUrl}
            className="w-full h-64"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
          {openUrl && (
            <a href={openUrl} target="_blank" rel="noreferrer" className="block px-3 py-2 text-xs text-primary hover:underline">
              Open in Google Maps <ExternalLink className="inline h-3 w-3" />
            </a>
          )}
        </div>
      )}

      <NearbySection
        legId={legId}
        accommodation={[name, address].filter(Boolean).join(", ")}
        city={city}
        country={country}
      />
    </div>
  );
}

// -------------- Nearby AI search --------------
function NearbySection({
  legId, accommodation, city, country,
}: { legId: string; accommodation: string; city: string; country?: string }) {
  const nearbyFn = useServerFn(nearbyPlaces);
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<Array<{ name: string; category: string; address: string; distance: string; why: string }>>([]);
  const [loading, setLoading] = useState(false);
  const { listening, toggle, supported } = useMicDictation(setQuery);

  const search = async () => {
    if (!accommodation) { toast.error("Enter place name or address first"); return; }
    if (!query.trim()) return;
    setLoading(true);
    try {
      const r = await nearbyFn({ data: { accommodation, city, country, query } });
      setPlaces(r.places);
      if (r.places.length === 0) toast.info("No results — try rephrasing");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border-t pt-3 space-y-3">
      <div>
        <Label className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          What do you need near {accommodation ? `"${accommodation.slice(0, 40)}${accommodation.length > 40 ? "…" : ""}"` : "your stay"}?
        </Label>
        <p className="text-xs text-muted-foreground mt-1">
          Restaurants, bars, shopping, events, coffee — just ask. Tap the mic to dictate.
        </p>
      </div>
      <div className="flex gap-2">
        <Textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. Cozy sushi places under $50 within walking distance"
          rows={2}
          className="flex-1"
        />
        <div className="flex flex-col gap-1">
          {supported && (
            <Button
              type="button"
              variant={listening ? "default" : "outline"}
              size="icon"
              onClick={toggle}
              title={listening ? "Stop recording" : "Dictate"}
            >
              {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
          )}
          <Button onClick={search} disabled={loading || !query.trim()} size="sm">
            {loading ? "Searching…" : "Find"}
          </Button>
        </div>
      </div>

      {places.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {places.map((p, i) => {
            const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.name}, ${p.address}`)}`;
            return (
              <Card key={i} className="p-3 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium text-sm">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.category} · {p.distance}</div>
                  </div>
                  <a href={mapUrl} target="_blank" rel="noreferrer" className="text-primary text-xs hover:underline shrink-0">
                    <MapPin className="inline h-3 w-3" /> Map
                  </a>
                </div>
                <div className="text-xs">{p.address}</div>
                <div className="text-xs italic text-muted-foreground">{p.why}</div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// -------------- Microphone dictation --------------
function useMicDictation(onText: (t: string) => void) {
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);
  const supported = typeof window !== "undefined" &&
    ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  const toggle = () => {
    if (!supported) { toast.error("Speech recognition not supported in this browser"); return; }
    if (listening) {
      recRef.current?.stop();
      setListening(false);
      return;
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = navigator.language || "en-US";
    rec.onresult = (e: any) => {
      const text = Array.from(e.results).map((r: any) => r[0].transcript).join(" ");
      onText(text);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    rec.start();
    recRef.current = rec;
    setListening(true);
  };

  return { listening, toggle, supported: !!supported };
}
