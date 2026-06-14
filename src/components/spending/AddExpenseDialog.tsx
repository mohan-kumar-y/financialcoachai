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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EXPENSE_CATEGORIES,
  CATEGORY_META,
  SUBCATEGORIES,
  PAYMENT_METHODS,
  type CategoryKey,
} from "@/lib/spending";
import { cn } from "@/lib/utils";

export interface ExpenseFormValues {
  id?: string;
  amount: number;
  category: CategoryKey;
  subcategory: string;
  expense_date: string;
  payment_method: string;
  notes: string;
}

const todayStr = () => new Date().toISOString().slice(0, 10);

const empty: ExpenseFormValues = {
  amount: 0,
  category: "needs",
  subcategory: "Rent",
  expense_date: todayStr(),
  payment_method: "UPI",
  notes: "",
};

export function AddExpenseDialog({
  open,
  onOpenChange,
  onSubmit,
  saving,
  initial,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (values: ExpenseFormValues) => void;
  saving: boolean;
  initial?: ExpenseFormValues | null;
}) {
  const [form, setForm] = useState<ExpenseFormValues>(empty);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setForm(initial ?? { ...empty, expense_date: todayStr() });
      setError("");
    }
  }, [open, initial]);

  const setCategory = (category: CategoryKey) =>
    setForm((f) => ({ ...f, category, subcategory: SUBCATEGORIES[category][0] }));

  const submit = () => {
    if (!form.amount || form.amount <= 0) return setError("Enter a valid amount.");
    if (!form.expense_date) return setError("Pick a date.");
    onSubmit(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial?.id ? "Edit expense" : "Add expense"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Amount (₹)</Label>
              <Input
                type="number"
                min={0}
                value={form.amount || ""}
                onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                placeholder="0"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={form.expense_date}
                onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <div className="flex flex-wrap gap-2">
              {EXPENSE_CATEGORIES.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setCategory(k)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                    form.category === k
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-accent",
                  )}
                >
                  {CATEGORY_META[k].emoji} {CATEGORY_META[k].label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Subcategory</Label>
              <Select
                value={form.subcategory}
                onValueChange={(v) => setForm({ ...form, subcategory: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUBCATEGORIES[form.category].map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Payment method</Label>
              <Select
                value={form.payment_method}
                onValueChange={(v) => setForm({ ...form, payment_method: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="e.g. Amazon order, monthly SIP…"
              rows={2}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Saving…" : initial?.id ? "Save changes" : "Add expense"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
