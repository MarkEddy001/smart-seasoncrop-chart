import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { computeStatus, STAGES, type Stage } from "@/lib/status";
import { fetchFieldWeather, type FieldWeather } from "@/lib/weather";
import { StageBadge } from "@/components/StageBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { WeatherCard } from "@/components/WeatherCard";
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
import { ArrowLeft, Loader2, ImagePlus, X } from "lucide-react";
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
  latitude: number | null;
  longitude: number | null;
  recent_rainfall_mm: number | null;
  pending_harvest_at: string | null;
}
interface UpdateRow {
  id: string;
  created_at: string;
  note: string;
  new_stage: Stage | null;
  previous_stage: Stage | null;
  author_id: string;
  photo_urls: string[];
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
  const [photos, setPhotos] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [weather, setWeather] = useState<FieldWeather | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    // Run field + updates queries in parallel
    const [{ data: fieldData }, { data: u }] = await Promise.all([
      supabase.from("fields").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("field_updates")
        .select("id, created_at, note, new_stage, previous_stage, author_id, photo_urls, profiles:author_id(full_name)")
        .eq("field_id", id)
        .order("created_at", { ascending: false }),
    ]);

    setField(fieldData as FieldRow | null);
    if (fieldData) setStage(fieldData.stage as Stage);
    setUpdates((u as unknown as UpdateRow[]) ?? []);

    if (fieldData?.assigned_to) {
      const { data: p } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", fieldData.assigned_to)
        .maybeSingle();
      setAgentName(p?.full_name ?? "");
    } else setAgentName("");
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Fetch weather whenever we have coordinates
  useEffect(() => {
    if (!field?.latitude || !field?.longitude) return;
    const ctrl = new AbortController();
    setWeatherLoading(true);
    setWeatherError(null);
    fetchFieldWeather(field.latitude, field.longitude, ctrl.signal)
      .then(async (w) => {
        setWeather(w);
        // Cache rainfall on the field (best-effort, requires update permission)
        if (field.recent_rainfall_mm !== w.rainfall7dMm) {
          await supabase
            .from("fields")
            .update({ recent_rainfall_mm: w.rainfall7dMm })
            .eq("id", field.id);
        }
      })
      .catch((e) => {
        if (e.name !== "AbortError") setWeatherError("Weather unavailable");
      })
      .finally(() => setWeatherLoading(false));
    return () => ctrl.abort();
  }, [field?.id, field?.latitude, field?.longitude]);

  const isAdmin = role === "admin";
  const canEdit = !!field && (isAdmin || field.assigned_to === user?.id);
  const pendingHarvest = !!field?.pending_harvest_at && field.stage !== "Harvested";
  // Agents cannot select Harvested — only admins can finalize a harvest
  const availableStages = isAdmin ? STAGES : STAGES.filter((s) => s !== "Harvested");

