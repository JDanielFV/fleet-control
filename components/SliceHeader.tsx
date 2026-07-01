import type { ReactNode } from "react";

interface SliceHeaderProps {
  title: string;
  /** Optional node rendered on the right (e.g. a "Registrar…" dialog trigger). */
  action?: ReactNode;
}

/**
 * Presentational title bar shared by every slice. Previously each slice
 * rendered an h1 alongside a redundant "Menu" button whose handler was no
 * longer wired from Dashboard (bottom tabs handle navigation); this collapses
 * the bar to the title plus an optional action on the right.
 */
export default function SliceHeader({ title, action }: SliceHeaderProps) {
  return (
    <div className="flex items-center justify-between px-1 mb-2">
      <h1 className="text-[26px] font-bold tracking-tight text-foreground leading-none">{title}</h1>
      {action ? <div className="flex items-center gap-2">{action}</div> : null}
    </div>
  );
}