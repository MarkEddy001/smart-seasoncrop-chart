import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { computeStatus, rainfallRiskLabel, type Stage } from "../../status";

export default defineTool({
  name: "get_field",
  title: "Get field details",
  description:
    "Get one field with its computed status, rainfall risk and the most recent progress updates from its history timeline.",
  inputSchema: {
    field_id: z.string().uuid().describe("The field id."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ field_id }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);

    const [{ data: field, error }, { data: updates, error: updErr }] = await Promise.all([
      supabase.from("fields").select("*").eq("id", field_id).maybeSingle(),
      supabase
        .from("field_updates")
        .select("id, note, previous_stage, new_stage, photo_urls, created_at")
        .eq("field_id", field_id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    if (error) throw new ToolError(error.message);
    if (updErr) throw new ToolError(updErr.message);
    if (!field) throw new ToolError("Field not found or not visible to you.");

    const result = {
      ...field,
      status: computeStatus(
        field.stage as Stage,
        field.planting_date,
        field.last_updated_at,
        field.recent_rainfall_mm,
      ),
      rainfall_risk: rainfallRiskLabel(field.recent_rainfall_mm),
      awaiting_harvest_approval: !!field.pending_harvest_at && field.stage !== "Harvested",
      recent_updates: updates ?? [],
    };

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      structuredContent: { field: result },
    };
  },
});
