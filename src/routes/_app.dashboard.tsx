import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Sprout, Activity, AlertTriangle, CheckCircle2, ArrowRight, TrendingUp, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { computeStatus, STAGES, type Stage, type Status } from "@/lib/status";
import { StatusBadge } from "@/components/StatusBadge";
import { StageBadge } from "@/components/StageBadge";
import { format } from "date-fns";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";

export const Route = createFileRoute("/_app/dashboard")({
  component: DashboardPage,
});

interface FieldRow {
  id: string;
  name: string;
  crop_type: string;
  stage: Stage;
  planting_date: string;
  last_updated_at: string;
  assigned_to: string | null;
}

interface UpdateRow {
  id: string;
  created_at: string;
  note: string;
  new_stage: Stage | null;
  field_id: string;
  author_id: string;
  fields: { name: string } | null;
  profiles: { full_name: string } | null;
}

const STATUS_COLORS: Record<Status, string> = {
  Active: "oklch(0.6 0.15 150)",
  "At Risk": "oklch(0.75 0.16 70)",
  Completed: "oklch(0.65 0.02 150)",
};

function DashboardPage() {
  const { role, fullName } = useAuth();
  const [fields, setFields] = useState<FieldRow[] | null>(null);
  const [updates, setUpdates] = useState<UpdateRow[] | null>(null);
  const [agentMap, setAgentMap] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const { data: f } = await supabase
        .from("fields")
        .select("id, name, crop_type, stage, planting_date, last_updated_at, assigned_to")
        .order("last_updated_at", { ascending: false });
      setFields((f as FieldRow[]) ?? []);

      const { data: u } = await supabase
        .from("field_updates")
        .select("id, created_at, note, new_stage, field_id, author_id, fields(name), profiles:author_id(full_name)")
        .order("created_at", { ascending: false })
        .limit(8);
      setUpdates((u as unknown as UpdateRow[]) ?? []);

      const { data: profs } = await supabase.from("profiles").select("id, full_name");
      const map: Record<string, string> = {};
      (profs ?? []).forEach((p) => (map[p.id] = p.full_name));
      setAgentMap(map);
    })();
  }, []);

  if (!fields || !updates) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const enriched = fields.map((f) => ({
    ...f,
    status: computeStatus(f.stage, f.planting_date, f.last_updated_at),
  }));

  const total = enriched.length;
  const counts: Record<Status, number> = {
    Active: enriched.filter((f) => f.status === "Active").length,
    "At Risk": enriched.filter((f) => f.status === "At Risk").length,
    Completed: enriched.filter((f) => f.status === "Completed").length,
  };

  const pieData = (Object.entries(counts) as [Status, number][])
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }));

  // Insight: at-risk grouped by agent (admin only)
  const atRiskByAgent = enriched
    .filter((f) => f.status === "At Risk" && f.assigned_to)
    .reduce<Record<string, number>>((acc, f) => {
      const k = f.assigned_to as string;
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {});

  // Stage breakdown counts
  const stageCounts: Record<Stage, number> = {
    Planted: 0,
    Growing: 0,
    Ready: 0,
    Harvested: 0,
  };
  enriched.forEach((f) => {
    stageCounts[f.stage] = (stageCounts[f.stage] ?? 0) + 1;
  });
  const topStage = STAGES.reduce((a, b) => (stageCounts[a] >= stageCounts[b] ? a : b));

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome{fullName ? `, ${fullName.split(" ")[0]}` : ""}
          </h1>
          <p className="text-muted-foreground mt-1">
            {role === "admin"
              ? "Overview of all monitored fields across your agents."
              : "Overview of fields assigned to you."}
          </p>
        </div>
        <Link
          to="/fields"
          className="text-sm text-primary inline-flex items-center gap-1 hover:underline"
        >
          View all fields <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <StatCard
          label="Total fields"
          value={total}
          icon={Sprout}
          accent="primary"
          sublabel={role === "admin" ? "across all agents" : "assigned to you"}
        />
        <StatCard
          label="Active"
          value={counts.Active}
          icon={Activity}
          accent="success"
          sublabel="progressing normally"
        />
        <StatCard
          label="At risk"
          value={counts["At Risk"]}
          icon={AlertTriangle}
          accent="warning"
          sublabel="need attention"
        />
        <StatCard
          label="Completed"
          value={counts.Completed}
          icon={CheckCircle2}
          accent="muted"
          sublabel="harvested this season"
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Status breakdown</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {pieData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                No fields yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                    {pieData.map((d) => (
                      <Cell key={d.name} fill={STATUS_COLORS[d.name as Status]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent updates</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {updates.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">No updates yet.</div>
            ) : (
              <ul className="divide-y">
                {updates.map((u) => (
                  <li key={u.id} className="px-6 py-4 flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          to="/fields/$id"
                          params={{ id: u.field_id }}
                          className="font-medium hover:text-primary truncate"
                        >
                          {u.fields?.name ?? "Field"}
                        </Link>
                        {u.new_stage && <StageBadge stage={u.new_stage} />}
                      </div>
                      {u.note && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{u.note}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {u.profiles?.full_name ?? "—"} · {format(new Date(u.created_at), "PP p")}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-primary" />
              Stage breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {STAGES.map((stage) => {
              const count = stageCounts[stage] ?? 0;
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <div key={stage}>
                  <div className="flex items-center justify-between mb-1.5">
                    <StageBadge stage={stage} />
                    <span className="text-sm font-semibold tabular-nums">{count}</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary/70 transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertCircle className="h-4 w-4 text-warning-foreground" />
              Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {counts["At Risk"] > 0 ? (
              <div className="rounded-lg border border-warning/30 bg-warning/10 p-3">
                <p className="text-sm font-medium">
                  ⚠ {counts["At Risk"]} field{counts["At Risk"] > 1 ? "s" : ""} at risk
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Overdue (&gt;100 days), stale (&gt;10 days), or extreme rainfall conditions detected.
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-success/30 bg-success/10 p-3">
                <p className="text-sm font-medium text-success">✓ All fields on track</p>
                <p className="text-xs text-muted-foreground mt-1">
                  No at-risk fields right now. Keep the updates flowing.
                </p>
              </div>
            )}

            {total > 0 && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                <p className="text-sm font-medium">📊 Most fields: {topStage}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stageCounts[topStage]} of {total} fields are in this stage.
                </p>
              </div>
            )}

            <div className="rounded-lg border bg-muted/40 p-3">
              <p className="text-sm font-medium">🌱 Season overview</p>
              <p className="text-xs text-muted-foreground mt-1">
                {counts.Completed > 0
                  ? `${counts.Completed} harvest${counts.Completed > 1 ? "s" : ""} completed this season.`
                  : "No harvests completed yet this season."}
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      {role === "admin" && Object.keys(atRiskByAgent).length > 0 && (
        <section>
          <Card>
            <CardHeader>
              <CardTitle>Insight — Fields at risk by agent</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {Object.entries(atRiskByAgent).map(([uid, n]) => (
                  <li
                    key={uid}
                    className="flex items-center justify-between text-sm border-b last:border-0 pb-2 last:pb-0"
                  >
                    <span className="font-medium">{agentMap[uid] ?? uid.slice(0, 8)}</span>
                    <StatusBadge status="At Risk" />
                    <span className="text-muted-foreground">{n} field{n > 1 ? "s" : ""}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
  sublabel,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  accent: "primary" | "success" | "warning" | "muted";
  sublabel?: string;
}) {
  const tone = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/15 text-success",
    warning: "bg-warning/15 text-warning-foreground",
    muted: "bg-muted text-muted-foreground",
  }[accent];
  return (
    <Card>
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`h-11 w-11 rounded-lg flex items-center justify-center ${tone}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-2xl font-semibold tracking-tight">{value}</div>
          <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
          {sublabel && (
            <div className="text-[11px] text-muted-foreground/70 mt-0.5 truncate">{sublabel}</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
