"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { authClient } from "@/lib/auth-client";

const OwnerPreviewContext = createContext(false);

export function OwnerPreviewProvider({ initialUserId, children }: {
  initialUserId: string | null;
  children: ReactNode;
}) {
  const { data: session, isPending } = authClient.useSession();
  const [approvedUserId, setApprovedUserId] = useState(initialUserId);
  const userId = session?.user.id;
  useEffect(() => {
    if (isPending) return;
    if (!userId) {
      setApprovedUserId(null);
      return;
    }
    if (userId === approvedUserId) return;
    const controller = new AbortController();
    fetch("/api/admin/preview", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return null;
        const result = await response.json();
        return result.userId === userId ? userId : null;
      })
      .then((approved) => setApprovedUserId(approved))
      .catch(() => {});
    return () => controller.abort();
  }, [userId, isPending, approvedUserId]);

  const enabled = isPending ? initialUserId !== null : !!userId && userId === approvedUserId;
  return <OwnerPreviewContext.Provider value={enabled}>{children}</OwnerPreviewContext.Provider>;
}

export const useOwnerPreview = () => useContext(OwnerPreviewContext);
