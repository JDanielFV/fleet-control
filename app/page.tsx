"use client";

import { useEffect, useState } from "react";
import { getSession } from "@/lib/auth";
import LoginPage from "@/features/auth/components/LoginPage";
import Dashboard from "@/components/Dashboard";

export default function Home() {
  const [session, setSession] = useState<ReturnType<typeof getSession>>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.resolve().then(() => {
      setSession(getSession());
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-dvh w-screen bg-background">
        <div className="animate-pulse text-muted-foreground text-sm">Cargando...</div>
      </div>
    );
  }

  if (!session) {
    return <LoginPage />;
  }

  return <Dashboard />;
}
