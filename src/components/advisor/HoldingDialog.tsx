import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { ASSET_TYPES } from "@/lib/advisor";

export interface HoldingFormValues {
  id?: string;
  asset_type: string;
  name: string;
  symbol: string;
  units: number;
  avg_buy_price: number;
  current_price: number;
  category: string;
}

const empty: HoldingFormValues = {
  asset_type: "stock",
  name: "",
  symbol: "",
  units: 0,
  avg_buy_price: 0,
  current_price: 0,
  category: "",
};

export function HoldingDialog({
  open,
  onOpenChange,
  onSubmit,
  saving,
  initial,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (values: HoldingFormValues) => void;
  saving: boolean;
  initial?: HoldingFormValues | null;
}) {
  const [form, setForm] = useState<HoldingFormValues>(empty);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setForm(initial ?? empty);
      setError("");
    }
  }, [open, initial]);

  const submit = () => {
    if (!form.name.trim()) return setError("Enter a name.");
    if (form.units <= 0) return setError("Units must be greater than zero.");
    onSubmit(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial?.id ? "Edit holding" : "Add holding"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Asset type</Label>
              <Select value={form.asset_type} onValueChange={(v) => setForm({ ...form, asset_type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSET_TYPES.map((a) => (
                    <SelectItem key={a.value} value={a.value}>
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Input
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="e.g. Large Cap"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. HDFC Bank"
              />
            </div>
            <div className="space-y-2">
              <Label>Symbol</Label>
              <Input
                value={form.symbol}
                onChange={(e) => setForm({ ...form, symbol: e.target.value })}
                placeholder="e.g. HDFCBANK"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Units</Label>
              <Input
                type="number"
                value={form.units || ""}
                onChange={(e) => setForm({ ...form, units: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Avg buy (₹)</Label>
              <Input
                type="number"
                value={form.avg_buy_price || ""}
                onChange={(e) => setForm({ ...form, avg_buy_price: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Current (₹)</Label>
              <Input
                type="number"
                value={form.current_price || ""}
                onChange={(e) => setForm({ ...form, current_price: Number(e.target.value) })}
              />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Saving…" : initial?.id ? "Save changes" : "Add holding"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
