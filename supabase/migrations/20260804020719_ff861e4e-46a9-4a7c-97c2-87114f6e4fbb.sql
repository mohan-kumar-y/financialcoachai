create table public.brain_runs (
  id uuid primary key default gen_random_uuid(),
  correlation_id uuid not null unique,
  user_id uuid references auth.users(id) on delete cascade,
  request_text text,
  trigger_type text not null,
  plan jsonb,
  capability_calls jsonb,
  iterations int not null default 0,
  model text not null,
  prompt_version text not null,
  latency_ms int,
  token_cost numeric,
  created_at timestamptz not null default now()
);
create index brain_runs_user_created_idx on public.brain_runs (user_id, created_at desc);

create table public.decisions (
  id uuid primary key default gen_random_uuid(),
  correlation_id uuid not null references public.brain_runs(correlation_id) on delete cascade,
  instrument text,
  strategy text,
  action text not null,
  confidence numeric not null default 0,
  thesis text,
  counter_thesis text,
  supporting_evidence_ids uuid[] default '{}',
  contradicting_evidence_ids uuid[] default '{}',
  risks text[] default '{}',
  invalidation_conditions text[] default '{}',
  missing_evidence text[] default '{}',
  time_horizon text,
  monitoring_plan text,
  execution_proposal jsonb,
  brain_version text,
  validation_result text,
  created_at timestamptz not null default now()
);
create index decisions_correlation_idx on public.decisions (correlation_id);

create table public.explanations (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references public.decisions(id) on delete cascade,
  what_happened text,
  why_it_matters text,
  evidence text[] default '{}',
  thesis text,
  counter_thesis text,
  portfolio_impact text,
  recommendation text,
  risks text[] default '{}',
  counter_arguments text[] default '{}',
  what_would_change_view text[] default '{}',
  action text,
  confidence numeric,
  created_at timestamptz not null default now()
);
create index explanations_decision_idx on public.explanations (decision_id);

grant select on public.brain_runs to authenticated;
grant select on public.decisions to authenticated;
grant select on public.explanations to authenticated;
grant all on public.brain_runs to service_role;
grant all on public.decisions to service_role;
grant all on public.explanations to service_role;

alter table public.brain_runs enable row level security;
alter table public.decisions enable row level security;
alter table public.explanations enable row level security;

create policy "Users can view their own brain runs"
  on public.brain_runs for select to authenticated
  using (auth.uid() = user_id);

create policy "Users can view decisions from their own runs"
  on public.decisions for select to authenticated
  using (exists (
    select 1 from public.brain_runs r
    where r.correlation_id = decisions.correlation_id and r.user_id = auth.uid()
  ));

create policy "Users can view explanations for their own decisions"
  on public.explanations for select to authenticated
  using (exists (
    select 1 from public.decisions d
    join public.brain_runs r on r.correlation_id = d.correlation_id
    where d.id = explanations.decision_id and r.user_id = auth.uid()
  ));