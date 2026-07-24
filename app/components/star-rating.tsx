import { Star } from "lucide-react";
import { cn } from "~/lib/utils";

export function StarRatingDisplay({
  average,
  count,
  size = "sm",
  className,
}: {
  average: number | null;
  count: number;
  size?: "sm" | "md";
  className?: string;
}) {
  if (count === 0) {
    return (
      <span className={cn("text-xs text-muted-foreground", className)}>
        No ratings yet
      </span>
    );
  }

  const rounded = Math.round((average ?? 0) * 10) / 10;
  const starSize = size === "sm" ? "size-3.5" : "size-4";

  return (
    <span className={cn("flex items-center gap-1 text-sm", className)}>
      <Star className={cn(starSize, "fill-yellow-400 text-yellow-400")} />
      <span className="font-medium">{rounded.toFixed(1)}</span>
      <span className="text-muted-foreground">({count})</span>
    </span>
  );
}

export function StarRatingPicker({
  value,
  onChange,
  disabled,
  className,
}: {
  value: number | null;
  onChange: (score: number) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn("flex items-center gap-1", className)}
      role="radiogroup"
      aria-label="Rate this course"
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          disabled={disabled}
          onClick={() => onChange(n)}
          className="p-0.5 disabled:opacity-50"
        >
          <Star
            className={cn(
              "size-6 transition-colors",
              value !== null && n <= value
                ? "fill-yellow-400 text-yellow-400"
                : "text-muted-foreground hover:text-yellow-400"
            )}
          />
        </button>
      ))}
    </div>
  );
}
