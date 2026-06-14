import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const expenseInput = z.object({
  amount: z.number().min(0).max(1e10),
  category: z.string().min(1).max(40),
  subcategory: z.string().max(60).nullable().optional(),
  expense_date: z.string().min(8).max(10), // YYYY-MM-DD
  payment_method: z.string().min(1).max(30),
  notes: z.string().max(500).nullable().optional(),
});

const updateInput = expenseInput.extend({ id: z.string().uuid() });

export interface ExpenseRow {
  id: string;
  amount: number;
  category: string;
  subcategory: string | null;
  expense_date: string;
  payment_method: string;
  notes: string | null;
}

export const listExpenses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("expenses")
      .select("id, amount, category, subcategory, expense_date, payment_method, notes")
      .eq("user_id", userId)
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(2000);
    if (error) throw new Error(error.message);
    return {
      expenses: (data ?? []).map((e) => ({ ...e, amount: Number(e.amount) })) as ExpenseRow[],
    };
  });

export const createExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => expenseInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("expenses").insert({
      user_id: userId,
      amount: data.amount,
      category: data.category,
      subcategory: data.subcategory ?? null,
      expense_date: data.expense_date,
      payment_method: data.payment_method,
      notes: data.notes ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => updateInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { id, ...rest } = data;
    const { error } = await supabase
      .from("expenses")
      .update({
        amount: rest.amount,
        category: rest.category,
        subcategory: rest.subcategory ?? null,
        expense_date: rest.expense_date,
        payment_method: rest.payment_method,
        notes: rest.notes ?? null,
      })
      .eq("id", id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("expenses")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const seedDemoExpenses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { count } = await supabase
      .from("expenses")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    if ((count ?? 0) > 0) return { ok: true, seeded: 0 };

    const today = new Date();
    const ym = (monthsAgo: number, day: number) => {
      const d = new Date(today.getFullYear(), today.getMonth() - monthsAgo, day);
      return d.toISOString().slice(0, 10);
    };
    const rows: Array<{
      category: string;
      subcategory: string;
      amount: number;
      payment_method: string;
      notes: string;
      offset: number;
      day: number;
    }> = [
      { category: "needs", subcategory: "Rent", amount: 35000, payment_method: "Bank Transfer", notes: "Apartment rent", offset: 0, day: 2 },
      { category: "needs", subcategory: "Food", amount: 9800, payment_method: "UPI", notes: "Groceries", offset: 0, day: 5 },
      { category: "needs", subcategory: "Utilities", amount: 3200, payment_method: "UPI", notes: "Electricity + internet", offset: 0, day: 7 },
      { category: "needs", subcategory: "Transport", amount: 2500, payment_method: "Credit Card", notes: "Fuel", offset: 0, day: 9 },
      { category: "wants", subcategory: "Dining", amount: 540, payment_method: "UPI", notes: "Swiggy", offset: 0, day: 11 },
      { category: "wants", subcategory: "Shopping", amount: 1299, payment_method: "Credit Card", notes: "Amazon", offset: 0, day: 12 },
      { category: "wants", subcategory: "Subscriptions", amount: 1497, payment_method: "Credit Card", notes: "Netflix + Spotify + iCloud", offset: 0, day: 14 },
      { category: "wants", subcategory: "Entertainment", amount: 2400, payment_method: "Debit Card", notes: "Movie + bowling", offset: 0, day: 16 },
      { category: "investments", subcategory: "Mutual Funds", amount: 20000, payment_method: "Bank Transfer", notes: "Index fund SIP", offset: 0, day: 3 },
      { category: "investments", subcategory: "Stocks", amount: 8000, payment_method: "Bank Transfer", notes: "Bluechip top-up", offset: 0, day: 18 },
      { category: "emergency", subcategory: "Emergency Savings", amount: 6000, payment_method: "Bank Transfer", notes: "Liquid fund", offset: 0, day: 3 },
      { category: "learning", subcategory: "Courses", amount: 2500, payment_method: "Credit Card", notes: "Online course", offset: 0, day: 20 },
      { category: "giving", subcategory: "Donations", amount: 1500, payment_method: "UPI", notes: "Charity", offset: 0, day: 22 },
      // last month
      { category: "needs", subcategory: "Rent", amount: 35000, payment_method: "Bank Transfer", notes: "Apartment rent", offset: 1, day: 2 },
      { category: "needs", subcategory: "Food", amount: 8600, payment_method: "UPI", notes: "Groceries", offset: 1, day: 6 },
      { category: "wants", subcategory: "Dining", amount: 4200, payment_method: "Credit Card", notes: "Restaurants", offset: 1, day: 13 },
      { category: "wants", subcategory: "Travel", amount: 9000, payment_method: "Credit Card", notes: "Weekend trip", offset: 1, day: 19 },
      { category: "investments", subcategory: "Mutual Funds", amount: 18000, payment_method: "Bank Transfer", notes: "Index fund SIP", offset: 1, day: 3 },
      { category: "emergency", subcategory: "Emergency Savings", amount: 6000, payment_method: "Bank Transfer", notes: "Liquid fund", offset: 1, day: 3 },
      { category: "learning", subcategory: "Books", amount: 1200, payment_method: "UPI", notes: "Books", offset: 1, day: 24 },
      // two months ago
      { category: "needs", subcategory: "Rent", amount: 35000, payment_method: "Bank Transfer", notes: "Apartment rent", offset: 2, day: 2 },
      { category: "needs", subcategory: "Food", amount: 9100, payment_method: "UPI", notes: "Groceries", offset: 2, day: 5 },
      { category: "wants", subcategory: "Shopping", amount: 6500, payment_method: "Credit Card", notes: "Festive shopping", offset: 2, day: 15 },
      { category: "investments", subcategory: "Mutual Funds", amount: 18000, payment_method: "Bank Transfer", notes: "Index fund SIP", offset: 2, day: 3 },
      { category: "investments", subcategory: "Gold", amount: 5000, payment_method: "UPI", notes: "Digital gold", offset: 2, day: 21 },
      { category: "emergency", subcategory: "Emergency Savings", amount: 5000, payment_method: "Bank Transfer", notes: "Liquid fund", offset: 2, day: 3 },
    ];
    const { error } = await supabase.from("expenses").insert(
      rows.map((r) => ({
        user_id: userId,
        amount: r.amount,
        category: r.category,
        subcategory: r.subcategory,
        expense_date: ym(r.offset, r.day),
        payment_method: r.payment_method,
        notes: r.notes,
      })),
    );
    if (error) throw new Error(error.message);
    return { ok: true, seeded: rows.length };
  });
