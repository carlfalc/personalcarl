import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Beer, Calculator as CalcIcon, ArrowLeft, Wine, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/calculator")({
  head: () => ({ meta: [{ title: "Calculator — Personal OS" }] }),
  component: CalculatorPage,
});

type CalcKey = "beer-keg" | "bottle-can";

function CalculatorPage() {
  const [open, setOpen] = useState<null | CalcKey>(null);

  if (open) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => setOpen(null)} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to calculators
        </Button>
        {open === "beer-keg" && <BeerKegCalculator />}
        {open === "bottle-can" && <BottleCanCalculator />}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CalcIcon className="h-6 w-6" /> Calculators
        </h1>
        <p className="text-muted-foreground text-sm">Quick tools and calculators.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Tile
          onClick={() => setOpen("beer-keg")}
          icon={<Beer className="h-5 w-5" />}
          iconBg="bg-amber-100 text-amber-700"
          title="Beer Keg Calculator"
          desc="Work out glasses per keg, profit margin and break-even price."
        />
        <Tile
          onClick={() => setOpen("bottle-can")}
          icon={<Wine className="h-5 w-5" />}
          iconBg="bg-blue-100 text-blue-700"
          title="Bottle & Can Calculator"
          desc="Cost, profit, markup and margin for bottled or canned beer cartons."
        />
      </div>
    </div>
  );
}

