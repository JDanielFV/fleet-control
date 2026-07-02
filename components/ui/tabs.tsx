"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Tabs primitives styled to match the rest of the app: pill-shaped trigger
 * with an animated active indicator that slides between tabs (shared
 * `layoutId` so Framer Motion knows they're the same element across
 * re-renders). The list scrolls horizontally on overflow so it stays
 * usable on narrow viewports.
 *
 * Usage:
 *   <Tabs defaultValue="general">
 *     <TabsList>
 *       <TabsTrigger value="general">General</TabsTrigger>
 *       <TabsTrigger value="avanzado">Avanzado</TabsTrigger>
 *     </TabsList>
 *     <TabsContent value="general">…</TabsContent>
 *     <TabsContent value="avanzado">…</TabsContent>
 *   </Tabs>
 *
 * The animated pill pattern follows the well-known shadcn/ui approach:
 * every trigger renders an absolutely-positioned `<motion.span>` with
 * the same `layoutId`. Framer Motion only animates the element that's
 * currently mounted in the visible position; the others stay hidden
 * behind the trigger's overflow. We use a CSS class selector to hide
 * the pill on inactive triggers and reveal it on the active one
 * (Radix sets `data-state="active"` on the trigger element).
 */

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <div className="w-full overflow-x-auto -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        "inline-flex min-w-full items-center gap-1 p-1 rounded-xl bg-muted/40 border border-border/60",
        className
      )}
      {...props}
    />
  </div>
));
TabsList.displayName = TabsPrimitive.List.displayName;

interface TabsTriggerProps
  extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> {
  /** Optional icon shown to the left of the label. */
  icon?: React.ReactNode;
}

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  TabsTriggerProps
>(({ className, children, icon, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "group relative inline-flex items-center justify-center gap-1.5 whitespace-nowrap",
      "px-3.5 h-9 rounded-lg text-xs font-bold uppercase tracking-wider",
      "text-muted-foreground cursor-pointer transition-colors",
      "hover:text-foreground",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
      "data-[state=active]:text-foreground",
      "disabled:pointer-events-none disabled:opacity-50",
      className
    )}
    {...props}
  >
    {/* Shared animated pill. Framer Motion animates the `layoutId` between
        triggers; visibility is controlled by the parent's data-state
        attribute via the `group-data-[state=active]:opacity-100` selector
        below. */}
    <motion.span
      aria-hidden="true"
      layoutId="tabs-active-pill"
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      className="absolute inset-0 rounded-lg bg-card shadow-sm border border-border/60 opacity-0 group-data-[state=active]:opacity-100"
    />
    <span className="relative z-10 flex items-center gap-1.5">
      {icon}
      {children}
    </span>
  </TabsPrimitive.Trigger>
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-4 focus-visible:outline-none",
      className
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
