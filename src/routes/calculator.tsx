import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Beer, Calculator as CalcIcon, ArrowLeft, Wine } from "lucide-react";
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

export const Route = createFileRoute("/calculator")({
  head: () => ({ meta: [{ title: "Calculator — Personal OS" }] }),
  component: CalculatorPage,
});

type CalcKey = "beer-keg" | "bottle-can";

function CalculatorPage() {
  const [open, setOpen] = useState<null | CalcKey>(null);

  if (open) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
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

function BeerKegCalculator() {
  const [kegL, setKegL] = useState(50);
  const [glassMl, setGlassMl] = useState(425);
  const [kegPrice, setKegPrice] = useState(0);
  const [glassPrice, setGlassPrice] = useState(0);
  const [r, setR] = useState<null | {
    fullGlasses: number;
    theoretical: number;
    leftoverMl: number;
    revenue: number;
    costPerGlass: number;
    profitPerGlass: number;
    totalProfit: number;
    margin: number;
    breakeven: number;
  }>(null);

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
  const reset = () => { setKegL(50); setGlassMl(425); setKegPrice(0); setGlassPrice(0); setR(null); };

  return (
    <Card className="p-6">
      <div className="mb-5">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Beer className="h-5 w-5 text-amber-600" /> Beer Keg Profit Calculator
        </h2>
        <p className="text-sm text-muted-foreground">Default keg size is 50L and default glass size is 425ml.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

      <div className="flex gap-2 mt-5">
        <Button onClick={calc} className="bg-amber-600 hover:bg-amber-700 text-white">Calculate</Button>
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
        Note: This calculates keg-level gross profit only. It does not remove GST, card fees, gas, wastage, line loss, staff costs, or free pours. For real-world planning, allow roughly 3–8% wastage depending on tap setup and staff consistency.
      </div>
    </Card>
  );
}

function BottleCanCalculator() {
  const [pkg, setPkg] = useState<"Bottle" | "Can">("Bottle");
  const [ml, setMl] = useState(330);
  const [units, setUnits] = useState(12);
  const [cartonCost, setCartonCost] = useState(0);
  const [sellPrice, setSellPrice] = useState(0);
  const [wastagePct, setWastagePct] = useState(0);
  const [r, setR] = useState<null | {
    costPerUnit: number;
    profitPerUnit: number;
    marginUnit: number;
    markupUnit: number;
    breakeven: number;
    saleableUnits: number;
    revenue: number;
    profitCarton: number;
    marginCarton: number;
    markupCarton: number;
    totalMl: number;
  }>(null);

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
    setPkg("Bottle"); setMl(330); setUnits(12); setCartonCost(0); setSellPrice(0); setWastagePct(0); setR(null);
  };

  return (
    <Card className="p-6">
      <div className="mb-5">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Wine className="h-5 w-5 text-blue-600" /> Bottle & Can Carton Profit Calculator
        </h2>
        <p className="text-sm text-muted-foreground">
          Cost, selling price, profit, markup, and gross margin for bottled or canned beer.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          <p className="text-xs text-muted-foreground mt-1">Example: 330ml bottle or can.</p>
        </div>
        <div>
          <Label>Units per carton</Label>
          <Input type="number" value={units} onChange={(e) => setUnits(Number(e.target.value))} />
          <p className="text-xs text-muted-foreground mt-1">Example: 12 bottles/cans per carton.</p>
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
          <p className="text-xs text-muted-foreground mt-1">Leave at 0 unless you want to allow for loss, breakage, freebies, etc.</p>
        </div>
      </div>

      <div className="flex gap-2 mt-5">
        <Button onClick={calc} className="bg-blue-600 hover:bg-blue-700 text-white">Calculate</Button>
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
        <strong>Key formulas:</strong>
        <div>Cost per unit = carton cost ÷ units per carton</div>
        <div>Profit per unit = sale price − cost per unit</div>
        <div>Gross margin % = profit ÷ sale price × 100</div>
        <div>Markup % = profit ÷ cost × 100</div>
      </div>

      <div className="mt-3 p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm">
        Note: This is a gross profit calculator. It does not remove GST, card fees, staff wages, breakage, refrigeration, or supplier rebates. Use the wastage field if you want a more conservative real-world result.
      </div>
    </Card>
  );
}

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

const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });
const money = (n: number) => "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
