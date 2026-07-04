# Itinerary Page Plan

A new `/itinerary` route where you build travel itineraries with legs (flights, trains, buses, vehicles), accommodations, and get AI-powered "what's nearby" recommendations with maps.

## Page structure

**1. Itinerary header**
- Itinerary name (text)
- Destination country + city (same dropdowns as Settings, using `country-state-city`)
- Travel dates (start / end date pickers)
- Travel modes: checkboxes for Vehicle, Train, Plane, Bus (select one or more — controls which leg types the "Add leg" menu offers)

**2. Legs (ordered list, add/remove/reorder)**
Each leg has a type + shared fields (from/to, depart time, arrive time, notes) plus type-specific fields:
- **Flight**: airline, flight number, departure airport (IATA), arrival airport, depart/arrive datetime. Toggle: "Show airport info (lounges, parking, transit)" → calls AI to summarize both airports.
- **Train**: operator, train number, from/to station, depart/arrive. Toggle: "Show station info".
- **Bus**: operator, route/number, from/to stop, depart/arrive. Toggle: "Show station info".
- **Vehicle**: from/to, depart time, driver/vehicle notes.
- **Accommodation** (also a leg-type entry so it slots into the timeline): name, address, check-in / check-out, notes. Shows a Google Map for the address and unlocks the nearby-search box.

**3. Nearby places (per accommodation)**
- Prompt: "What do you need near {accommodation name}? Restaurants, bars, shopping, events, anything else…"
- Text input + microphone button (Web Speech API `SpeechRecognition`) + date range (auto-filled from stay dates).
- Submit → server function calls Lovable AI (`google/gemini-3-flash-preview`) with tool-calling to Google Places (New) `searchText`/`searchNearby` via the existing Google Maps connector gateway, biased to the accommodation coordinates.
- Results render as cards: name, category, rating, distance from accommodation, address, "Open in map" link. All results also plotted as pins on a shared map next to the accommodation, with the accommodation as the anchor pin.

## Data model

New tables (RLS, `auth.uid()`-scoped, standard GRANTs, `updated_at` trigger):

```text
itineraries
  id, user_id, name, country, city, start_date, end_date, travel_modes text[]

itinerary_legs
  id, itinerary_id, user_id, position int, type
  ('flight'|'train'|'bus'|'vehicle'|'accommodation'),
  from_label, to_label, depart_at, arrive_at,
  details jsonb   -- flight_no, airline, address, coords, toggles, etc.

itinerary_nearby_searches
  id, leg_id, user_id, query, results jsonb, created_at
```

## AI + Maps

- **Nearby search** and **airport/station info**: TanStack server functions in `src/lib/itinerary.functions.ts` guarded by `requireSupabaseAuth`, using the Lovable AI gateway (`ai-sdk-lovable-gateway`) with a `places_search` tool that proxies through the existing Google Maps connector gateway (`places/v1/places:searchText`, `places/v1/places:searchNearby`).
- **Maps** rendered client-side with the Maps JS API using `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY` (already available via the connector). Accommodation pin + result pins, click-to-open in Google Maps.
- **Microphone** uses the browser `webkitSpeechRecognition` / `SpeechRecognition` API — no server component. Falls back gracefully if unsupported.

## Files

- `supabase/migrations/<ts>_itinerary.sql` — 3 tables + GRANTs + RLS + trigger.
- `src/routes/itinerary.tsx` — list of itineraries + create button.
- `src/routes/itinerary.$id.tsx` — itinerary detail (header, legs, nearby).
- `src/lib/itinerary.functions.ts` — `nearbySearch`, `placeInfo` server fns.
- `src/components/itinerary/LegCard.tsx`, `AccommodationMap.tsx`, `NearbySearch.tsx`, `MicButton.tsx`.
- `src/components/AppSidebar.tsx` — add "Itinerary" entry.

## Notes

- Country/city dropdown reuses the exact pattern from Settings.
- Legs render in a single timeline sorted by `position` (drag handles for reorder — simple up/down buttons first pass).
- Airport/station info panel is collapsed by default; expanding triggers the AI call once and caches into the leg's `details.info` jsonb.
