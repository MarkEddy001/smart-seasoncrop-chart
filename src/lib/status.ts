import { differenceInDays } from "date-fns";

export type Stage = "Planted" | "Growing" | "Ready" | "Harvested";
export type Status = "Active" | "At Risk" | "Completed";

export const STAGES: Stage[] = ["Planted", "Growing", "Ready", "Harvested"];

/**
 * Rainfall thresholds for the last 7 days (mm).
 * <5mm  → drought risk
 * >100mm → flood risk
 */
export const RAIN_DROUGHT_MM = 5;
export const RAIN_FLOOD_MM = 100;

/**
 * Status logic (mirrors public.field_status SQL function):
 *  - Completed → stage = Harvested
 *  - At Risk → Growing/Ready AND any of:
 *       >100 days since planting
 *       >10 days since last update
 *       last 7d rainfall <5mm (drought) or >100mm (flood)
 *  - Active → otherwise
 */
export function computeStatus(
  stage: Stage,
  plantingDate: string,
  lastUpdated: string,
  recentRainfallMm?: number | null,
): Status {
  if (stage === "Harvested") return "Completed";
  if (stage !== "Growing" && stage !== "Ready") return "Active";

  const daysSincePlanting = differenceInDays(new Date(), new Date(plantingDate));
  const daysSinceUpdate = differenceInDays(new Date(), new Date(lastUpdated));
  const rainfallRisk =
    typeof recentRainfallMm === "number" &&
    (recentRainfallMm < RAIN_DROUGHT_MM || recentRainfallMm > RAIN_FLOOD_MM);

  if (daysSincePlanting > 100 || daysSinceUpdate > 10 || rainfallRisk) return "At Risk";
  return "Active";
}

export function rainfallRiskLabel(mm: number | null | undefined): string | null {
  if (typeof mm !== "number") return null;
  if (mm < RAIN_DROUGHT_MM) return "Drought risk";
  if (mm > RAIN_FLOOD_MM) return "Flood risk";
  return null;
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
