"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, X, Share, Plus } from "lucide-react";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";

const DISMISSED_KEY = "fc-install-banner-dismissed";

/**
 * Banner that prompts the user to install the PWA.
 * - Android/Chrome: shows a banner with one-tap install
 * - iOS/Safari: shows instructions to "Add to Home Screen"
 * - Desktop Chrome: shows a banner
 * - Already installed: hidden
 */
export default function InstallBanner() {
  const { canInstall, isInstalled, isIOS, install } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(false);
  const [showIOS, setShowIOS] = useState(false);

  // Check if previously dismissed
  useEffect(() => {
    try {
      const val = localStorage.getItem(DISMISSED_KEY);
      if (val === "true") setDismissed(true);
    } catch {
      // localStorage unavailable
    }
  }, []);

  // Show iOS instructions after a delay
  useEffect(() => {
    if (isInstalled || isIOS || dismissed) return;
    const timer = setTimeout(() => setShowIOS(true), 3000);
    return () => clearTimeout(timer);
  }, [isInstalled, isIOS, dismissed]);

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, "true");
    } catch {
      // ignore
    }
  };

  // Don't show if already installed, dismissed, or running in browser without prompt support
  if (isInstalled) return null;

  // Android/Chrome: native install prompt available
  if (canInstall) {
    return (
      <AnimatePresence>
        {!dismissed && (
          <motion.div
            initial={{ y: -80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed top-0 left-0 right-0 z-[var(--z-toast)] px-4 pt-[env(safe-area-inset-top,0px)]"
          >
            <div className="mt-2 mx-auto max-w-md bg-card border border-border rounded-2xl shadow-lg p-3 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10 shrink-0">
                <Download className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-foreground">
                  Instalar FleetControl
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Acceso rápido desde tu pantalla de inicio
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={install}
                  className="px-3 py-1.5 rounded-lg bg-primary text-white text-[11px] font-bold hover:bg-primary/90 transition-all cursor-pointer active:scale-95 border-none"
                >
                  Instalar
                </button>
                <button
                  onClick={handleDismiss}
                  className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-all cursor-pointer border-none"
                  aria-label="Cerrar"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  // iOS: show instructions
  if (isIOS && !dismissed) {
    return (
      <AnimatePresence>
        {!dismissed && (
          <motion.div
            initial={{ y: -80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed top-0 left-0 right-0 z-[var(--z-toast)] px-4 pt-[env(safe-area-inset-top,0px)]"
          >
            <div className="mt-2 mx-auto max-w-md bg-card border border-border rounded-2xl shadow-lg p-3">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-xl bg-primary/10 shrink-0">
                  <Download className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-foreground">
                    Instalar FleetControl
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Añade a tu pantalla de inicio
                  </p>
                </div>
                <button
                  onClick={handleDismiss}
                  className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-all cursor-pointer border-none"
                  aria-label="Cerrar"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground bg-muted/30 rounded-xl p-2.5">
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="font-bold text-foreground">1.</span>
                  <Share className="w-3.5 h-3.5" />
                  <span>Toca</span>
                </div>
                <span className="text-border">→</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="font-bold text-foreground">2.</span>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Añadir a pantalla</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  return null;
}
