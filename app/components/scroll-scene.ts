"use client";
import { useEffect, type RefObject } from "react";
import { clamp, subscribeMotionFrame } from "@/lib/motion";
import { useMotionPreferences } from "./motion-system";
/** Native scrolling remains in charge; observers only control decorative transforms. */
export function useHeroScene(ref: RefObject<HTMLElement | null>) {
  const { reduced, compact } = useMotionPreferences();
  useEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;
    let unsubscribe: (() => void) | undefined;
    const measure = () => {
      const r = el.getBoundingClientRect(),
        p = clamp(-r.top / Math.max(r.height, 1));
      return () => el.style.setProperty("--hero-progress", String(p));
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        unsubscribe?.();
        unsubscribe = entry.isIntersecting
          ? subscribeMotionFrame(measure)
          : undefined;
      },
      { rootMargin: "100px" },
    );
    observer.observe(el);
    let frame = 0;
    const move = (e: PointerEvent) => {
      if (compact || e.pointerType !== "mouse") return;
      cancelAnimationFrame(frame);
      const r = el.getBoundingClientRect(),
        x = clamp((e.clientX - r.left) / r.width) * 2 - 1,
        y = clamp((e.clientY - r.top) / r.height) * 2 - 1;
      frame = requestAnimationFrame(() => {
        el.style.setProperty("--hero-pointer-x", String(x));
        el.style.setProperty("--hero-pointer-y", String(y));
      });
    };
    const leave = () => {
      cancelAnimationFrame(frame);
      el.style.setProperty("--hero-pointer-x", "0");
      el.style.setProperty("--hero-pointer-y", "0");
    };
    el.addEventListener("pointermove", move, { passive: true });
    el.addEventListener("pointerleave", leave);
    return () => {
      observer.disconnect();
      unsubscribe?.();
      cancelAnimationFrame(frame);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
      ["--hero-progress", "--hero-pointer-x", "--hero-pointer-y"].forEach((k) =>
        el.style.removeProperty(k),
      );
    };
  }, [ref, reduced, compact]);
}
