import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Leaf, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

function SignupPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/dashboard" });
  }, [loading, session, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    setSubmitting(true);
    const cleanEmail = email.trim().toLowerCase();

    // 1. Record (or update) signup request
    const { error: reqErr } = await supabase
      .from("signup_requests")
      .upsert(
        {
          email: cleanEmail,
          full_name: fullName.trim(),
          requested_role: "field_agent",
        },
        { onConflict: "email" },
      );
    if (reqErr) {
      setSubmitting(false);
      toast.error(reqErr.message);
      return;
    }

    // 2. Create the auth user (profile auto-created via trigger)
    const { error: signErr } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: { full_name: fullName.trim() },
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });
    setSubmitting(false);
    if (signErr) {
      // If user already exists, we still recorded their request
      if (signErr.message.toLowerCase().includes("already")) {
        setDone(true);
        return;
      }
      toast.error(signErr.message);
      return;
    }
    setDone(true);
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-[image:var(--gradient-subtle)]">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-[image:var(--gradient-primary)] text-primary-foreground">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-white/15 flex items-center justify-center backdrop-blur-sm">
            <Leaf className="h-6 w-6" />
          </div>
          <span className="text-xl font-semibold tracking-tight">SmartSeason</span>
        </div>
        <div className="space-y-4 max-w-md">
          <h1 className="text-4xl font-bold leading-tight">Join your team's field workspace.</h1>
          <p className="text-primary-foreground/80">
            Request access as a field agent. Your coordinator will approve your account, then
            you can start logging field updates.
          </p>
        </div>
        <div className="text-sm text-primary-foreground/70">© SmartSeason 2026</div>
      </div>

      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md shadow-[var(--shadow-elegant)]">
          <CardContent className="p-8">
            {done ? (
              <div className="space-y-4">
                <h2 className="text-2xl font-semibold tracking-tight">Request submitted</h2>
                <p className="text-sm text-muted-foreground">
                  Your account was created and your access request was sent to the coordinator.
                  You'll be able to see assigned fields once an admin approves your role.
                </p>
                <Button asChild className="w-full">
                  <Link to="/login">Back to sign in</Link>
                </Button>
              </div>
            ) : (
              <>
                <h2 className="text-2xl font-semibold tracking-tight">Request access</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  An admin will approve and assign your role.
                </p>
                <form onSubmit={onSubmit} className="mt-6 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full name</Label>
                    <Input id="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">At least 8 characters.</p>
                  </div>
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Create account
                  </Button>
                </form>
                <p className="text-xs text-center text-muted-foreground mt-6">
                  Already have an account?{" "}
                  <Link to="/login" className="text-primary hover:underline">Sign in</Link>
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
