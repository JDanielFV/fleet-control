"use client";

import { useEffect, useState } from "react";
import { WifiOff, RefreshCw, Car } from "lucide-react";

export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, []);

  const handleRetry = () => {
    if (isOnline) {
      window.location.href = "/";
    } else {
      window.location.reload();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh w-screen bg-background px-6">
      {/* Icon */}
      <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-6">
        {isOnline ? (
          <Car className="w-10 h-10 text-primary" />
        ) : (
          <WifiOff className="w-10 h-10 text-muted-foreground" />
        )}
      </div>

      {/* Title */}
      <h1 className="text-xl font-black text-foreground text-center mb-2">
        {isOnline ? "Conexión restaurada" : "Sin conexión"}
      </h1>

      {/* Description */}
      <p className="text-sm text-muted-foreground text-center max-w-[280px] mb-8 leading-relaxed">
        {isOnline
          ? "Tu conexión a internet se ha restaurado. Toca el botón para continuar."
          : "No se pudo conectar al servidor. Verifica tu conexión a internet e intenta de nuevo."}
      </p>

      {/* Retry button */}
      <button
        onClick={handleRetry}
        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-all cursor-pointer active:scale-95 shadow-sm border-none"
      >
        <RefreshCw className="w-4 h-4" />
        {isOnline ? "Entrar" : "Reintentar"}
      </button>

      {/* Status indicator */}
      <div className="mt-8 flex items-center gap-2 text-xs text-muted-foreground">
        <span
          className={`w-2 h-2 rounded-full ${
            isOnline ? "bg-green-500" : "bg-red-400"
          }`}
        />
        {isOnline ? "En línea" : "Sin conexión"}
      </div>

      {/* Offline hint */}
      {!isOnline && (
        <p className="mt-4 text-[11px] text-muted-foreground/60 text-center max-w-[240px]">
          La app funciona sin internet una vez instalada. Algunos datos pueden
          estar desactualizados.
        </p>
      )}
    </div>
  );
}
