import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { Check, X, UserPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_app/users")({
  component: UsersPage,
});

interface SignupRequest {
  id: string;
  email: string;
  full_name: string;
  requested_role: "admin" | "field_agent";
  status: string;
  created_at: string;
}

interface UserRow {
  id: string;
  email: string;
  full_name: string;
  role: "admin" | "field_agent" | null;
  field_count: number;
}

interface FieldRow {
  id: string;
  name: string;
  crop_type: string;
  assigned_to: string | null;
}

function UsersPage() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState<SignupRequest[] | null>(null);
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [fields, setFields] = useState<FieldRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  useEffect(() => {
    if (role && role !== "admin") navigate({ to: "/dashboard" });
  }, [role, navigate]);

  const load = async () => {
    const [{ data: reqs }, { data: profs }, { data: roles }, { data: fs }] = await Promise.all([
      supabase
        .from("signup_requests")
        .select("id, email, full_name, requested_role, status, created_at")
        .order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, email, full_name"),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("fields").select("id, name, crop_type, assigned_to"),
    ]);

    setRequests((reqs as SignupRequest[]) ?? []);
    const roleMap = new Map<string, "admin" | "field_agent">();
    (roles ?? []).forEach((r) => roleMap.set(r.user_id, r.role));
    const fieldList = (fs as FieldRow[]) ?? [];
    setFields(fieldList);
    const counts = fieldList.reduce<Record<string, number>>((acc, f) => {
      if (f.assigned_to) acc[f.assigned_to] = (acc[f.assigned_to] ?? 0) + 1;
      return acc;
    }, {});
    setUsers(
      (profs ?? []).map((p) => ({
        id: p.id,
        email: p.email,
        full_name: p.full_name,
        role: roleMap.get(p.id) ?? null,
        field_count: counts[p.id] ?? 0,
      })),
    );
  };

  useEffect(() => {
    if (role === "admin") load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  const approve = async (req: SignupRequest) => {
    setBusy(req.id);
    // Mark approved. The user must be created by the user themselves at signup;
    // here we just flag the request so when they log in (via /signup), their auth user
    // will be linked. If a profile already exists for that email, link & assign role now.
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", req.email)
      .maybeSingle();

    if (profile) {
      await supabase
        .from("user_roles")
        .upsert({ user_id: profile.id, role: req.requested_role }, { onConflict: "user_id,role" });
      await supabase
        .from("signup_requests")
        .update({ status: "approved", user_id: profile.id, reviewed_at: new Date().toISOString() })
        .eq("id", req.id);
      toast.success(`${req.email} approved as ${req.requested_role.replace("_", " ")}`);
    } else {
      await supabase
        .from("signup_requests")
        .update({ status: "approved", reviewed_at: new Date().toISOString() })
        .eq("id", req.id);
      toast.success(`Approved. ${req.email} can now sign up & sign in.`);
    }
    setBusy(null);
    load();
  };

  const reject = async (req: SignupRequest) => {
    setBusy(req.id);
    await supabase
      .from("signup_requests")
      .update({ status: "rejected", reviewed_at: new Date().toISOString() })
      .eq("id", req.id);
    toast.success("Request rejected");
    setBusy(null);
    load();
  };

  const reassignField = async (fieldId: string, newAgentId: string) => {
    const { error } = await supabase
      .from("fields")
      .update({ assigned_to: newAgentId === "_unassigned" ? null : newAgentId })
      .eq("id", fieldId);
    if (error) toast.error(error.message);
    else {
      toast.success("Field reassigned");
      load();
    }
  };

  if (role !== "admin") return null;

  const pendingReqs = (requests ?? []).filter((r) => r.status === "pending");
  const agents = (users ?? []).filter((u) => u.role === "field_agent");

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground mt-1">
            Manage agents, approve signup requests, and reassign fields.
          </p>
        </div>
        <Button onClick={() => setInviteOpen(true)}>
          <UserPlus className="h-4 w-4 mr-1" /> Invite agent
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>
            Pending signup requests
            {pendingReqs.length > 0 && (
              <Badge className="ml-2" variant="secondary">{pendingReqs.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!requests ? (
            <div className="p-6"><Skeleton className="h-12" /></div>
          ) : pendingReqs.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">No pending requests.</div>
          ) : (
            <ul className="divide-y">
              {pendingReqs.map((r) => (
                <li key={r.id} className="p-4 flex items-center gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{r.full_name || r.email}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.email} · requested {r.requested_role.replace("_", " ")} ·{" "}
                      {format(new Date(r.created_at), "PP")}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => approve(r)}
                    disabled={busy === r.id}
                  >
                    {busy === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3 mr-1" />}
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => reject(r)}
                    disabled={busy === r.id}
                  >
                    <X className="h-3 w-3 mr-1" /> Reject
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>All users</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {!users ? (
            <div className="p-6 space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr className="text-left">
                  <th className="p-4 font-medium">Name</th>
                  <th className="p-4 font-medium">Email</th>
                  <th className="p-4 font-medium">Role</th>
                  <th className="p-4 font-medium">Fields</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t">
                    <td className="p-4 font-medium">{u.full_name || "—"}</td>
                    <td className="p-4 text-muted-foreground">{u.email}</td>
                    <td className="p-4">
                      {u.role ? (
                        <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                          {u.role.replace("_", " ")}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">no role</span>
                      )}
                    </td>
                    <td className="p-4 text-muted-foreground">{u.field_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Reassign fields</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {!fields ? (
            <div className="p-6 space-y-2">{[0, 1].map((i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : fields.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">No fields yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr className="text-left">
                  <th className="p-4 font-medium">Field</th>
                  <th className="p-4 font-medium">Crop</th>
                  <th className="p-4 font-medium w-64">Assigned to</th>
                </tr>
              </thead>
              <tbody>
                {fields.map((f) => (
                  <tr key={f.id} className="border-t">
                    <td className="p-4 font-medium">{f.name}</td>
                    <td className="p-4 text-muted-foreground">{f.crop_type}</td>
                    <td className="p-4">
                      <Select
                        value={f.assigned_to ?? "_unassigned"}
                        onValueChange={(v) => reassignField(f.id, v)}
                      >
                        <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_unassigned">Unassigned</SelectItem>
                          {agents.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.full_name || a.email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <InviteAgentDialog open={inviteOpen} onOpenChange={setInviteOpen} onDone={load} />
    </div>
  );
}

function InviteAgentDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone: () => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    // Pre-approve a request so when the user signs up they get the role automatically
    const { error } = await supabase.from("signup_requests").upsert(
      {
        email: email.trim().toLowerCase(),
        full_name: name.trim(),
        requested_role: "field_agent",
        status: "approved",
        reviewed_at: new Date().toISOString(),
      },
      { onConflict: "email" },
    );
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Invitation ready. Share /signup with ${email}.`);
    setEmail("");
    setName("");
    onOpenChange(false);
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a field agent</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            We'll pre-approve this email. Share the signup link with them — once they create
            their account, they'll automatically get field agent access.
          </p>
          <div className="space-y-2">
            <Label htmlFor="iname">Full name</Label>
            <Input id="iname" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="iemail">Email</Label>
            <Input id="iemail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Send invite
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
