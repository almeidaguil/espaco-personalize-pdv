"use client";

import { useEffect, useState } from "react";

export function OfflineStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function verifyConnection() {
      const nextIsOnline =
        navigator.onLine || (await canReachApplicationShell());

      if (isMounted) {
        setIsOnline(nextIsOnline);
      }
    }

    function handleOnline() {
      setIsOnline(true);
    }

    async function handleOffline() {
      const nextIsOnline = await canReachApplicationShell();

      if (isMounted) {
        setIsOnline(nextIsOnline);
      }
    }

    void verifyConnection();
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      isMounted = false;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (isOnline) {
    return null;
  }

  return (
    <div className="sticky top-0 z-50 border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-950">
      Sem conexao. Vendas, caixa e estoque ficam bloqueados ate a internet
      voltar.
    </div>
  );
}

async function canReachApplicationShell(): Promise<boolean> {
  try {
    const response = await fetch("/manifest.webmanifest", {
      cache: "no-store",
      method: "HEAD",
    });

    return response.ok;
  } catch {
    return false;
  }
}
