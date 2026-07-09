"use client";

import { useState, useCallback, createContext, useContext } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, AlertTriangle, XCircle, X } from "lucide-react";

type ToastType = "success" | "error" | "warning";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: ToastType = "success") => {
    const id = Date.now().toString() + Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const remove = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const iconMap = {
    success: <CheckCircle className="w-4 h-4 text-green-400" />,
    error: <XCircle className="w-4 h-4 text-red-400" />,
    warning: <AlertTriangle className="w-4 h-4 text-amber-400" />,
  };

  const bgMap = {
    success: "bg-green-500/10 border-green-500/20",
    error: "bg-red-500/10 border-red-500/20",
    warning: "bg-amber-500/10 border-amber-500/20",
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none"
        aria-live="polite"
        role="alert"
      >
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className={`pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-lg backdrop-blur-md ${bgMap[t.type]} min-w-[200px] max-w-[90vw]`}
            >
              {iconMap[t.type]}
              <span className="text-xs font-semibold text-foreground flex-1">{t.message}</span>
              <button
                onClick={() => remove(t.id)}
                className="p-0.5 text-muted-foreground hover:text-foreground cursor-pointer"
                aria-label="Cerrar notificación"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
