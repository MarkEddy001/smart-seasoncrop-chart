import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Idempotent seed endpoint — creates demo users, roles, and sample fields.
 * Visit /api/seed once after first deploy to populate the demo.
 * Safe to call multiple times.
 */
const DEMO_USERS = [
  { email: "admin@smartseason.app", password: "Admin123!", full_name: "Amani Coordinator", role: "admin" as const },
  { email: "agent1@smartseason.app", password: "Agent123!", full_name: "Wanjiku Field", role: "field_agent" as const },
  { email: "agent2@smartseason.app", password: "Agent123!", full_name: "Otieno Mwangi", role: "field_agent" as const },
];

const DEMO_FIELDS = [
  { name: "Kitale North Plot A", crop_type: "Maize", location: "Kitale, Trans-Nzoia", size_hectares: 12.5, daysAgo: 130, stage: "Ready" as const, agent: 0 },
  { name: "Eldoret Greens", crop_type: "Beans", location: "Eldoret, Uasin Gishu", size_hectares: 4.2, daysAgo: 60, stage: "Growing" as const, agent: 0 },
  { name: "Nyeri Hillside Estate", crop_type: "Coffee", location: "Nyeri", size_hectares: 8.0, daysAgo: 250, stage: "Harvested" as const, agent: 0 },
  { name: "Naivasha Lakeview", crop_type: "Tomatoes", location: "Naivasha", size_hectares: 2.1, daysAgo: 35, stage: "Growing" as const, agent: 1 },
  { name: "Meru Highlands", crop_type: "Tea", location: "Meru", size_hectares: 15.0, daysAgo: 110, stage: "Growing" as const, agent: 1 },
  { name: "Kisumu Riverside", crop_type: "Rice", location: "Kisumu", size_hectares: 6.5, daysAgo: 20, stage: "Planted" as const, agent: 1 },
];

async function runSeed() {
  const userIds: Record<string, string> = {};

  for (const u of DEMO_USERS) {
    // Try create; if exists, look up
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: { full_name: u.full_name },
    });
    let id: string | undefined = created?.user?.id;
    if (error || !id) {
      const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
      id = list.users.find((x) => x.email === u.email)?.id;
    }
    if (!id) throw new Error(`Could not provision ${u.email}: ${error?.message}`);
    userIds[u.email] = id;

    await supabaseAdmin.from("profiles").upsert({ id, full_name: u.full_name, email: u.email });
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: id, role: u.role }, { onConflict: "user_id,role" });
  }

  // Only seed fields if none exist
  const { count } = await supabaseAdmin.from("fields").select("*", { count: "exact", head: true });
  if ((count ?? 0) === 0) {
    const adminId = userIds[DEMO_USERS[0].email];
    const agentIds = [userIds[DEMO_USERS[1].email], userIds[DEMO_USERS[2].email]];
    const rows = DEMO_FIELDS.map((f) => {
      const planted = new Date();
      planted.setDate(planted.getDate() - f.daysAgo);
      return {
        name: f.name,
        crop_type: f.crop_type,
        location: f.location,
        size_hectares: f.size_hectares,
        planting_date: planted.toISOString().slice(0, 10),
        stage: f.stage,
        assigned_to: agentIds[f.agent],
        created_by: adminId,
      };
    });
    await supabaseAdmin.from("fields").insert(rows);
  }

  return {
    ok: true,
    users: DEMO_USERS.map(({ email, password, role }) => ({ email, password, role })),
  };
}

export const Route = createFileRoute("/api/seed")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const result = await runSeed();
          return new Response(JSON.stringify(result, null, 2), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          const message = e instanceof Error ? e.message : "Unknown error";
          return new Response(JSON.stringify({ ok: false, error: message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
