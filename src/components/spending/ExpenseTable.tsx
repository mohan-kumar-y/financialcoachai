import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  PAYMENT_METHODS,
  type CategoryKey,
} from "@/lib/spending";
import { formatINR } from "@/lib/blueprints";
import type { ExpenseRow } from "@/lib/expenses.functions";
import { Search, Pencil, Trash2, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";

type SortKey = "expense_date" | "amount" | "category";

export function ExpenseTable({
  expenses,
  onEdit,
  onDelete,
}: {
  expenses: ExpenseRow[];
  onEdit: (e: ExpenseRow) => void;
  onDelete: (e: ExpenseRow) => void;
}) {
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [pay, setPay] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("expense_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const pageSize = 8;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const out = expenses.filter((e) => {
      if (cat !== "all" && e.category !== cat) return false;
      if (pay !== "all" && e.payment_method !== pay) return false;
      if (q) {
        const hay = `${e.subcategory ?? ""} ${e.notes ?? ""} ${e.category}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    out.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "amount") cmp = a.amount - b.amount;
      else if (sortKey === "category") cmp = a.category.localeCompare(b.category);
      else cmp = a.expense_date.localeCompare(b.expense_date);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return out;
  }, [expenses, search, cat, pay, sortKey, sortDir]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pages - 1);
  const rows = filtered.slice(safePage * pageSize, safePage * pageSize + pageSize);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
    setPage(0);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Search notes, subcategory…"
            className="pl-9"
          />
        </div>
        <Select
          value={cat}
          onValueChange={(v) => {
            setCat(v);
            setPage(0);
          }}
        >
          <SelectTrigger className="sm:w-40">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {EXPENSE_CATEGORIES.map((k) => (
              <SelectItem key={k} value={k}>
                {CATEGORY_META[k].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={pay}
          onValueChange={(v) => {
            setPay(v);
            setPage(0);
          }}
        >
          <SelectTrigger className="sm:w-40">
            <SelectValue placeholder="Payment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All methods</SelectItem>
            {PAYMENT_METHODS.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border/60">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">
                <button className="flex items-center gap-1" onClick={() => toggleSort("expense_date")}>
                  Date <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="px-4 py-3">
                <button className="flex items-center gap-1" onClick={() => toggleSort("category")}>
                  Category <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="hidden px-4 py-3 sm:table-cell">Subcategory</th>
              <th className="px-4 py-3 text-right">
                <button className="ml-auto flex items-center gap-1" onClick={() => toggleSort("amount")}>
                  Amount <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="hidden px-4 py-3 md:table-cell">Method</th>
              <th className="hidden px-4 py-3 lg:table-cell">Notes</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  No transactions found.
                </td>
              </tr>
            )}
            {rows.map((e) => {
              const meta = CATEGORY_META[e.category as CategoryKey];
              return (
                <tr key={e.id} className="border-t border-border/60 hover:bg-muted/30">
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums text-muted-foreground">
                    {new Date(e.expense_date).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant="secondary"
                      className="font-medium"
                      style={meta ? { background: meta.color + "22", color: meta.color } : undefined}
                    >
                      {meta?.emoji} {meta?.label ?? e.category}
                    </Badge>
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                    {e.subcategory ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">
                    {formatINR(e.amount)}
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                    {e.payment_method}
                  </td>
                  <td className="hidden max-w-[180px] truncate px-4 py-3 text-muted-foreground lg:table-cell">
                    {e.notes ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(e)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => onDelete(e)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {filtered.length} transaction{filtered.length === 1 ? "" : "s"}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={safePage === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span>
            {safePage + 1} / {pages}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={safePage >= pages - 1}
            onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
