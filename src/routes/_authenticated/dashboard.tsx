import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getMyPlan, saveMyPlan } from "@/lib/plan.functions";
import { computePlan, DEFAULT_INPUTS, getTier, type PlanInputs } from "@/lib/finance";
import { PlanForm } from "@/components/dashboard/PlanForm";
import {
  AllocationSection,
  RoadmapSection,
  ProjectionSection,
  MilestonesSection,
  ActionsSection,
  CheckpointsSection,
} from "@/components/dashboard/PlanSections";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { LogOut, Loader2, TrendingUp } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchPlan = useServerFn(getMyPlan);
  const savePlan = useServerFn(saveMyPlan);

  const { data, isLoading } = useQuery({
    queryKey: ["my-plan"],
    queryFn: () => fetchPlan(),
  });

  const [inputs, setInputs] = useState<PlanInputs>(DEFAULT_INPUTS);
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const hydrated = useRef(false);

  useEffect(() => {
    if (data && !hydrated.current) {
      hydrated.current = true;
      if (data.plan) {
        const { checklist: cl, ...rest } = data.plan;
        setInputs(rest);
        setChecklist(cl ?? {});
        setDirty(false);
      } else {
        setDirty(true); // brand new user — prompt to save defaults
      }
    }
  }, [data]);

  const plan = useMemo(() => computePlan(inputs), [inputs]);
  const tier = getTier(inputs.annualSalary, inputs.currency);

  const patch = (p: Partial<PlanInputs>) => {
    setInputs((prev) => ({ ...prev, ...p }));
    setDirty(true);
  };

  const toggle = (key: string, value: boolean) => {
    setChecklist((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await savePlan({ data: { ...inputs, checklist } });
      setDirty(false);
      toast.success("Plan saved to your account");
      queryClient.invalidateQueries({ queryKey: ["my-plan"] });
    } catch {
      toast.error("Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
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
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold text-primary">
            <TrendingUp className="h-5 w-5" />
            WealthOS
          </Link>
          <div className="flex items-center gap-3">
            {data?.displayName && (
              <span className="hidden text-sm text-muted-foreground sm:inline">
                Hi, {data.displayName}
              </span>
            )}
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Financial Operating System</h1>
          <p className="mt-1 text-muted-foreground">
            Where, when, and how much to invest — tuned to your income.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <div className="lg:sticky lg:top-20 lg:self-start">
            <PlanForm
              inputs={inputs}
              onChange={patch}
              onSave={handleSave}
              saving={saving}
              dirty={dirty}
            />
          </div>

          <div className="space-y-6">
            <AllocationSection plan={plan} currency={inputs.currency} />
            <ActionsSection plan={plan} inputs={inputs} currency={inputs.currency} />
            <RoadmapSection currency={inputs.currency} activeTierId={tier.id} />
            <ProjectionSection inputs={inputs} currency={inputs.currency} />
            <div className="grid gap-6 lg:grid-cols-2">
              <MilestonesSection inputs={inputs} currency={inputs.currency} />
              <CheckpointsSection checklist={checklist} onToggle={toggle} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
