"use client";

import React from "react";

export interface MobileCardRow {
  label: string;
  value: React.ReactNode;
}

interface MobileCardProps {
  /** Header: nombre/placa + badge de estado */
  header: React.ReactNode;
  /** Filas clave como pares label/value */
  rows?: MobileCardRow[];
  /** Acciones táctiles (targets ≥44px, icono + texto visible) */
  actions?: React.ReactNode;
  /** Contenido extra (detalles expandidos en móvil) */
  children?: React.ReactNode;
  /** Clases de estado (p. ej. border-l-4 de color) */
  statusClass?: string;
  onClick?: () => void;
}

/**
 * Card móvil para listas de datos (solo se renderiza en <768px vía `md:hidden`).
 * Sigue el sistema visual del proyecto: rounded-2xl, border-border/60, bg-card.
 * El tap dispara la misma acción que el row de la tabla desktop.
 */
export function MobileCard({ header, rows, actions, children, statusClass = "", onClick }: MobileCardProps) {
  const interactive = !!onClick;
  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={`rounded-2xl border border-border/60 bg-card p-3.5 space-y-2.5 shadow-sm ${interactive ? "cursor-pointer active:scale-[0.99] transition-all focus-visible:ring-4 focus-visible:ring-primary focus-visible:outline-hidden" : ""} ${statusClass}`}
    >
      <div className="flex items-start justify-between gap-3">{header}</div>
      {rows && rows.length > 0 && (
        <div className="space-y-1.5">
          {rows.map((r) => (
            <div key={r.label} className="flex items-baseline justify-between gap-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 shrink-0">{r.label}</span>
              <span className="text-xs font-semibold text-foreground text-right min-w-0 break-words">{r.value}</span>
            </div>
          ))}
        </div>
      )}
      {actions && <div className="pt-1 space-y-2">{actions}</div>}
      {children}
    </div>
  );
}

/** Botón de acción táctil para cards (≥44px de alto, icono + texto visible). */
export function MobileActionButton({
  onClick,
  children,
  variant = "default",
  className = "",
}: {
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  children: React.ReactNode;
  variant?: "default" | "primary" | "danger" | "success";
  className?: string;
}) {
  const variantClass =
    variant === "primary"
      ? "bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20"
      : variant === "danger"
      ? "bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20"
      : variant === "success"
      ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 hover:bg-emerald-500/20"
      : "bg-muted text-foreground border border-border/60 hover:bg-secondary";
  return (
    <button
      onClick={onClick}
      className={`w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-xl text-xs font-bold transition-colors cursor-pointer active:scale-[0.99] focus-visible:ring-4 focus-visible:ring-primary focus-visible:outline-hidden ${variantClass} ${className}`}
    >
      {children}
    </button>
  );
}
