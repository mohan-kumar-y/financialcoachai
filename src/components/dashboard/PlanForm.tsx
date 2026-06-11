import { type PlanInputs, type Currency } from "@/lib/finance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Save, SlidersHorizontal } from "lucide-react";

export function PlanForm({
  inputs,
  onChange,
  onSave,
  saving,
  dirty,
}: {
  inputs: PlanInputs;
  onChange: (patch: Partial<PlanInputs>) => void;
  onSave: () => void;
  saving: boolean;
  dirty: boolean;
}) {
  const num = (v: string) => (v === "" ? 0 : Math.max(0, Number(v)));
  return (
    <Card className="shadow-soft">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SlidersHorizontal className="h-5 w-5 text-primary" />
          Your numbers
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Enter your details — the whole plan recalculates instantly.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Currency</Label>
          <Select
            value={inputs.currency}
            onValueChange={(v) => onChange({ currency: v as Currency })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="INR">₹ INR</SelectItem>
              <SelectItem value="USD">$ USD</SelectItem>
              <SelectItem value="EUR">€ EUR</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Field
          label="Annual in-hand salary"
          value={inputs.annualSalary}
          onChange={(v) => onChange({ annualSalary: num(v) })}
        />
        <Field
          label="Monthly expenses"
          hint="Leave 0 to auto-estimate from your Needs budget."
          value={inputs.monthlyExpenses}
          onChange={(v) => onChange({ monthlyExpenses: num(v) })}
        />
        <Field
          label="Current monthly SIP"
          value={inputs.currentSip}
          onChange={(v) => onChange({ currentSip: num(v) })}
        />

        <div className="grid grid-cols-3 gap-3">
          <Field
            label="Emergency (months)"
            value={inputs.emergencyMonths}
            onChange={(v) => onChange({ emergencyMonths: Math.min(36, Math.round(num(v))) })}
            small
          />
          <Field
            label="Increment %/yr"
            value={inputs.annualIncrementPct}
            onChange={(v) => onChange({ annualIncrementPct: Math.min(100, num(v)) })}
            small
          />
          <Field
            label="SIP step-up %"
            value={inputs.sipStepUpPct}
            onChange={(v) => onChange({ sipStepUpPct: Math.min(100, num(v)) })}
            small
          />
        </div>

        <Button onClick={onSave} disabled={saving} className="w-full">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {dirty ? "Save plan" : "Saved"}
        </Button>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  value,
  onChange,
  hint,
  small,
}: {
  label: string;
  value: number;
  onChange: (v: string) => void;
  hint?: string;
  small?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label className={small ? "text-xs" : ""}>{label}</Label>
      <Input
        type="number"
        min={0}
        value={value === 0 ? "" : value}
        placeholder="0"
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
