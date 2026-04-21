import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { AppSidebar } from "@/components/AppSidebar";
import { Loader2, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { session, loading, role, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login" });
  }, [loading, session, navigate]);

  if (loading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Signed in but no role assigned yet → pending approval
  if (!role) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[image:var(--gradient-subtle)] p-6">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <div className="h-12 w-12 mx-auto rounded-full bg-warning/15 text-warning-foreground flex items-center justify-center">
              <Clock className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-semibold">Awaiting approval</h1>
            <p className="text-sm text-muted-foreground">
              Your account was created. A coordinator needs to approve your access before you can
              view fields. You'll get access automatically once they approve your request.
            </p>
            <Button
              variant="outline"
              onClick={async () => {
                await signOut();
                navigate({ to: "/login" });
              }}
            >
              Sign out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-[image:var(--gradient-subtle)]">
      <AppSidebar />
      <main className="flex-1 min-w-0">
        <div className="max-w-7xl mx-auto p-6 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
