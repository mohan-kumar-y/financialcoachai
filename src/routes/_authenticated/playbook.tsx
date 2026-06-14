import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppNav } from "@/components/app-nav";
import { Button } from "@/components/ui/button";
import { getMyPlan, saveMyPlan } from "@/lib/plan.functions";
import { DEFAULT_INPUTS, type PlanInputs } from "@/lib/finance";
import { CheckpointsSection } from "@/components/dashboard/PlanSections";
import { Loader2, Save } from "lucide-react";

export const Route = createFileRoute("/_authenticated/playbook")({
  component: PlaybookPage,
});

function PlaybookPage() {
  const qc = useQueryClient();
  const fetchPlan = useServerFn(getMyPlan);
  const savePlan = useServerFn(saveMyPlan);
  const { data, isLoading } = useQuery({ queryKey: ["my-plan"], queryFn: () => fetchPlan() });

  const [inputs, setInputs] = useState<PlanInputs>(DEFAULT_INPUTS);
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const hydrated = useRef(false);

  useEffect(() => {
    if (data && !hydrated.current) {
      hydrated.current = true;
      if (data.plan) {
        const { checklist: cl, ...rest } = data.plan;
        setInputs(rest);
        setChecklist(cl ?? {});
      }
    }
  }, [data]);

  const toggle = (key: string, value: boolean) => {
    setChecklist((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await savePlan({ data: { ...inputs, checklist } });
      setDirty(false);
      toast.success("Playbook progress saved");
      qc.invalidateQueries({ queryKey: ["my-plan"] });
    } catch {
      toast.error("Could not save.");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <AppNav displayName={data?.displayName ?? undefined} />
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold sm:text-3xl">Money Playbook</h1>
            <p className="mt-1 text-muted-foreground">
              Your monthly, quarterly and yearly money rituals — tick them off as you go.
            </p>
          </div>
          {dirty && (
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save progress"}
            </Button>
          )}
        </div>

        <CheckpointsSection checklist={checklist} onToggle={toggle} />
      </main>
    </div>
  );
}
