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
  component: LoginPage,
});

function LoginPage() {
  const { signIn, session, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/dashboard" });
  }, [loading, session, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await signIn(email.trim(), password);
    setSubmitting(false);
    if (error) toast.error(error);
    else navigate({ to: "/dashboard" });
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
              <div className="text-xs text-muted-foreground pt-1">
                First time?{" "}
                <Link to="/api/seed" className="text-primary underline">
                  Seed demo data
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
