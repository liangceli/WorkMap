"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { getWorkMapApiAuthOptions } from "../../lib/api/apiAuth";

export function ReportsAccessGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function resolveAccess() {
      const auth = await getWorkMapApiAuthOptions();
      if (cancelled) return;

      if (auth.available && auth.role === "EMPLOYEE") {
        router.replace("/virtual-office");
        return;
      }

      setAllowed(true);
    }

    void resolveAccess();
    return () => { cancelled = true; };
  }, [router]);

  return allowed ? children : null;
}
