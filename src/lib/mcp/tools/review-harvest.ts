import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "review_harvest",
  title: "Approve or reject harvest",
  description:
    "Admin (coordinator) only: approve a pending harvest request — marking the field Harvested and the season complete — or reject it and send the field back to the agent.",
  inputSchema: {
    field_id: z.string().uuid().describe("The field id."),
    decision: z.enum(["approve", "reject"]).describe("Approve or reject the harvest request."),
    note: z
      .string()
      .trim()
      .nullable()
      .describe("Optional reviewer note. Pass null to omit."),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  handler: async ({ field_id, decision, note }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);

    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", ctx.getUserId()!)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) throw new ToolError("Only coordinators (admins) can review harvest requests.");

    const { data: field, error: readErr } = await supabase
      .from("fields")
      .select("id, stage, pending_harvest_at")
      .eq("id", field_id)
      .maybeSingle();
    if (readErr) throw new ToolError(readErr.message);
    if (!field) throw new ToolError("Field not found.");
    if (!field.pending_harvest_at) throw new ToolError("This field has no pending harvest request.");

    const approved = decision === "approve";
    const { error: upErr } = await supabase
      .from("fields")
      .update(
        approved
          ? { stage: "Harvested" as const, pending_harvest_at: null }
          : { pending_harvest_at: null },
      )
      .eq("id", field_id);
    if (upErr) throw new ToolError(upErr.message);

    const { error: insErr } = await supabase.from("field_updates").insert({
      field_id,
      author_id: ctx.getUserId()!,
      note:
        note?.trim() ||
        (approved ? "Harvest verified and approved." : "Harvest request rejected."),
      previous_stage: field.stage,
      new_stage: approved ? "Harvested" : field.stage,
    });
    if (insErr) throw new ToolError(insErr.message);

    return {
      content: [
        { type: "text", text: approved ? "Harvest approved — field marked Harvested." : "Harvest request rejected." },
      ],
      structuredContent: { field_id, decision },
    };
  },
});
