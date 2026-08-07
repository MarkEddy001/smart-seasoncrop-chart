import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "request_harvest",
  title: "Request harvest approval",
  description:
    "Mark a field as ready for harvest and submit it for admin (coordinator) verification. The field is only marked Harvested once an admin approves it.",
  inputSchema: {
    field_id: z.string().uuid().describe("The field id."),
    note: z
      .string()
      .trim()
      .nullable()
      .describe("Optional note for the coordinator. Pass null to omit."),
  },
  annotations: { readOnlyHint: false, openWorldHint: false },
  handler: async ({ field_id, note }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);

    const { data: field, error: readErr } = await supabase
      .from("fields")
      .select("id, stage, pending_harvest_at")
      .eq("id", field_id)
      .maybeSingle();
    if (readErr) throw new ToolError(readErr.message);
    if (!field) throw new ToolError("Field not found or not visible to you.");
    if (field.stage === "Harvested") throw new ToolError("Field is already harvested.");

    const { error: upErr } = await supabase
      .from("fields")
      .update({ pending_harvest_at: new Date().toISOString() })
      .eq("id", field_id);
    if (upErr) throw new ToolError(upErr.message);

    const { error: insErr } = await supabase.from("field_updates").insert({
      field_id,
      author_id: ctx.getUserId()!,
      note: note?.trim() || "Requested harvest verification.",
      previous_stage: field.stage,
      new_stage: field.stage,
    });
    if (insErr) throw new ToolError(insErr.message);

    return {
      content: [{ type: "text", text: "Harvest verification requested. Awaiting admin approval." }],
      structuredContent: { field_id, awaiting_harvest_approval: true },
    };
  },
});
