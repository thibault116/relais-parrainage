"use client";
import { useEffect, useState } from "react";
export function useOwnerBilling(enabled: boolean) {
  const [data, setData] = useState<{ plan: string; balance: number } | null>(
    null,
  );
  useEffect(() => {
    if (!enabled) {
      setData(null);
      return;
    }
    let live = true;
    const load = () =>
      fetch("/api/admin/monetization/summary", { cache: "no-store" })
        .then(async (r) => {
          if (r.ok && live) setData(await r.json());
        })
        .catch(() => {});
    void load();
    const timer = setInterval(load, 30000);
    window.addEventListener("focus", load);
    window.addEventListener("mentora-billing-updated", load);
    return () => {
      live = false;
      clearInterval(timer);
      window.removeEventListener("focus", load);
      window.removeEventListener("mentora-billing-updated", load);
    };
  }, [enabled]);
  return enabled ? data : null;
}
export function OwnerPlanBadge({ enabled }: { enabled: boolean }) {
  const d = useOwnerBilling(enabled);
  return d ? (
    <span className="owner-plan-badge">
      {(
        {
          free: "Free",
          starter: "Starter",
          plus: "Plus",
          pro: "Pro",
        } as Record<string, string>
      )[d.plan] || "Free"}
    </span>
  ) : null;
}
