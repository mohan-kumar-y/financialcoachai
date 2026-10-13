import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppNav } from "@/components/app-nav";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { getPreferences, upsertPreferences, type Preferences, type RiskTolerance } from "@/lib/preferences.functions";

const SECTORS = [
  "Banking", "IT", "FMCG", "Pharma", "Auto", "Energy", "Metals",
  "Infrastructure", "Telecom", "Consumer Durables", "Financial Services", "Realty",
];

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — WealthOS" },
      { name: "description", content: "Set your risk tolerance, preferred sectors and notification choices." },
      { property: "og:title", content: "Settings — WealthOS" },
      { property: "og:description", content: "Set your risk tolerance, preferred sectors and notification choices." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const fetchPrefs = useServerFn(getPreferences);
  const save = useServerFn(upsertPreferences);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["preferences"], queryFn: () => fetchPrefs() });
  const [form, setForm] = useState<Preferences | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data && !form) setForm(data.preferences);
  }, [data, form]);

  const onSave = async () => {
    if (!form) return;
    setSaving(true);
    try {
      await save({ data: { ...form, email_address: form.email_address?.trim() || null } });
      await qc.invalidateQueries({ queryKey: ["preferences"] });
      toast.success("Preferences saved");
    } catch (e) {
      toast.error((e as Error).message.includes("email") ? "Please enter a valid email address" : "Could not save preferences");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppNav />
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <h1 className="font-display text-3xl font-bold text-foreground">Settings</h1>
        {isLoading || !form ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Investing profile</CardTitle>
                <CardDescription>Used to check whether your portfolio matches how much risk you want.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label>Risk tolerance</Label>
                  <Select
                    value={form.risk_tolerance ?? ""}
                    onValueChange={(v) => setForm({ ...form, risk_tolerance: v as RiskTolerance })}
                  >
                    <SelectTrigger><SelectValue placeholder="Not set" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CONSERVATIVE">Conservative</SelectItem>
                      <SelectItem value="MODERATE">Moderate</SelectItem>
                      <SelectItem value="AGGRESSIVE">Aggressive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Preferred sectors</Label>
                  <ToggleGroup
                    type="multiple"
                    variant="outline"
                    className="flex flex-wrap justify-start gap-2"
                    value={form.preferred_sectors}
                    onValueChange={(v) => setForm({ ...form, preferred_sectors: v })}
                  >
                    {SECTORS.map((s) => (
                      <ToggleGroupItem key={s} value={s} size="sm">{s}</ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Notifications</CardTitle>
                <CardDescription>In-app notifications are always on. Push notifications aren't available yet.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="notify-email">Email notifications</Label>
                  <Switch id="notify-email" checked={form.notify_email} onCheckedChange={(v) => setForm({ ...form, notify_email: v })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={form.email_address ?? ""}
                    onChange={(e) => setForm({ ...form, email_address: e.target.value })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="notify-push">Push notifications</Label>
                    <p className="text-xs text-muted-foreground">Saved for later — not delivered yet.</p>
                  </div>
                  <Switch id="notify-push" checked={form.notify_push} onCheckedChange={(v) => setForm({ ...form, notify_push: v })} />
                </div>
              </CardContent>
            </Card>

            <Button onClick={onSave} disabled={saving}>{saving ? "Saving…" : "Save preferences"}</Button>
          </>
        )}
      </main>
    </div>
  );
}