  const requestHarvest = async () => {
    if (!field || !user) return;
    setSaving(true);
    const { error } = await supabase
      .from("fields")
      .update({ pending_harvest_at: new Date().toISOString() })
      .eq("id", field.id);
    if (!error) {
      await supabase.from("field_updates").insert({
        field_id: field.id,
        author_id: user.id,
        previous_stage: field.stage,
        new_stage: field.stage,
        note: "🌾 Harvest requested — awaiting admin verification.",
        photo_urls: [],
      });
    }
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Harvest request sent to admin");
      load();
    }
  };

  const approveHarvest = async () => {
    if (!field || !user) return;
    setSaving(true);
    const { error } = await supabase
      .from("fields")
      .update({ stage: "Harvested", pending_harvest_at: null })
      .eq("id", field.id);
    if (!error) {
      await supabase.from("field_updates").insert({
        field_id: field.id,
        author_id: user.id,
        previous_stage: field.stage,
        new_stage: "Harvested",
        note: "✅ Harvest approved by admin.",
        photo_urls: [],
      });
    }
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Harvest approved — field marked Completed");
      load();
    }
  };

  const rejectHarvest = async () => {
    if (!field || !user) return;
    setSaving(true);
    const { error } = await supabase
      .from("fields")
      .update({ pending_harvest_at: null })
      .eq("id", field.id);
    if (!error) {
      await supabase.from("field_updates").insert({
        field_id: field.id,
        author_id: user.id,
        previous_stage: field.stage,
        new_stage: field.stage,
        note: "❌ Harvest request rejected by admin — please continue monitoring.",
        photo_urls: [],
      });
    }
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Harvest request rejected");
      load();
    }
  };

  const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length + photos.length > 4) {
      toast.error("Up to 4 photos per update");
      return;
    }
    setPhotos((p) => [...p, ...files]);
    e.target.value = "";
  };

  const removePhoto = (i: number) => setPhotos((p) => p.filter((_, idx) => idx !== i));

  const submitUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!field || !user) return;
    if (stage === field.stage && !note.trim() && photos.length === 0) {
      toast.error("Change the stage, add a note, or attach a photo.");
      return;
    }
    setSaving(true);
    const previous = field.stage;

    // 1. Upload photos
    const photoUrls: string[] = [];
    for (const file of photos) {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${user.id}/${field.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("field-photos")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (upErr) {
        setSaving(false);
        toast.error(`Photo upload failed: ${upErr.message}`);
        return;
      }
      const { data: pub } = supabase.storage.from("field-photos").getPublicUrl(path);
      photoUrls.push(pub.publicUrl);
    }

    // 2. Touch field (stage change or just last_updated_at)
    const { error: upErr } = await supabase.from("fields").update({ stage }).eq("id", field.id);
    if (upErr) {
      setSaving(false);
      toast.error(upErr.message);
      return;
    }

    // 3. Insert update
    const { error: insErr } = await supabase.from("field_updates").insert({
      field_id: field.id,
      author_id: user.id,
      previous_stage: previous,
      new_stage: stage,
      note: note.trim(),
      photo_urls: photoUrls,
    });
    setSaving(false);
    if (insErr) {
      toast.error(insErr.message);
      return;
    }
    toast.success("Update logged");
    setNote("");
    setPhotos([]);
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

  const status = computeStatus(
    field.stage,
    field.planting_date,
    field.last_updated_at,
    weather?.rainfall7dMm ?? field.recent_rainfall_mm,
  );

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
        <div className="flex gap-2 flex-wrap">
          <StageBadge stage={field.stage} />
          <StatusBadge status={status} />
          {pendingHarvest && (
            <span className="inline-flex items-center rounded-md border border-warning/40 bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning-foreground">
              Harvest pending approval
            </span>
          )}
        </div>
      </header>

      {pendingHarvest && (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="p-4 flex items-center justify-between flex-wrap gap-3">
            <div className="text-sm">
              <p className="font-medium">Harvest verification needed</p>
              <p className="text-muted-foreground text-xs mt-0.5">
                The field agent has marked this field ready for harvest on{" "}
                {format(new Date(field.pending_harvest_at!), "PP p")}.
                {isAdmin
                  ? " Approve to mark it Harvested, or reject to keep monitoring."
                  : " An admin will review and confirm shortly."}
              </p>
            </div>
            {isAdmin && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={rejectHarvest} disabled={saving}>
                  Reject
                </Button>
                <Button size="sm" onClick={approveHarvest} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Approve harvest
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader><CardTitle>Details</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row k="Planted" v={format(new Date(field.planting_date), "PPP")} />
              <Row k="Last updated" v={format(new Date(field.last_updated_at), "PPP")} />
              <Row k="Assigned agent" v={agentName || "Unassigned"} />
              <Row k="Created" v={format(new Date(field.created_at), "PP")} />
              {field.latitude != null && field.longitude != null && (
                <Row k="Coordinates" v={`${field.latitude.toFixed(3)}, ${field.longitude.toFixed(3)}`} />
              )}
            </CardContent>
          </Card>

          {field.latitude != null && field.longitude != null ? (
            <WeatherCard weather={weather} loading={weatherLoading} error={weatherError} />
          ) : (
            <Card>
              <CardHeader><CardTitle className="text-base">Weather</CardTitle></CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Add coordinates to this field to see live weather.
              </CardContent>
            </Card>
          )}
        </div>

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
                        {availableStages.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {!isAdmin && (
                      <p className="text-xs text-muted-foreground">
                        Only admins can mark a field as Harvested. Use “Request harvest” when ready.
                      </p>
                    )}
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

                <div className="space-y-2">
                  <Label>Photos (optional, up to 4)</Label>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={onPickFiles}
                  />
                  <div className="flex flex-wrap gap-2">
                    {photos.map((f, i) => (
                      <div key={i} className="relative h-20 w-20 rounded-md overflow-hidden border">
                        <img src={URL.createObjectURL(f)} alt="" className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removePhoto(i)}
                          className="absolute top-1 right-1 bg-background/80 rounded-full p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    {photos.length < 4 && (
                      <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        className="h-20 w-20 rounded-md border border-dashed flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary"
                      >
                        <ImagePlus className="h-5 w-5" />
                      </button>
                    )}
                  </div>
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
                  {u.photo_urls && u.photo_urls.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {u.photo_urls.map((url) => (
                        <a
                          key={url}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="block h-24 w-24 rounded-md overflow-hidden border hover:ring-2 hover:ring-primary transition-all"
                        >
                          <img src={url} alt="Field update" className="h-full w-full object-cover" />
                        </a>
                      ))}
                    </div>
                  )}
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
