import { Badge } from "@/components/ui/badge";
import { stageColor, type Stage } from "@/lib/status";
import { cn } from "@/lib/utils";

export function StageBadge({ stage }: { stage: Stage }) {
  return (
    <Badge variant="outline" className={cn("font-medium", stageColor[stage])}>
      {stage}
    </Badge>
  );
}
