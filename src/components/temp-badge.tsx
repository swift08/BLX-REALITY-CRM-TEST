import { cn } from "@/lib/utils";

const colorMap: Record<string, string> = {
  // New lowercase values from queries.ts
  hot: "bg-hot text-hot-foreground",
  warm: "bg-warm text-warm-foreground",
  cold: "bg-cold text-cold-foreground",
  // Legacy title-case values from mock-data.ts
  Hot: "bg-hot text-hot-foreground",
  Warm: "bg-warm text-warm-foreground",
  Cold: "bg-cold text-cold-foreground",
};

const labelMap: Record<string, string> = {
  hot: "🔥 Hot",
  warm: "⚡ Warm",
  cold: "❄️ Cold",
  Hot: "🔥 Hot",
  Warm: "⚡ Warm",
  Cold: "❄️ Cold",
};

export function TempBadge({ value }: { value: string }) {
  const cls = colorMap[value] ?? "bg-muted text-muted-foreground";
  const label = labelMap[value] ?? value;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold",
        cls,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {label}
    </span>
  );
}

export function StageBadge({ value }: { value: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-primary-soft text-primary">
      {value}
    </span>
  );
}

const STAGE_PROGRESS_MAP: Record<string, number> = {
  new: 10,
  assigned: 15,
  contact_attempted: 25,
  connected: 35,
  interested: 45,
  meeting_scheduled: 50,
  meeting_completed: 55,
  site_visit_scheduled: 65,
  site_visit_completed: 75,
  negotiation: 85,
  booking_initiated: 90,
  payment_pending: 92,
  payment_completed: 95,
  converted: 100,
  closed: 100,
  lost: 0,
};

export function LeadProgressBar({ stage }: { stage: string }) {
  const percent = STAGE_PROGRESS_MAP[stage] ?? 10;
  const isLost = stage === "lost";
  const isConverted = stage === "converted" || stage === "closed";

  return (
    <div className="w-full space-y-1">
      <div className="flex justify-between items-center text-[11px] text-muted-foreground font-medium">
        <span>Sales Progress</span>
        <span
          className={
            isLost
              ? "text-rose-500 font-semibold"
              : isConverted
                ? "text-emerald-600 font-semibold dark:text-emerald-400"
                : "text-primary font-semibold"
          }
        >
          {isLost ? "Lost (0%)" : `${percent}%`}
        </span>
      </div>
      <div className="h-2 w-full bg-muted/60 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 rounded-full ${
            isLost
              ? "bg-rose-500"
              : isConverted
                ? "bg-emerald-500"
                : "bg-gradient-to-r from-blue-500 to-indigo-600"
          }`}
          style={{ width: `${isLost ? 100 : percent}%` }}
        />
      </div>
    </div>
  );
}
