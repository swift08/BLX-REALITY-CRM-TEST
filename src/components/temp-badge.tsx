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
