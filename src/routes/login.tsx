import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Leaf, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>) => ({
    next: typeof s.next === "string" ? s.next : undefined,
  }),
  component: LoginPage,
});

function safeNext(next: string | undefined) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : null;
}

function LoginPage() {
  const { signIn, session, loading } = useAuth();
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const goNext = () => {
    const target = safeNext(next);
    if (target) window.location.href = target;
    else navigate({ to: "/dashboard" });
  };

  useEffect(() => {
    if (!loading && session) goNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, session]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await signIn(email.trim(), password);
    setSubmitting(false);
    if (error) toast.error(error);
    else goNext();
  };


  const fillDemo = (em: string, pw: string) => {
    setEmail(em);
    setPassword(pw);
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
          <h1 className="text-4xl font-bold leading-tight">
            Track every field, every stage, every season.
          </h1>
          <p className="text-primary-foreground/80">
            A clean coordination layer for field agents and crop coordinators — from planting to
            harvest.
          </p>
        </div>
        <div className="text-sm text-primary-foreground/70">© SmartSeason 2026</div>
      </div>

      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md shadow-[var(--shadow-elegant)]">
          <CardContent className="p-8">
            <h2 className="text-2xl font-semibold tracking-tight">Welcome back</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Sign in to your SmartSeason workspace.
            </p>

            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Sign in
              </Button>
            </form>

            <div className="mt-6 rounded-lg border bg-muted/40 p-4 space-y-2 text-sm">
              <div className="font-medium">Demo accounts</div>
              <button
                type="button"
                className="w-full text-left text-xs hover:text-primary"
                onClick={() => fillDemo("admin@smartseason.app", "Admin123!")}
              >
                <span className="font-medium">Admin:</span> admin@smartseason.app / Admin123!
              </button>
              <button
                type="button"
                className="w-full text-left text-xs hover:text-primary"
                onClick={() => fillDemo("agent1@smartseason.app", "Agent123!")}
              >
                <span className="font-medium">Agent 1:</span> agent1@smartseason.app / Agent123!
              </button>
              <button
                type="button"
                className="w-full text-left text-xs hover:text-primary"
                onClick={() => fillDemo("agent2@smartseason.app", "Agent123!")}
              >
                <span className="font-medium">Agent 2:</span> agent2@smartseason.app / Agent123!
              </button>
            </div>

            <p className="text-xs text-center text-muted-foreground mt-6">
              New to SmartSeason?{" "}
              <Link to="/signup" className="text-primary hover:underline">Request access</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
