import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "log_field_update",
  title: "Log field update",
  description:
    "Add a progress note to a field's history timeline, optionally advancing its stage. Field agents cannot set the stage to Harvested directly — use request_harvest instead.",
  inputSchema: {
    field_id: z.string().uuid().describe("The field id."),
    note: z.string().trim().min(1).describe("The progress note to record."),
    new_stage: z
      .enum(["Planted", "Growing", "Ready"])
      .nullable()
      .describe("Optional new stage. Pass null to leave the stage unchanged."),
  },
  annotations: { readOnlyHint: false, openWorldHint: false },
  handler: async ({ field_id, note, new_stage }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);

    const { data: field, error: readErr } = await supabase
      .from("fields")
      .select("id, stage")
      .eq("id", field_id)
      .maybeSingle();
    if (readErr) throw new ToolError(readErr.message);
    if (!field) throw new ToolError("Field not found or not visible to you.");

    if (new_stage && new_stage !== field.stage) {
      const { error: upErr } = await supabase
        .from("fields")
        .update({ stage: new_stage })
        .eq("id", field_id);
      if (upErr) throw new ToolError(upErr.message);
    }

    const { error: insErr } = await supabase.from("field_updates").insert({
      field_id,
      author_id: ctx.getUserId()!,
      note,
      previous_stage: field.stage,
      new_stage: new_stage ?? field.stage,
    });
    if (insErr) throw new ToolError(insErr.message);

    return {
      content: [
        {
          type: "text",
          text: `Update logged${new_stage && new_stage !== field.stage ? ` and stage set to ${new_stage}` : ""}.`,
        },
      ],
      structuredContent: { field_id, stage: new_stage ?? field.stage },
    };
  },
});
