import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { computeStatus, type Stage } from "../../status";

export default defineTool({
  name: "list_fields",
  title: "List fields",
  description:
    "List the crop fields visible to the signed-in user (admins see all fields, field agents see fields assigned to them), including crop, stage and computed season status.",
  inputSchema: {
    stage: z
      .enum(["Planted", "Growing", "Ready", "Harvested"])
      .nullable()
      .describe("Optional stage filter. Pass null for all stages."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ stage }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("fields")
      .select(
        "id, name, crop_type, location, size_hectares, stage, planting_date, last_updated_at, recent_rainfall_mm, pending_harvest_at, assigned_to",
      )
      .order("last_updated_at", { ascending: false });
    if (stage) query = query.eq("stage", stage);
    const { data, error } = await query;
    if (error) throw new ToolError(error.message);

    const fields = (data ?? []).map((f) => ({
      ...f,
      status: computeStatus(
        f.stage as Stage,
        f.planting_date,
        f.last_updated_at,
        f.recent_rainfall_mm,
      ),
      awaiting_harvest_approval: !!f.pending_harvest_at && f.stage !== "Harvested",
    }));

    return {
      content: [{ type: "text", text: JSON.stringify(fields, null, 2) }],
      structuredContent: { count: fields.length, fields },
    };
  },
});
