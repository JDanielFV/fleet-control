"use client";

import { motion } from "framer-motion";
import { Bell, Sun, Moon } from "lucide-react";
import type { TabId } from "./Dashboard";
import { cn } from "@/lib/utils";

interface NavItem {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface SidebarProps {
  /** Tabs to render in the vertical list. Same shape as the mobile bottom-nav. */
  items: NavItem[];
  activeTab: TabId;
  onChange: (tab: TabId) => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  alertCount: number;
  onAlertsClick: () => void;
}

/**
 * Desktop navigation rail. Hidden on mobile (`hidden md:flex`) — the bottom
 * tab bar handles those viewports. Shares the `activeNavIndicator` layoutId
 * with the bottom-nav so the active tab marker flows between the two when the
 * viewport is resized.
 */
export default function Sidebar({
  items,
  activeTab,
  onChange,
  theme,
  onToggleTheme,
  alertCount,
  onAlertsClick,
}: SidebarProps) {
  return (
    <aside
      className="hidden md:flex md:shrink-0 md:w-60 lg:w-64 bg-card/95 backdrop-blur-md border-r border-border flex-col z-30"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      {/* Brand / logo placeholder */}
      <div className="px-5 pt-6 pb-5 border-b border-border/60">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-primary-glow">
            <span className="text-white text-base font-black">F</span>
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-extrabold text-foreground leading-none">Fleet Control</h2>
            <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wider font-semibold">Operación diaria</p>
          </div>
        </div>
      </div>

      {/* Nav list */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto overflow-x-hidden">
        {items.map((item) => {
          const Icon = item.icon;
          const isSelected = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onChange(item.id)}
              className={cn(
                "relative w-full flex items-center gap-3 px-3 h-11 rounded-xl text-sm transition-all active:scale-[0.98] cursor-pointer",
                isSelected
                  ? "text-primary font-bold bg-primary/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
              )}
            >
              {isSelected && (
                <motion.div
                  layoutId="activeNavIndicator"
                  className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-primary rounded-full"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <Icon className={cn("w-5 h-5 shrink-0 transition-transform", isSelected && "scale-105")} />
              <span className="truncate">{item.label}</span>
              {isSelected && (
                <motion.span
                  layoutId="activeNavPill"
                  className="ml-auto w-1.5 h-1.5 rounded-full bg-primary"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer: theme toggle + alerts bell */}
      <div className="px-3 py-3 border-t border-border/60 flex items-center gap-2">
        <button
          onClick={onToggleTheme}
          className="flex-1 flex items-center justify-center gap-2 h-10 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground transition-all active:scale-95 cursor-pointer"
          aria-label="Cambiar tema"
        >
          {theme === "dark" ? (
            <>
              <Sun className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-semibold">Claro</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 text-slate-500" />
              <span className="text-xs font-semibold">Oscuro</span>
            </>
          )}
        </button>
        <button
          onClick={onAlertsClick}
          className="relative h-10 w-10 flex items-center justify-center rounded-xl bg-secondary hover:bg-secondary/80 text-foreground transition-all active:scale-95 cursor-pointer shrink-0"
          aria-label="Alertas"
        >
          <Bell className="w-4 h-4" />
          {alertCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[11px] font-bold rounded-full flex items-center justify-center">
              {alertCount}
            </span>
          )}
        </button>
      </div>
    </aside>
  );
}
