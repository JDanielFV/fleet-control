"use client";

import { useState } from "react";
import { startRegistration } from "@simplewebauthn/browser";
import { motion, AnimatePresence } from "framer-motion";
import { Fingerprint, Shield, CheckCircle2, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PasskeyRegistrationDialogProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  userDisplayName: string;
  onSuccess: () => void;
  /** When true, the dialog cannot be dismissed — user must register a passkey */
  required?: boolean;
}

export default function PasskeyRegistrationDialog({
  open, onClose, userId, userName, userDisplayName, onSuccess, required = false,
}: PasskeyRegistrationDialogProps) {
  const [step, setStep] = useState<"idle" | "registering" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleRegister = async () => {
    setStep("registering");
    setErrorMsg("");

    try {
      // Step 1: Get registration options from server
      const optionsRes = await fetch("/api/webauthn/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: "options",
          userId,
          userName,
          userDisplayName,
        }),
      });

      if (!optionsRes.ok) {
        const err = await optionsRes.json();
        throw new Error(err.error || "Error al iniciar registro");
      }

      const options = await optionsRes.json();

      // Step 2: Use SimpleWebAuthn browser helper — handles all encoding
      const credential = await startRegistration({ optionsJSON: options });

      // Step 3: Send credential back to server for verification
      const verifyRes = await fetch("/api/webauthn/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: "verify",
          userId,
          credential,
        }),
      });

      if (!verifyRes.ok) {
        const err = await verifyRes.json();
        throw new Error(err.error || "Error al verificar passkey");
      }

      const result = await verifyRes.json();
      if (result.verified) {
        setStep("success");
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1500);
      } else {
        throw new Error("No se pudo verificar la passkey");
      }
    } catch (err: unknown) {
      console.error("Passkey registration error:", err);
      setErrorMsg(err instanceof Error ? err.message : "Error al registrar passkey");
      setStep("error");
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-[var(--z-toast)] backdrop-blur-sm"
            onClick={() => { if (step !== "registering" && !required) onClose(); }}
          />
          <div className="fixed inset-0 z-[var(--z-toast)] flex items-center justify-center p-4 pointer-events-none modal-safe-area">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl p-5 pointer-events-auto"
            >
              <div className="flex items-start gap-3 mb-4">
                <div className={`p-2.5 rounded-xl shrink-0 ${
                  step === "success" ? "bg-emerald-500/10" :
                  step === "error" ? "bg-red-500/10" :
                  "bg-primary/10"
                }`}>
                  {step === "success" ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  ) : step === "error" ? (
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                  ) : (
                    <Fingerprint className="w-5 h-5 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-black text-foreground">
                    {step === "success" ? "¡Passkey registrada!" :
                     step === "error" ? "Error al registrar" :
                     "Registrar passkey"}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {step === "success" ? "Ya puedes iniciar sesión con tu huella o rostro." :
                     step === "error" ? errorMsg :
                     `Registra una passkey para ${userDisplayName}. Usarás tu huella, rostro o PIN para iniciar sesión.`}
                  </p>
                </div>
                {step !== "registering" && !required && (
                  <button onClick={onClose} className="p-1 -mr-1 -mt-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {step === "idle" && (
                <div className="space-y-3">
                  <div className="bg-muted/20 rounded-xl p-4 border border-border/60">
                    <div className="flex items-center gap-3">
                      <Shield className="w-8 h-8 text-primary/60" />
                      <div className="text-xs text-muted-foreground leading-relaxed">
                        La passkey se almacena de forma segura en este dispositivo.
                        Podrás iniciar sesión sin necesidad de contraseña.
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {!required && (
                      <Button variant="outline" onClick={onClose} className="flex-1 rounded-xl border-border">
                        Omitir
                      </Button>
                    )}
                    <Button onClick={handleRegister} className="flex-1 rounded-xl bg-primary text-white font-bold hover:bg-primary/90">
                      <Fingerprint className="w-4 h-4 mr-1.5" /> Registrar
                    </Button>
                  </div>
                </div>
              )}

              {step === "registering" && (
                <div className="flex flex-col items-center py-6 gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Fingerprint className="w-6 h-6 text-primary animate-pulse" />
                  </div>
                  <p className="text-xs text-muted-foreground">Usa tu método de verificación...</p>
                </div>
              )}

              {step === "success" && (
                <div className="flex flex-col items-center py-4 gap-2">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                  <p className="text-xs text-muted-foreground">Redirigiendo...</p>
                </div>
              )}

              {step === "error" && (
                <Button onClick={handleRegister} className="w-full rounded-xl bg-primary text-white font-bold">
                  Intentar de nuevo
                </Button>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
