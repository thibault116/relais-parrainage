"use client";
import {
  useEffect,
  useRef,
  type RefObject,
  type PointerEvent,
  type KeyboardEvent,
} from "react";

const key = "mentora-suggestion-position";
export function useDraggableLauncher(ref: RefObject<HTMLButtonElement | null>) {
  const drag = useRef<{
    id: number;
    x: number;
    y: number;
    left: number;
    top: number;
    moved: boolean;
  } | null>(null);
  const suppressClick = useRef(false);
  const frame = useRef<number | null>(null);
  const position = useRef<{ x: number; y: number } | null>(null);
  function place(x: number, y: number) {
    const button = ref.current;
    if (!button) return;
    const viewport = window.visualViewport;
    const width = viewport?.width || window.innerWidth;
    const height = viewport?.height || window.innerHeight;
    const left = Math.max(8, Math.min(x, width - button.offsetWidth - 8));
    const top = Math.max(8, Math.min(y, height - button.offsetHeight - 8));
    button.style.left = `${left}px`;
    button.style.top = `${top}px`;
    button.style.right = "auto";
    button.style.bottom = "auto";
    position.current = { x: left, y: top };
  }
  function save() {
    if (!position.current) return;
    try {
      localStorage.setItem(key, JSON.stringify(position.current));
    } catch {
      /* Position is optional. */
    }
  }
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || "null");
      if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y))
        place(saved.x, saved.y);
    } catch {
      /* Use the default corner when storage is unavailable. */
    }
    const resize = () => {
      if (position.current) place(position.current.x, position.current.y);
    };
    window.addEventListener("resize", resize);
    window.visualViewport?.addEventListener("resize", resize);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      window.removeEventListener("resize", resize);
      window.visualViewport?.removeEventListener("resize", resize);
    };
  }, [ref]);
  return {
    onPointerDown(e: PointerEvent<HTMLButtonElement>) {
      if (!e.isPrimary || e.button !== 0) return;
      const rect = e.currentTarget.getBoundingClientRect();
      suppressClick.current = false;
      drag.current = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        left: rect.left,
        top: rect.top,
        moved: false,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerMove(e: PointerEvent<HTMLButtonElement>) {
      const start = drag.current;
      if (!start || start.id !== e.pointerId) return;
      const dx = e.clientX - start.x,
        dy = e.clientY - start.y;
      if (!start.moved && Math.hypot(dx, dy) < 6) return;
      start.moved = true;
      suppressClick.current = true;
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => {
        place(start.left + dx, start.top + dy);
        frame.current = null;
      });
    },
    onPointerUp(e: PointerEvent<HTMLButtonElement>) {
      const start = drag.current;
      if (!start || start.id !== e.pointerId) return;
      if (frame.current !== null) {
        cancelAnimationFrame(frame.current);
        frame.current = null;
      }
      if (start.moved) {
        place(
          start.left + e.clientX - start.x,
          start.top + e.clientY - start.y,
        );
        save();
      }
      drag.current = null;
      if (e.currentTarget.hasPointerCapture(e.pointerId))
        e.currentTarget.releasePointerCapture(e.pointerId);
    },
    onPointerCancel() {
      drag.current = null;
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      save();
    },
    onLostPointerCapture() {
      drag.current = null;
    },
    onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
      suppressClick.current = false;
      if (
        !e.altKey ||
        !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)
      )
        return;
      e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      place(
        rect.left +
          (e.key === "ArrowRight" ? 16 : e.key === "ArrowLeft" ? -16 : 0),
        rect.top + (e.key === "ArrowDown" ? 16 : e.key === "ArrowUp" ? -16 : 0),
      );
      save();
    },
    consumeDrag() {
      const moved = suppressClick.current;
      suppressClick.current = false;
      return moved;
    },
  };
}
