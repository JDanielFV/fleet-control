"use client";

import { motion } from "framer-motion";
import { Bell } from "lucide-react";
import type { TabId } from "./Dashboard";
import { cn } from "@/lib/utils";

interface NavItem {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface SidebarProps {
  items: NavItem[];
  activeTab: TabId;
  onChange: (tab: TabId) => void;
  alertCount: number;
  onAlertsClick: () => void;
}

export default function Sidebar({
  items,
  activeTab,
  onChange,
  alertCount,
  onAlertsClick,
}: SidebarProps) {
  return (
    <aside
      className="hidden md:flex md:shrink-0 md:w-24 bg-card/95 backdrop-blur-md border-r border-border flex-col z-30 items-center"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      {/* Brand */}
      <div className="pt-5 pb-4 border-b border-border/60 w-full flex justify-center">
        <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-primary-glow">
          <span className="text-white text-base font-black">F</span>
        </div>
      </div>

      {/* Nav icons */}
      <nav className="flex-1 w-full px-2 py-4 flex flex-col items-center gap-1 overflow-y-auto">
        {items.map((item) => {
          const Icon = item.icon;
          const isSelected = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onChange(item.id)}
              className={cn(
                "relative w-full flex flex-col items-center gap-1 py-2.5 rounded-xl text-[10px] font-semibold transition-all active:scale-[0.97] cursor-pointer",
                isSelected
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
              )}
            >
              {isSelected && (
                <motion.div
                  layoutId="activeNavIndicator"
                  className="absolute left-0 top-2 bottom-2 w-[3px] bg-primary rounded-full"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <Icon className={cn("w-5 h-5 shrink-0", isSelected && "scale-105")} />
              <span className="leading-tight text-center">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer: alerts only */}
      <div className="w-full px-2 py-3 border-t border-border/60 flex flex-col items-center gap-2">
        <button
          onClick={onAlertsClick}
          className="relative w-full flex flex-col items-center gap-1 py-2 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground transition-all active:scale-95 cursor-pointer"
          aria-label="Alertas"
        >
          <Bell className="w-5 h-5" />
          <span className="text-[10px] font-semibold leading-tight">Buzón</span>
          {alertCount > 0 && (
            <span className="absolute -top-0.5 right-1 min-w-[14px] h-3.5 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {alertCount}
            </span>
          )}
        </button>
      </div>
    </aside>
  );
}
