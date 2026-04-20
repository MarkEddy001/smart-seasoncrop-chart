import { differenceInDays } from "date-fns";

export type Stage = "Planted" | "Growing" | "Ready" | "Harvested";
export type Status = "Active" | "At Risk" | "Completed";

export const STAGES: Stage[] = ["Planted", "Growing", "Ready", "Harvested"];

/**
 * Status logic (mirrors public.field_status SQL function):
 *  - Completed → stage = Harvested
 *  - At Risk → Growing/Ready AND (>100 days since planting OR >10 days since last update)
 *  - Active → otherwise
 */
export function computeStatus(stage: Stage, plantingDate: string, lastUpdated: string): Status {
  if (stage === "Harvested") return "Completed";
  const daysSincePlanting = differenceInDays(new Date(), new Date(plantingDate));
  const daysSinceUpdate = differenceInDays(new Date(), new Date(lastUpdated));
  if ((stage === "Growing" || stage === "Ready") && (daysSincePlanting > 100 || daysSinceUpdate > 10)) {
    return "At Risk";
  }
  return "Active";
}

export const statusColor: Record<Status, string> = {
  Active: "bg-success/15 text-success border-success/30",
  "At Risk": "bg-warning/15 text-warning-foreground border-warning/40",
  Completed: "bg-muted text-muted-foreground border-border",
};

export const stageColor: Record<Stage, string> = {
  Planted: "bg-accent text-accent-foreground border-accent",
  Growing: "bg-primary/10 text-primary border-primary/20",
  Ready: "bg-warning/15 text-warning-foreground border-warning/30",
  Harvested: "bg-muted text-muted-foreground border-border",
};
