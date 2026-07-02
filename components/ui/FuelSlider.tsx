"use client";

import React from "react";
import { cn } from "@/lib/utils";

const FUEL_LEVELS = ["1/8", "2/8", "3/8", "4/8", "5/8", "6/8", "7/8", "8/8"];

interface FuelSliderProps {
  value: string; // "1/8" .. "8/8"
  onChange: (value: string) => void;
  label?: string;
  /** Optional className for the outermost wrapper. */
  className?: string;
  /** When true, renders a compact layout for use in dense forms. */
  compact?: boolean;
}

function fuelLabel(level: string): string {
  if (level === "8/8") return "Lleno";
  if (level === "4/8") return "Medio";
  if (level === "1/8") return "Reserva";
  return "Parcial";
}

/**
 * Shared fuel level selector: a continuous range slider with 8 discrete steps
 * (1/8 → 8/8), a red→green gradient track and step markers. Used by both the
 * Assignment and Checklist sheets to guarantee visual + behavioral consistency.
 */
export const FuelSlider = React.forwardRef<HTMLInputElement, FuelSliderProps>(
  ({ value, onChange, label = "Nivel Gasolina", className, compact = false }, ref) => {
    const currentStep = parseInt(value.split("/")[0], 10) || 0;
    return (
      <div className={cn("space-y-2", compact ? "" : "pt-1", className)}>
        <div
          className={cn(
            "text-muted-foreground flex justify-between items-center",
            compact ? "text-xs font-semibold" : "text-xs"
          )}
        >
          <span>{label}</span>
          <span className="font-bold text-foreground uppercase tracking-wider text-[10px]">
            {value} ({fuelLabel(value)})
          </span>
        </div>

        <div className="relative pb-3 px-1">
          <input
            ref={ref}
            type="range"
            min={1}
            max={8}
            step={1}
            value={currentStep}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              onChange(`${v}/8`);
            }}
            className="w-full fuel-slider cursor-pointer"
            style={{
              background: `linear-gradient(to right,
                #ef4444 0%,
                #f97316 25%,
                #f59e0b 50%,
                #22c55e 100%)`,
            }}
            aria-label={label}
          />
          <div className="flex justify-between px-[6px] mt-2 pointer-events-none">
            {FUEL_LEVELS.map((lvl) => {
              const val = parseInt(lvl.split("/")[0], 10);
              const isActive = val <= currentStep;
              return (
                <div
                  key={lvl}
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${
                    isActive ? "bg-foreground" : "bg-muted-foreground/30"
                  }`}
                />
              );
            })}
          </div>
          <div className="flex justify-between mt-1 text-[8px] font-bold text-muted-foreground/70 select-none">
            {FUEL_LEVELS.map((lvl) => (
              <span key={lvl} className="w-3 text-center">
                {parseInt(lvl.split("/")[0], 10)}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }
);
FuelSlider.displayName = "FuelSlider";
