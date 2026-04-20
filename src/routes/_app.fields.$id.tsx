import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { computeStatus, STAGES, type Stage } from "@/lib/status";
import { StageBadge } from "@/components/StageBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/fields/$id")({
  component: FieldDetailPage,
});

interface FieldRow {
  id: string;
  name: string;
  crop_type: string;
  location: string | null;
  size_hectares: number | null;
  stage: Stage;
  planting_date: string;
  last_updated_at: string;
  assigned_to: string | null;
  created_at: string;
}
interface UpdateRow {
  id: string;
  created_at: string;
  note: string;
  new_stage: Stage | null;
  previous_stage: Stage | null;
  author_id: string;
  profiles: { full_name: string } | null;
}

function FieldDetailPage() {
  const { id } = useParams({ from: "/_app/fields/$id" });
  const { user, role } = useAuth();
  const [field, setField] = useState<FieldRow | null>(null);
  const [updates, setUpdates] = useState<UpdateRow[]>([]);
  const [agentName, setAgentName] = useState<string>("");
  const [stage, setStage] = useState<Stage>("Planted");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await supabase
      .from("fields")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    setField(data as FieldRow | null);
    if (data) setStage(data.stage as Stage);

    const { data: u } = await supabase
      .from("field_updates")
      .select("id, created_at, note, new_stage, previous_stage, author_id, profiles:author_id(full_name)")
      .eq("field_id", id)
      .order("created_at", { ascending: false });
    setUpdates((u as unknown as UpdateRow[]) ?? []);

    if (data?.assigned_to) {
      const { data: p } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", data.assigned_to)
        .maybeSingle();
      setAgentName(p?.full_name ?? "");
    } else setAgentName("");
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const canEdit = !!field && (role === "admin" || field.assigned_to === user?.id);

  const submitUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!field || !user) return;
    if (stage === field.stage && !note.trim()) {
      toast.error("Change the stage or add a note.");
      return;
    }
    setSaving(true);
    const previous = field.stage;

    if (stage !== previous) {
      const { error: upErr } = await supabase.from("fields").update({ stage }).eq("id", field.id);
      if (upErr) {
        setSaving(false);
        toast.error(upErr.message);
        return;
      }
    } else {
      // touch last_updated_at when only adding a note
      await supabase.from("fields").update({ stage }).eq("id", field.id);
    }

    const { error: insErr } = await supabase.from("field_updates").insert({
      field_id: field.id,
      author_id: user.id,
      previous_stage: previous,
      new_stage: stage,
      note: note.trim(),
    });
    setSaving(false);
    if (insErr) {
      toast.error(insErr.message);
      return;
    }
    toast.success("Update logged");
    setNote("");
    load();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!field) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Field not found or you don't have access.</p>
        <Link to="/fields" className="text-primary text-sm mt-3 inline-block">← Back to fields</Link>
      </div>
    );
  }

  const status = computeStatus(field.stage, field.planting_date, field.last_updated_at);

  return (
    <div className="space-y-6">
      <Link to="/fields" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to fields
      </Link>

      <header className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{field.name}</h1>
          <p className="text-muted-foreground mt-1">
            {field.crop_type}
            {field.location && ` · ${field.location}`}
            {field.size_hectares && ` · ${field.size_hectares} ha`}
          </p>
        </div>
        <div className="flex gap-2">
          <StageBadge stage={field.stage} />
          <StatusBadge status={status} />
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle>Details</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row k="Planted" v={format(new Date(field.planting_date), "PPP")} />
            <Row k="Last updated" v={format(new Date(field.last_updated_at), "PPP")} />
            <Row k="Assigned agent" v={agentName || "Unassigned"} />
            <Row k="Created" v={format(new Date(field.created_at), "PP")} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{canEdit ? "Log an update" : "Updates"}</CardTitle>
          </CardHeader>
          <CardContent>
            {canEdit ? (
              <form onSubmit={submitUpdate} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Stage</Label>
                    <Select value={stage} onValueChange={(v) => setStage(v as Stage)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="note">Note / observation</Label>
                  <Textarea
                    id="note"
                    rows={4}
                    placeholder="What did you see in the field today?"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </div>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Save update
                </Button>
              </form>
            ) : (
              <p className="text-sm text-muted-foreground">View-only access.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>History</CardTitle></CardHeader>
        <CardContent className="p-0">
          {updates.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">No updates yet.</div>
          ) : (
            <ul className="divide-y">
              {updates.map((u) => (
                <li key={u.id} className="p-5">
                  <div className="flex items-center gap-2 flex-wrap">
                    {u.previous_stage && u.new_stage && u.previous_stage !== u.new_stage ? (
                      <span className="text-sm">
                        <StageBadge stage={u.previous_stage} /> <span className="mx-1 text-muted-foreground">→</span>{" "}
                        <StageBadge stage={u.new_stage} />
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Note added</span>
                    )}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {u.profiles?.full_name ?? "—"} · {format(new Date(u.created_at), "PP p")}
                    </span>
                  </div>
                  {u.note && <p className="text-sm mt-2 whitespace-pre-wrap">{u.note}</p>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium text-right">{v}</span>
    </div>
  );
}
