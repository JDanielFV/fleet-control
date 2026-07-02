"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Stepper, type StepperStep } from "@/components/ui/stepper";
import { cn } from "@/lib/utils";

export interface WizardStep extends StepperStep {
  /**
   * The content of the step. The Wizard renders one step at a time and
   * animates between them. The function form lets the step opt into
   * the `goNext` / `goBack` navigation helpers if it needs to.
   */
  content:
    | React.ReactNode
    | ((helpers: {
        goNext: () => void;
        goBack: () => void;
        goTo: (stepId: string) => void;
        isFirst: boolean;
        isLast: boolean;
      }) => React.ReactNode);
  /**
   * When set, the "Siguiente" button is disabled until this returns true.
   * Useful for per-step form validation.
   */
  canAdvance?: () => boolean;
  /**
   * Optional async hook fired when the user clicks "Siguiente" on this
   * step. Return a promise to block the transition (e.g. while saving).
   * If it throws, the transition is aborted.
   */
  beforeNext?: () => void | Promise<void>;
}

export interface WizardProps {
  steps: WizardStep[];
  /** The id of the initially active step. Defaults to the first step. */
  defaultStep?: string;
  /** Controlled active step. Overrides internal state. */
  currentStep?: string;
  /** Called when the active step changes. */
  onStepChange?: (stepId: string) => void;
  /**
   * When true (default) the Wizard renders its own header with the
   * Stepper + a sticky footer with navigation buttons. Set false if
   * you want to compose the chrome yourself.
   */
  showChrome?: boolean;
  /** Label overrides for the navigation buttons. */
  labels?: {
    back?: string;
    next?: string;
    finish?: string;
  };
  /** Called when the user clicks the final "Finalizar" button. */
  onFinish?: () => void | Promise<void>;
  /** Optional className for the outermost wrapper. */
  className?: string;
}

const SLIDE_VARIANTS = {
  enter: { x: 32, opacity: 0 },
  center: { x: 0, opacity: 1 },
  exit: { x: -32, opacity: 0 },
};

/**
 * Multi-step flow container. Renders a `<Stepper />` on top, the current
 * step's content in the middle (with a Framer Motion slide between
 * steps) and a sticky footer with back / next / finish buttons.
 *
 * Use it inside a `<Dialog />` for the modal experience. The parent
 * owns form state; the Wizard just orchestrates the navigation.
 */
export function Wizard({
  steps,
  defaultStep,
  currentStep: controlledStep,
  onStepChange,
  showChrome = true,
  labels,
  onFinish,
  className,
}: WizardProps) {
  const firstId = steps[0]?.id;
  const [internalStep, setInternalStep] = React.useState<string>(
    defaultStep ?? firstId ?? ""
  );
  const activeId = controlledStep ?? internalStep;

  const activeIndex = Math.max(
    0,
    steps.findIndex((s) => s.id === activeId)
  );
  const activeStep = steps[activeIndex];
  const isFirst = activeIndex === 0;
  const isLast = activeIndex === steps.length - 1;

  const setActive = React.useCallback(
    (id: string) => {
      if (controlledStep === undefined) setInternalStep(id);
      onStepChange?.(id);
    },
    [controlledStep, onStepChange]
  );

  const goNext = React.useCallback(() => {
    const nextStep = steps[activeIndex + 1];
    if (nextStep) setActive(nextStep.id);
  }, [activeIndex, steps, setActive]);

  const goBack = React.useCallback(() => {
    const prevStep = steps[activeIndex - 1];
    if (prevStep) setActive(prevStep.id);
  }, [activeIndex, steps, setActive]);

  const goTo = React.useCallback(
    (id: string) => {
      // Only allow jumping to a step that is at or before the current one
      // so users can't skip ahead.
      const targetIndex = steps.findIndex((s) => s.id === id);
      if (targetIndex >= 0 && targetIndex <= activeIndex) {
        setActive(id);
      }
    },
    [steps, activeIndex, setActive]
  );

  const [isAdvancing, setIsAdvancing] = React.useState(false);

  const handleNext = async () => {
    if (!activeStep) return;
    if (activeStep.canAdvance && !activeStep.canAdvance()) return;
    if (activeStep.beforeNext) {
      try {
        setIsAdvancing(true);
        await activeStep.beforeNext();
      } catch {
        setIsAdvancing(false);
        return; // abort transition on error
      }
      setIsAdvancing(false);
    }
    if (isLast) {
      await onFinish?.();
    } else {
      goNext();
    }
  };

  const stepper = (
    <Stepper
      steps={steps}
      currentStep={activeId}
      onStepClick={(id) => {
        // Stepper only invokes onStepClick for completed or active steps;
        // the Wizard then enforces the "no skip-ahead" rule via goTo.
        goTo(id);
      }}
    />
  );

  const footer = (
    <div className="flex items-center justify-between gap-3 pt-4 border-t border-border/60">
      <Button
        type="button"
        variant="outline"
        onClick={goBack}
        disabled={isFirst}
        className="rounded-xl h-10 px-4 text-xs font-bold cursor-pointer"
      >
        <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
        {labels?.back ?? "Atrás"}
      </Button>
      <Button
        type="button"
        onClick={handleNext}
        disabled={
          isAdvancing ||
          (!!activeStep?.canAdvance && !activeStep.canAdvance())
        }
        className="rounded-xl h-10 px-5 text-xs font-bold cursor-pointer"
      >
        {isLast ? (
          <>
            <Check className="w-3.5 h-3.5 mr-1.5" />
            {labels?.finish ?? "Finalizar"}
          </>
        ) : (
          <>
            {labels?.next ?? "Siguiente"}
            <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
          </>
        )}
      </Button>
    </div>
  );

  if (!activeStep) return null;

  const renderedContent =
    typeof activeStep.content === "function"
      ? activeStep.content({ goNext, goBack, goTo, isFirst, isLast })
      : activeStep.content;

  if (!showChrome) {
    return (
      <div className={className}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeId}
            variants={SLIDE_VARIANTS}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            {renderedContent}
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-5 w-full", className)}>
      {stepper}
      <div className="relative overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeId}
            variants={SLIDE_VARIANTS}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            {renderedContent}
          </motion.div>
        </AnimatePresence>
      </div>
      {footer}
    </div>
  );
}

Wizard.displayName = "Wizard";
