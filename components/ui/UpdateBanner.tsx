"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, X } from "lucide-react";

/**
 * Detects when a new Service Worker version is available and prompts
 * the user to reload the app to apply the update.
 */
export default function UpdateBanner() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [waitingSW, setWaitingSW] = useState<ServiceWorker | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let newWorker: ServiceWorker | null = null;

    navigator.serviceWorker.ready.then((reg) => {
      // Check for updates periodically
      reg.update().catch(() => {});

      // Listen for new worker installing
      reg.addEventListener("updatefound", () => {
        const installing = reg.installing;
        if (!installing) return;

        installing.addEventListener("statechange", () => {
          if (installing.state === "installed" && navigator.serviceWorker.controller) {
            // New version available
            newWorker = installing;
            setWaitingSW(installing);
            setUpdateAvailable(true);
          }
        });
      });
    });

    // Also listen for the controller change (new SW activated)
    const handleControllerChange = () => {
      // New SW is now active — reload to get fresh content
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
      newWorker = null;
    };
  }, []);

  const handleUpdate = useCallback(() => {
    if (!waitingSW) return;
    // Tell the waiting SW to skip waiting and become active
    waitingSW.postMessage({ type: "SKIP_WAITING" });
    // The controllerchange listener will handle the reload
  }, [waitingSW]);

  const handleDismiss = () => {
    setDismissed(true);
    setUpdateAvailable(false);
  };

  return (
    <AnimatePresence>
      {updateAvailable && !dismissed && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-[var(--z-toast)]"
        >
          <div className="bg-card border border-border rounded-2xl shadow-lg p-3 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-green-500/10 shrink-0">
              <RefreshCw className="w-4 h-4 text-green-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-foreground">
                Nueva versión disponible
              </p>
              <p className="text-[11px] text-muted-foreground">
                Actualiza para obtener los últimos cambios
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={handleUpdate}
                className="px-3 py-1.5 rounded-lg bg-green-500 text-white text-[11px] font-bold hover:bg-green-600 transition-all cursor-pointer active:scale-95 border-none"
              >
                Actualizar
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
