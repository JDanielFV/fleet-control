import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Animated placeholder block. Renders a shimmering gradient that respects the
 * app theme so users see a clear "loading" affordance without flashing empty
 * spaces. Compose multiple Skeletons to mimic the real layout.
 */
export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Tailwind size utility, e.g. "h-4 w-12" or "h-3 w-full". */
  className?: string;
}

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Cargando"
      className={cn(
        "relative overflow-hidden rounded-md bg-muted/70 ",
        // Inner shimmer overlay — uses CSS to keep paint cheap during rerenders.
        "after:absolute after:inset-0 after:-translate-x-full after:animate-[shimmer_1.6s_infinite] after:bg-gradient-to-r after:from-transparent after:via-white/30 after:to-transparent ",
        className
      )}
      {...props}
    />
  );
}
