import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { computeStatus, STAGES, type Stage, type Status } from "@/lib/status";
import { StageBadge } from "@/components/StageBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, Trash2, Loader2 } from "lucide-react";
import { NewFieldDialog } from "@/components/NewFieldDialog";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_app/fields")({
  component: FieldsPage,
});

interface FieldRow {
  id: string;
  name: string;
  crop_type: string;
  location: string | null;
  stage: Stage;
  planting_date: string;
  last_updated_at: string;
  assigned_to: string | null;
}

function FieldsPage() {
  const { role } = useAuth();
  const [rows, setRows] = useState<FieldRow[] | null>(null);
  const [agents, setAgents] = useState<Record<string, string>>({});
  const [q, setQ] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<FieldRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("fields")
      .select("id, name, crop_type, location, stage, planting_date, last_updated_at, assigned_to")
      .order("created_at", { ascending: false });
    setRows((data as FieldRow[]) ?? []);
    const { data: profs } = await supabase.from("profiles").select("id, full_name");
    const m: Record<string, string> = {};
    (profs ?? []).forEach((p) => (m[p.id] = p.full_name));
    setAgents(m);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    const { error } = await supabase.from("fields").delete().eq("id", pendingDelete.id);
    setDeleting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`"${pendingDelete.name}" deleted`);
    setPendingDelete(null);
    load();
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!rows) return [];
    return rows
      .map((r) => ({ ...r, status: computeStatus(r.stage, r.planting_date, r.last_updated_at) }))
      .filter((r) => {
        if (stageFilter !== "all" && r.stage !== stageFilter) return false;
        if (statusFilter !== "all" && r.status !== statusFilter) return false;
        if (q) {
          const needle = q.toLowerCase();
          const agentName = r.assigned_to ? (agents[r.assigned_to] ?? "").toLowerCase() : "";
          if (
            !r.name.toLowerCase().includes(needle) &&
            !r.crop_type.toLowerCase().includes(needle) &&
            !(r.location ?? "").toLowerCase().includes(needle) &&
            !agentName.includes(needle)
          )
            return false;
        }
        return true;
      });
  }, [rows, q, stageFilter, statusFilter, agents]);

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fields</h1>
          <p className="text-muted-foreground mt-1">
            {role === "admin" ? "Manage and assign all fields." : "Your assigned fields."}
          </p>
        </div>
        {role === "admin" && (
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> New field
          </Button>
        )}
      </header>

      <Card>
        <CardContent className="p-4 flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={role === "admin" ? "Search by name, crop, location, agent..." : "Search by name, crop, location..."}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Stage" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stages</SelectItem>
              {STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="At Risk">At Risk</SelectItem>
              <SelectItem value="Completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {!rows ? (
            <div className="p-6 space-y-3">
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              No fields match your filters.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr className="text-left">
                  <th className="p-4 font-medium">Field</th>
                  <th className="p-4 font-medium">Crop</th>
                  <th className="p-4 font-medium">Stage</th>
                  <th className="p-4 font-medium">Status</th>
                  {role === "admin" && <th className="p-4 font-medium">Agent</th>}
                  <th className="p-4 font-medium">Planted</th>
                  <th className="p-4 font-medium">Updated</th>
                  {role === "admin" && <th className="p-4 font-medium w-12"></th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-t hover:bg-muted/30 transition-colors">
                    <td className="p-4">
                      <Link to="/fields/$id" params={{ id: r.id }} className="font-medium hover:text-primary">
                        {r.name}
                      </Link>
                      {r.location && (
                        <div className="text-xs text-muted-foreground">{r.location}</div>
                      )}
                    </td>
                    <td className="p-4">{r.crop_type}</td>
                    <td className="p-4"><StageBadge stage={r.stage} /></td>
                    <td className="p-4"><StatusBadge status={r.status as Status} /></td>
                    {role === "admin" && (
                      <td className="p-4 text-muted-foreground">
                        {r.assigned_to ? agents[r.assigned_to] ?? "—" : "Unassigned"}
                      </td>
                    )}
                    <td className="p-4 text-muted-foreground">{format(new Date(r.planting_date), "PP")}</td>
                    <td className="p-4 text-muted-foreground">{format(new Date(r.last_updated_at), "PP")}</td>
                    {role === "admin" && (
                      <td className="p-4 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={(e) => {
                            e.preventDefault();
                            setPendingDelete(r);
                          }}
                          aria-label={`Delete ${r.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <NewFieldDialog open={open} onOpenChange={setOpen} onCreated={load} />
    </div>
  );
}
