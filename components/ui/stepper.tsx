"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StepperStep {
  /** Stable id used for navigation and `currentStep` prop. */
  id: string;
  /** Short label shown under the circle. Keep it <= 2 words. */
  label: string;
  /** Optional icon override. Defaults to the step index. */
  icon?: React.ReactNode;
}

export interface StepperProps {
  steps: StepperStep[];
  /** The id of the currently active step. */
  currentStep: string;
  /** Called when the user clicks a step (completed steps are clickable). */
  onStepClick?: (stepId: string) => void;
  /** Optional className for the outer wrapper. */
  className?: string;
}

/**
 * Horizontal progress indicator used by `<Wizard />` and any multi-step
 * flow. Renders a row of numbered/checked circles connected by a line
 * that fills with the primary color as the user advances.
 *
 * Completed steps are clickable so the user can jump back; pending
 * steps are dim and not clickable.
 */
export function Stepper({
  steps,
  currentStep,
  onStepClick,
  className,
}: StepperProps) {
  const currentIndex = Math.max(
    0,
    steps.findIndex((s) => s.id === currentStep)
  );

  return (
    <ol
      className={cn(
        "flex items-center justify-between gap-1 w-full select-none",
        className
      )}
      aria-label="Progreso"
    >
      {steps.map((step, index) => {
        const isCompleted = index < currentIndex;
        const isActive = index === currentIndex;
        const isClickable = !!onStepClick && (isCompleted || isActive);

        return (
          <li
            key={step.id}
            className="flex-1 flex items-center min-w-0"
            aria-current={isActive ? "step" : undefined}
          >
            <button
              type="button"
              disabled={!isClickable}
              onClick={() => isClickable && onStepClick?.(step.id)}
              className={cn(
                "group flex flex-col items-center gap-1.5 shrink-0 cursor-pointer",
                "disabled:cursor-default"
              )}
              aria-label={`Paso ${index + 1}: ${step.label}`}
            >
              <motion.div
                initial={false}
                animate={{ scale: isActive ? 1.08 : 1 }}
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
                className={cn(
                  "flex items-center justify-center rounded-full border-2 transition-colors duration-300",
                  "h-8 w-8 text-xs font-bold",
                  isCompleted &&
                    "bg-primary border-primary text-primary-foreground",
                  isActive &&
                    "bg-background border-primary text-primary ring-4 ring-primary/15",
                  !isCompleted &&
                    !isActive &&
                    "bg-muted/40 border-border text-muted-foreground"
                )}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4" strokeWidth={3} />
                ) : step.icon ? (
                  <span className="flex items-center justify-center">
                    {step.icon}
                  </span>
                ) : (
                  index + 1
                )}
              </motion.div>
              <span
                className={cn(
                  "text-xs font-bold uppercase tracking-wider text-center max-w-[80px] truncate transition-colors duration-300",
                  isActive && "text-foreground",
                  isCompleted && "text-primary",
                  !isCompleted && !isActive && "text-muted-foreground/60"
                )}
              >
                {step.label}
              </span>
            </button>

            {index < steps.length - 1 && (
              <div className="flex-1 h-0.5 mx-1.5 relative bg-border rounded-full overflow-hidden">
                <motion.div
                  initial={false}
                  animate={{ scaleX: isCompleted ? 1 : 0 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  style={{ transformOrigin: "left" }}
                  className="absolute inset-0 bg-primary"
                />
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

Stepper.displayName = "Stepper";
