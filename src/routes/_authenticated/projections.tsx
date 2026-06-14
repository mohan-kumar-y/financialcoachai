import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppNav } from "@/components/app-nav";
import { Button } from "@/components/ui/button";
import { getMyPlan } from "@/lib/plan.functions";
import { DEFAULT_INPUTS, getTier, type PlanInputs } from "@/lib/finance";
import { ProjectionSection, MilestonesSection } from "@/components/dashboard/PlanSections";
import { Loader2, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/projections")({
  component: ProjectionsPage,
});

function ProjectionsPage() {
  const fetchPlan = useServerFn(getMyPlan);
  const { data, isLoading } = useQuery({ queryKey: ["my-plan"], queryFn: () => fetchPlan() });

  const [inputs, setInputs] = useState<PlanInputs>(DEFAULT_INPUTS);
  const hydrated = useRef(false);

  useEffect(() => {
    if (data?.plan && !hydrated.current) {
      hydrated.current = true;
      const { checklist: _cl, ...rest } = data.plan;
      setInputs(rest);
    }
  }, [data]);

  const tier = useMemo(() => getTier(inputs.annualSalary, inputs.currency), [inputs]);

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
            <h1 className="font-display text-2xl font-bold sm:text-3xl">Wealth Projections</h1>
            <p className="mt-1 text-muted-foreground">
              Step-up SIP growth, corpus targets and FIRE milestones · {tier.name} tier
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/blueprints">
              Edit blueprint <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        <ProjectionSection inputs={inputs} currency={inputs.currency} />
        <MilestonesSection inputs={inputs} currency={inputs.currency} />
      </main>
    </div>
  );
}