function Tile({
  onClick,
  icon,
  iconBg,
  title,
  desc,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  desc: string;
}) {
  return (
    <button onClick={onClick} className="text-left">
      <Card className="p-5 hover:shadow-lg transition cursor-pointer h-full">
        <div className="flex items-center gap-3 mb-2">
          <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${iconBg}`}>
            {icon}
          </div>
          <h3 className="font-semibold">{title}</h3>
        </div>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </Card>
    </button>
  );
}

/* ─────────────────────────  KEG  ───────────────────────── */

type KegRow = {
  id: string;
  name: string;
  keg_l: number;
  glass_ml: number;
  keg_price: number;
  glass_price: number;
  full_glasses: number | null;
  revenue: number | null;
  cost_per_glass: number | null;
  profit_per_glass: number | null;
  total_profit: number | null;
  margin: number | null;
  breakeven: number | null;
};

function BeerKegCalculator() {
  const [name, setName] = useState("");
  const [kegL, setKegL] = useState(50);
  const [glassMl, setGlassMl] = useState(425);
  const [kegPrice, setKegPrice] = useState(0);
  const [glassPrice, setGlassPrice] = useState(0);
  const [r, setR] = useState<null | {
    fullGlasses: number; theoretical: number; leftoverMl: number; revenue: number;
    costPerGlass: number; profitPerGlass: number; totalProfit: number; margin: number; breakeven: number;
  }>(null);
  const [rows, setRows] = useState<KegRow[]>([]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("saved_keg_products")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setRows(data as KegRow[]);
  };
  useEffect(() => { load(); }, []);

  const calc = () => {
    const kegMl = kegL * 1000;
    const theoretical = kegMl / glassMl;
    const fullGlasses = Math.floor(theoretical);
    const leftoverMl = kegMl - fullGlasses * glassMl;
    const revenue = fullGlasses * glassPrice;
    const costPerGlass = fullGlasses > 0 ? kegPrice / fullGlasses : 0;
    const profitPerGlass = glassPrice - costPerGlass;
    const totalProfit = revenue - kegPrice;
    const margin = revenue > 0 ? (totalProfit / revenue) * 100 : 0;
    const breakeven = fullGlasses > 0 ? kegPrice / fullGlasses : 0;
    setR({ fullGlasses, theoretical, leftoverMl, revenue, costPerGlass, profitPerGlass, totalProfit, margin, breakeven });
  };
  const reset = () => { setName(""); setKegL(50); setGlassMl(425); setKegPrice(0); setGlassPrice(0); setR(null); };

  const save = async () => {
    if (!r) { toast.error("Press Calculate first"); return; }
    if (!name.trim()) { toast.error("Enter a product name"); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); toast.error("Sign in to save"); return; }
    const { error } = await supabase.from("saved_keg_products").insert({
      user_id: user.id, name: name.trim(),
      keg_l: kegL, glass_ml: glassMl, keg_price: kegPrice, glass_price: glassPrice,
      full_glasses: r.fullGlasses, revenue: r.revenue, cost_per_glass: r.costPerGlass,
      profit_per_glass: r.profitPerGlass, total_profit: r.totalProfit, margin: r.margin, breakeven: r.breakeven,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved");
    await load();
  };

  const remove = async (id: string) => {
    await supabase.from("saved_keg_products").delete().eq("id", id);
    await load();
  };

  const loadIntoForm = (row: KegRow) => {
    setName(row.name); setKegL(Number(row.keg_l)); setGlassMl(Number(row.glass_ml));
    setKegPrice(Number(row.keg_price)); setGlassPrice(Number(row.glass_price));
    setTimeout(calc, 0);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <Card className="p-6">
      <div className="mb-5">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Beer className="h-5 w-5 text-amber-600" /> Beer Keg Profit Calculator
        </h2>
        <p className="text-sm text-muted-foreground mt-2">
          Use this to work out how many glasses you'll get out of a keg, what each glass actually costs you,
          and how much gross profit and margin you'll make at your menu price. Defaults are a 50L keg and a
          425ml glass (standard NZ pint).
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <Label>Product name (for saving)</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Speights Gold 50L" />
        </div>
        <div>
          <Label>Keg size (litres)</Label>
          <Input type="number" value={kegL} onChange={(e) => setKegL(Number(e.target.value))} />
        </div>
        <div>
          <Label>Glass size (ml)</Label>
          <Input type="number" value={glassMl} onChange={(e) => setGlassMl(Number(e.target.value))} />
        </div>
        <div>
          <Label>Keg price / cost</Label>
          <Input type="number" value={kegPrice} onChange={(e) => setKegPrice(Number(e.target.value))} />
        </div>
        <div>
          <Label>Selling price per glass</Label>
          <Input type="number" value={glassPrice} onChange={(e) => setGlassPrice(Number(e.target.value))} />
        </div>
      </div>

      <div className="flex gap-2 mt-5 flex-wrap">
        <Button onClick={calc} className="bg-amber-600 hover:bg-amber-700 text-white">Calculate</Button>
        <Button onClick={save} disabled={!r || saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
          {saving ? "Saving..." : "Save product"}
        </Button>
        <Button variant="secondary" onClick={reset}>Reset defaults</Button>
      </div>

      {r && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
          <Stat name="Full glasses per keg" value={fmt(r.fullGlasses)} />
          <Stat name="Theoretical glasses" value={fmt(r.theoretical)} />
          <Stat name="Leftover beer" value={fmt(r.leftoverMl) + " ml"} />
          <Stat name="Gross revenue" value={money(r.revenue)} />
          <Stat name="Cost per full glass" value={money(r.costPerGlass)} />
          <Stat name="Profit per glass" value={money(r.profitPerGlass)} good={r.profitPerGlass >= 0} />
          <Stat name="Total gross profit" value={money(r.totalProfit)} good={r.totalProfit >= 0} />
          <Stat name="Gross margin" value={fmt(r.margin) + "%"} good={r.margin >= 0} />
          <Stat name="Break-even glass price" value={money(r.breakeven)} />
        </div>
      )}

      <div className="mt-5 p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm">
        <strong>About this calculator:</strong> It estimates the gross profit you'll get from a single keg of beer
        once you've poured it into glasses at your chosen menu price. It does NOT remove GST, card fees, gas,
        line loss, staff costs, or free pours. For real-world planning, allow roughly 3–8% wastage depending on
        tap setup and staff consistency.
      </div>

      <h3 className="text-lg font-bold mt-8 mb-3">Saved keg products</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No saved products yet. Calculate one above and press Save.</p>
      ) : (
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <Th>Product</Th><Th>Keg L</Th><Th>Glass ml</Th><Th>Keg cost</Th><Th>Sell / glass</Th>
                <Th>Glasses</Th><Th>Cost / glass</Th><Th>Profit / glass</Th>
                <Th>Revenue</Th><Th>Total profit</Th><Th>Margin</Th><Th></Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t hover:bg-muted/30 cursor-pointer" onClick={() => loadIntoForm(row)}>
                  <Td><span className="font-medium">{row.name}</span></Td>
                  <Td>{fmt(Number(row.keg_l))}</Td>
                  <Td>{fmt(Number(row.glass_ml))}</Td>
                  <Td>{money(Number(row.keg_price))}</Td>
                  <Td>{money(Number(row.glass_price))}</Td>
                  <Td>{fmt(Number(row.full_glasses ?? 0))}</Td>
                  <Td>{money(Number(row.cost_per_glass ?? 0))}</Td>
                  <Td className={Number(row.profit_per_glass ?? 0) >= 0 ? "text-emerald-700" : "text-red-700"}>{money(Number(row.profit_per_glass ?? 0))}</Td>
                  <Td>{money(Number(row.revenue ?? 0))}</Td>
                  <Td className={Number(row.total_profit ?? 0) >= 0 ? "text-emerald-700" : "text-red-700"}>{money(Number(row.total_profit ?? 0))}</Td>
                  <Td>{fmt(Number(row.margin ?? 0))}%</Td>
                  <Td>
                    <button
                      onClick={(e) => { e.stopPropagation(); remove(row.id); }}
                      className="text-red-600 hover:text-red-800"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-muted-foreground p-2">Tip: click any row to load it back into the calculator and adjust the price.</p>
        </div>
      )}
    </Card>
  );
}

/* ─────────────────────────  BOTTLE / CAN  ───────────────────────── */

type BcRow = {
  id: string;
  name: string;
  package_type: string;
  ml: number;
  units: number;
  carton_cost: number;
  sell_price: number;
  wastage_pct: number;
  cost_per_unit: number | null;
  profit_per_unit: number | null;
  margin_unit: number | null;
  markup_unit: number | null;
  breakeven: number | null;
  saleable_units: number | null;
  revenue: number | null;
  profit_carton: number | null;
  margin_carton: number | null;
  markup_carton: number | null;
  total_ml: number | null;
};

function BottleCanCalculator() {
  const [name, setName] = useState("");
  const [pkg, setPkg] = useState<"Bottle" | "Can">("Bottle");
  const [ml, setMl] = useState(330);
  const [units, setUnits] = useState(12);
  const [cartonCost, setCartonCost] = useState(0);
  const [sellPrice, setSellPrice] = useState(0);
  const [wastagePct, setWastagePct] = useState(0);
  const [r, setR] = useState<null | {
    costPerUnit: number; profitPerUnit: number; marginUnit: number; markupUnit: number;
    breakeven: number; saleableUnits: number; revenue: number; profitCarton: number;
    marginCarton: number; markupCarton: number; totalMl: number;
  }>(null);
  const [rows, setRows] = useState<BcRow[]>([]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("saved_bottle_can_products")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setRows(data as BcRow[]);
  };
  useEffect(() => { load(); }, []);

  const calc = () => {
    const costPerUnit = units > 0 ? cartonCost / units : 0;
    const profitPerUnit = sellPrice - costPerUnit;
    const marginUnit = sellPrice > 0 ? (profitPerUnit / sellPrice) * 100 : 0;
    const markupUnit = costPerUnit > 0 ? (profitPerUnit / costPerUnit) * 100 : 0;
    const breakeven = costPerUnit;
    const saleableUnits = units * (1 - Math.max(0, Math.min(100, wastagePct)) / 100);
    const revenue = saleableUnits * sellPrice;
    const profitCarton = revenue - cartonCost;
    const marginCarton = revenue > 0 ? (profitCarton / revenue) * 100 : 0;
    const markupCarton = cartonCost > 0 ? (profitCarton / cartonCost) * 100 : 0;
    const totalMl = units * ml;
    setR({ costPerUnit, profitPerUnit, marginUnit, markupUnit, breakeven, saleableUnits, revenue, profitCarton, marginCarton, markupCarton, totalMl });
  };
  const reset = () => {
    setName(""); setPkg("Bottle"); setMl(330); setUnits(12); setCartonCost(0); setSellPrice(0); setWastagePct(0); setR(null);
  };

  const save = async () => {
    if (!r) { toast.error("Press Calculate first"); return; }
    if (!name.trim()) { toast.error("Enter a product name"); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); toast.error("Sign in to save"); return; }
    const { error } = await supabase.from("saved_bottle_can_products").insert({
      user_id: user.id, name: name.trim(), package_type: pkg, ml, units,
      carton_cost: cartonCost, sell_price: sellPrice, wastage_pct: wastagePct,
      cost_per_unit: r.costPerUnit, profit_per_unit: r.profitPerUnit, margin_unit: r.marginUnit,
      markup_unit: r.markupUnit, breakeven: r.breakeven, saleable_units: r.saleableUnits,
      revenue: r.revenue, profit_carton: r.profitCarton, margin_carton: r.marginCarton,
      markup_carton: r.markupCarton, total_ml: r.totalMl,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved");
    await load();
  };

  const remove = async (id: string) => {
    await supabase.from("saved_bottle_can_products").delete().eq("id", id);
    await load();
  };

  const loadIntoForm = (row: BcRow) => {
    setName(row.name); setPkg((row.package_type as "Bottle" | "Can") || "Bottle");
    setMl(Number(row.ml)); setUnits(Number(row.units));
    setCartonCost(Number(row.carton_cost)); setSellPrice(Number(row.sell_price));
    setWastagePct(Number(row.wastage_pct));
    setTimeout(calc, 0);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <Card className="p-6">
      <div className="mb-5">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Wine className="h-5 w-5 text-blue-600" /> Bottle & Can Carton Profit Calculator
        </h2>
        <p className="text-sm text-muted-foreground mt-2">
          Use this for bottled and canned beer bought by the carton. Enter the carton cost and your menu price
          per bottle or can, and you'll get cost per unit, profit per unit, gross margin, markup, and the
          break-even sale price. Optional wastage lets you account for breakage, staff comps and freebies.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <Label>Product name (for saving)</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Corona 24 x 330ml" />
        </div>
        <div>
          <Label>Package type</Label>
          <Select value={pkg} onValueChange={(v) => setPkg(v as "Bottle" | "Can")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Bottle">Bottle</SelectItem>
              <SelectItem value="Can">Can</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Millilitres per unit</Label>
          <Input type="number" value={ml} onChange={(e) => setMl(Number(e.target.value))} />
        </div>
        <div>
          <Label>Units per carton</Label>
          <Input type="number" value={units} onChange={(e) => setUnits(Number(e.target.value))} />
        </div>
        <div>
          <Label>Carton purchase price</Label>
          <Input type="number" value={cartonCost} onChange={(e) => setCartonCost(Number(e.target.value))} />
        </div>
        <div>
          <Label>Selling price per {pkg.toLowerCase()}</Label>
          <Input type="number" value={sellPrice} onChange={(e) => setSellPrice(Number(e.target.value))} />
        </div>
        <div>
          <Label>Optional wastage / staff comp %</Label>
          <Input type="number" value={wastagePct} onChange={(e) => setWastagePct(Number(e.target.value))} />
        </div>
      </div>

      <div className="flex gap-2 mt-5 flex-wrap">
        <Button onClick={calc} className="bg-blue-600 hover:bg-blue-700 text-white">Calculate</Button>
        <Button onClick={save} disabled={!r || saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
          {saving ? "Saving..." : "Save product"}
        </Button>
        <Button variant="secondary" onClick={reset}>Reset defaults</Button>
      </div>

      {r && (
        <>
          <h3 className="font-bold mt-6 mb-2">Per {pkg.toLowerCase()}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Stat name="Cost per unit" value={money(r.costPerUnit)} />
            <Stat name="Profit per unit" value={money(r.profitPerUnit)} good={r.profitPerUnit >= 0} />
            <Stat name="Gross margin per unit" value={fmt(r.marginUnit) + "%"} good={r.marginUnit >= 0} />
            <Stat name="Markup on cost" value={fmt(r.markupUnit) + "%"} good={r.markupUnit >= 0} />
            <Stat name="Break-even sale price" value={money(r.breakeven)} />
            <Stat name="Volume per unit" value={fmt(ml) + " ml"} />
          </div>

          <h3 className="font-bold mt-6 mb-2">Per carton</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Stat name="Saleable units after wastage" value={fmt(r.saleableUnits)} />
            <Stat name="Gross revenue per carton" value={money(r.revenue)} />
            <Stat name="Profit per carton" value={money(r.profitCarton)} good={r.profitCarton >= 0} />
            <Stat name="Gross margin per carton" value={fmt(r.marginCarton) + "%"} good={r.marginCarton >= 0} />
            <Stat name="Carton markup on cost" value={fmt(r.markupCarton) + "%"} good={r.markupCarton >= 0} />
            <Stat name="Total carton volume" value={fmt(r.totalMl) + " ml"} />
          </div>
        </>
      )}

      <div className="mt-5 p-4 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 text-sm">
        <strong>About this calculator:</strong> Gross profit only — does not remove GST, card fees, staff wages,
        refrigeration, or supplier rebates. Use the wastage field for a more conservative real-world result.
        <div className="mt-2"><strong>Key formulas:</strong></div>
        <div>Cost per unit = carton cost ÷ units per carton</div>
        <div>Profit per unit = sale price − cost per unit</div>
        <div>Gross margin % = profit ÷ sale price × 100</div>
        <div>Markup % = profit ÷ cost × 100</div>
      </div>

      <h3 className="text-lg font-bold mt-8 mb-3">Saved bottle & can products</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No saved products yet. Calculate one above and press Save.</p>
      ) : (
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <Th>Product</Th><Th>Type</Th><Th>ml</Th><Th>Units</Th>
                <Th>Carton cost</Th><Th>Sell / unit</Th>
                <Th>Cost / unit</Th><Th>Profit / unit</Th><Th>Margin</Th>
                <Th>Revenue / carton</Th><Th>Profit / carton</Th><Th></Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t hover:bg-muted/30 cursor-pointer" onClick={() => loadIntoForm(row)}>
                  <Td><span className="font-medium">{row.name}</span></Td>
                  <Td>{row.package_type}</Td>
                  <Td>{fmt(Number(row.ml))}</Td>
                  <Td>{fmt(Number(row.units))}</Td>
                  <Td>{money(Number(row.carton_cost))}</Td>
                  <Td>{money(Number(row.sell_price))}</Td>
                  <Td>{money(Number(row.cost_per_unit ?? 0))}</Td>
                  <Td className={Number(row.profit_per_unit ?? 0) >= 0 ? "text-emerald-700" : "text-red-700"}>{money(Number(row.profit_per_unit ?? 0))}</Td>
                  <Td>{fmt(Number(row.margin_unit ?? 0))}%</Td>
                  <Td>{money(Number(row.revenue ?? 0))}</Td>
                  <Td className={Number(row.profit_carton ?? 0) >= 0 ? "text-emerald-700" : "text-red-700"}>{money(Number(row.profit_carton ?? 0))}</Td>
                  <Td>
                    <button
                      onClick={(e) => { e.stopPropagation(); remove(row.id); }}
                      className="text-red-600 hover:text-red-800"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-muted-foreground p-2">Tip: click any row to load it back into the calculator and adjust the price.</p>
        </div>
      )}
    </Card>
  );
}

/* ─────────────────────────  shared  ───────────────────────── */

function Stat({ name, value, good }: { name: string; value: string; good?: boolean }) {
  return (
    <div className="rounded-xl border bg-muted/30 p-4">
      <div className="text-xs font-bold text-muted-foreground mb-1">{name}</div>
      <div className={`text-xl font-black ${good === true ? "text-emerald-700" : good === false ? "text-red-700" : ""}`}>
        {value}
      </div>
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="px-3 py-2 font-semibold whitespace-nowrap">{children}</th>;
}
function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 whitespace-nowrap ${className ?? ""}`}>{children}</td>;
}

const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });
const money = (n: number) => "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
