import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Beer, Calculator as CalcIcon, ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/calculator")({
  head: () => ({ meta: [{ title: "Calculator — Personal OS" }] }),
  component: CalculatorPage,
});

function CalculatorPage() {
  const [open, setOpen] = useState<null | "beer-keg">(null);

  if (open === "beer-keg") {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => setOpen(null)} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to calculators
        </Button>
        <BeerKegCalculator />
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
        <button onClick={() => setOpen("beer-keg")} className="text-left">
          <Card className="p-5 hover:shadow-lg transition cursor-pointer h-full">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                <Beer className="h-5 w-5" />
              </div>
              <h3 className="font-semibold">Beer Keg Calculator</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Work out glasses per keg, profit margin and break-even price.
            </p>
          </Card>
        </button>
      </div>
    </div>
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

  const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  const money = (n: number) => "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
