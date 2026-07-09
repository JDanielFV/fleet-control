"use client";

import { useState, useCallback, createContext, useContext } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "default";
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue>({
  confirm: () => Promise.resolve(false),
});

export function useConfirm() {
  return useContext(ConfirmContext);
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ConfirmOptions | null>(null);
  const [resolve, setResolve] = useState<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((res) => {
      setState(options);
      setResolve(() => res);
    });
  }, []);

  const handleConfirm = () => {
    if (resolve) resolve(true);
    setState(null);
    setResolve(null);
  };

  const handleCancel = () => {
    if (resolve) resolve(false);
    setState(null);
    setResolve(null);
  };

  const variantStyles = {
    danger: {
      button: "bg-red-500 text-white hover:bg-red-600",
      icon: "text-red-400",
    },
    warning: {
      button: "bg-amber-500 text-white hover:bg-amber-600",
      icon: "text-amber-400",
    },
    default: {
      button: "bg-primary text-white hover:bg-primary/90",
      icon: "text-primary",
    },
  };

  const vs = state ? variantStyles[state.variant || "danger"] : variantStyles.danger;

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <AnimatePresence>
        {state && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-[90] backdrop-blur-sm"
              onClick={handleCancel}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="fixed inset-0 z-[91] flex items-center justify-center p-4 pointer-events-none"
            >
              <div
                className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl p-5 pointer-events-auto"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="confirm-title"
                aria-describedby="confirm-message"
              >
                <div className="flex items-start gap-3 mb-4">
                  <div className={`p-2 rounded-full ${vs.icon}/10 shrink-0`}>
                    <AlertTriangle className={`w-5 h-5 ${vs.icon}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 id="confirm-title" className="text-sm font-black text-foreground">
                      {state.title}
                    </h3>
                    <p id="confirm-message" className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {state.message}
                    </p>
                  </div>
                  <button
                    onClick={handleCancel}
                    className="p-1 -mr-1 -mt-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 cursor-pointer"
                    aria-label="Cancelar"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleCancel}
                    className="flex-1 text-xs font-semibold py-2.5 rounded-xl border border-border text-muted-foreground hover:bg-muted/20 transition-colors cursor-pointer"
                  >
                    {state.cancelLabel || "Cancelar"}
                  </button>
                  <button
                    onClick={handleConfirm}
                    className={`flex-1 text-xs font-bold py-2.5 rounded-xl transition-colors cursor-pointer ${vs.button}`}
                  >
                    {state.confirmLabel || "Confirmar"}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </ConfirmContext.Provider>
  );
}
