import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

interface Agent {
  id: string;
  full_name: string;
}

export function NewFieldDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const { user } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    crop_type: "",
    location: "",
    size_hectares: "",
    planting_date: new Date().toISOString().slice(0, 10),
    assigned_to: "",
    latitude: "",
    longitude: "",
  });

  useEffect(() => {
    if (!open) return;
    (async () => {
      // Fetch field_agent users via user_roles join
      const { data } = await supabase
        .from("user_roles")
        .select("user_id, profiles:user_id(id, full_name)")
        .eq("role", "field_agent");
      const list: Agent[] = (data ?? [])
        .map((r) => (r.profiles as unknown as Agent))
        .filter(Boolean);
      setAgents(list);
    })();
  }, [open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.from("fields").insert({
      name: form.name.trim(),
      crop_type: form.crop_type.trim(),
      location: form.location.trim() || null,
      size_hectares: form.size_hectares ? Number(form.size_hectares) : null,
      planting_date: form.planting_date,
      assigned_to: form.assigned_to || null,
      created_by: user?.id ?? null,
      stage: "Planted",
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Field created");
    onOpenChange(false);
    setForm({
      name: "",
      crop_type: "",
      location: "",
      size_hectares: "",
      planting_date: new Date().toISOString().slice(0, 10),
      assigned_to: "",
    });
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New field</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="crop">Crop type</Label>
              <Input id="crop" required value={form.crop_type} onChange={(e) => setForm({ ...form, crop_type: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="size">Size (ha)</Label>
              <Input id="size" type="number" step="0.1" value={form.size_hectares} onChange={(e) => setForm({ ...form, size_hectares: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="loc">Location</Label>
              <Input id="loc" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="planted">Planting date</Label>
              <Input id="planted" type="date" required value={form.planting_date} onChange={(e) => setForm({ ...form, planting_date: e.target.value })} />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Assign to agent</Label>
              <Select value={form.assigned_to} onValueChange={(v) => setForm({ ...form, assigned_to: v })}>
                <SelectTrigger><SelectValue placeholder="Select agent" /></SelectTrigger>
                <SelectContent>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating..." : "Create field"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
