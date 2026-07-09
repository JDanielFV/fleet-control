"use client";

import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle } from "lucide-react";

interface FieldErrorProps {
  message?: string | null;
}

export function FieldError({ message }: FieldErrorProps) {
  return (
    <AnimatePresence>
      {message && (
        <motion.p
          initial={{ opacity: 0, y: -4, height: 0 }}
          animate={{ opacity: 1, y: 0, height: "auto" }}
          exit={{ opacity: 0, y: -4, height: 0 }}
          transition={{ duration: 0.2 }}
          className="flex items-center gap-1 text-[11px] text-red-400 font-medium mt-1"
          role="alert"
        >
          <AlertTriangle className="w-3 h-3 shrink-0" />
          {message}
        </motion.p>
      )}
    </AnimatePresence>
  );
}
