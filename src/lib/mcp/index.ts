import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listFields from "./tools/list-fields";
import getField from "./tools/get-field";
import logFieldUpdate from "./tools/log-field-update";
import requestHarvest from "./tools/request-harvest";
import reviewHarvest from "./tools/review-harvest";

const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "smart-season-tracker",
  title: "Smart Season Tracker",
  version: "0.1.0",
  instructions:
    "Tools for SmartSeason, a crop field monitoring system. Use `list_fields` and `get_field` to review crop progress, stage and season status. Field agents use `log_field_update` to record progress and `request_harvest` to submit a field for coordinator verification. Coordinators (admins) use `review_harvest` to approve or reject those requests. All access is scoped to the signed-in user's role.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listFields, getField, logFieldUpdate, requestHarvest, reviewHarvest],
});
