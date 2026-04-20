import { Badge } from "@/components/ui/badge";
import { statusColor, type Status } from "@/lib/status";
import { cn } from "@/lib/utils";

export function StatusBadge({ status }: { status: Status }) {
  return (
    <Badge variant="outline" className={cn("font-medium", statusColor[status])}>
      {status}
    </Badge>
  );
}
