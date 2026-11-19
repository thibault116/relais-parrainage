"use client";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { appendedMessageIds, motionTiming } from "@/lib/motion";
const MotionContext = createContext({ reduced: true, compact: true });
export const useMotionPreferences = () => useContext(MotionContext);
const keyboardActive = () =>
  document.activeElement?.matches("textarea,[contenteditable=true]") ||
  (matchMedia("(max-width:900px)").matches &&
    document.activeElement?.matches("input")) ||
  document.body.matches(
    ".owner-chat-keyboard,.private-keyboard,.community-keyboard",
  );
function play(
  el: HTMLElement,
  frames: Keyframe[],
  duration: number,
  delay = 0,
) {
  if (typeof el.animate !== "function") return;
  return el.animate(frames, {
    duration,
    delay,
    easing: motionTiming.ease,
    fill: "none",
  });
}
const cards =
  ".member-card,.service-catalog-card,.guide-card,.mobile-menu-category,.mobile-contact,.mobile-profile-tile,.commerce-card,.service-list>article";
const messages = ".community-thread,.mobile-dm-feed,.service-chat-feed";
export function MotionProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState({
    reduced: true,
    compact: true,
  });
  useEffect(() => {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)"),
      coarse = matchMedia("(pointer: coarse)");
    const read = () => {
      const n = navigator as Navigator & {
        deviceMemory?: number;
        connection?: { saveData?: boolean };
      };
      setPreferences({
        reduced:
          reduce.matches ||
          document.documentElement.dataset.reduceMotion === "true",
        compact:
          coarse.matches ||
          (n.deviceMemory !== undefined && n.deviceMemory <= 4) ||
          navigator.hardwareConcurrency <= 4 ||
          n.connection?.saveData === true,
      });
    };
    read();
    reduce.addEventListener("change", read);
    coarse.addEventListener("change", read);
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-reduce-motion"],
    });
    return () => {
      reduce.removeEventListener("change", read);
      coarse.removeEventListener("change", read);
      observer.disconnect();
    };
  }, []);
  useEffect(() => {
    if (preferences.reduced) return;
    const seen = new WeakSet<HTMLElement>(),
      animations = new Set<Animation>();
    let frame = 0;
    const queue = new Set<HTMLElement>();
    const animate = (
      el: HTMLElement,
      frames: Keyframe[],
      duration: number,
      delay = 0,
    ) => {
      const a = play(el, frames, duration, delay);
      if (a) {
        animations.add(a);
        a.finished.catch(() => {}).finally(() => animations.delete(a));
      }
    };
    const flush = () => {
      frame = 0;
      const batch = [...queue];
      queue.clear();
      if (keyboardActive()) return;
      batch.slice(0, preferences.compact ? 12 : 24).forEach((el, i) => {
        if (!el.isConnected || el.closest(messages)) return;
        animate(
          el,
          [
            { opacity: 0.35, translate: "0 9px" },
            { opacity: 1, translate: "0 0" },
          ],
          motionTiming.panel,
          Math.min(i * 18, 100),
        );
      });
    };
    const visible = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            visible.unobserve(e.target);
            queue.add(e.target as HTMLElement);
          }
        });
        if (queue.size && !frame) frame = requestAnimationFrame(flush);
      },
      { threshold: 0.04 },
    );
    const register = (node: Element) => {
      const candidates = [
        ...(node.matches(cards) ? [node] : []),
        ...node.querySelectorAll(cards),
      ];
      candidates.forEach((e) => {
        if (!(e instanceof HTMLElement) || seen.has(e)) return;
        seen.add(e);
        visible.observe(e);
      });
    };
    register(document.body);
    const observer = new MutationObserver((records) => {
      records.forEach((record) => {
        if (record.type === "attributes") {
          const el = record.target;
          if (el instanceof HTMLDialogElement && el.open)
            animate(el, [{ opacity: 0.4 }, { opacity: 1 }], motionTiming.ui);
          return;
        }
        record.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          register(node);
          const panel = node.matches(".modal,.in-app-message,[role=status]")
            ? node
            : node.querySelector<HTMLElement>(".modal,.in-app-message");
          if (panel)
            animate(panel, [{ opacity: 0.3 }, { opacity: 1 }], motionTiming.ui);
        });
      });
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["open"],
    });
    return () => {
      observer.disconnect();
      visible.disconnect();
      cancelAnimationFrame(frame);
      animations.forEach((a) => a.cancel());
    };
  }, [preferences.reduced, preferences.compact]);
  return (
    <MotionContext.Provider value={preferences}>
      {children}
    </MotionContext.Provider>
  );
}
export function useScreenMotion(
  ref: RefObject<HTMLElement | null>,
  route: string,
  chat = false,
) {
  const { reduced } = useMotionPreferences();
  const previous = useRef(route);
  useEffect(() => {
    const changed = previous.current !== route;
    previous.current = route;
    const el = ref.current;
    if (
      !changed ||
      reduced ||
      !el ||
      keyboardActive() ||
      el.querySelector("[data-motion-surface]")
    )
      return;
    const a = play(
      el,
      [{ opacity: chat ? 0.72 : 0.4 }, { opacity: 1 }],
      chat ? motionTiming.quick : motionTiming.ui,
    );
    return () => a?.cancel();
  }, [ref, route, reduced, chat]);
}
export function useNavigationIndicator(
  ref: RefObject<HTMLElement | null>,
  selection: string,
  dock = false,
) {
  const { reduced } = useMotionPreferences();
  const old = useRef<
    DOMRect | { x: number; y: number; width: number; height: number } | null
  >(null);
  useEffect(() => {
    const nav = ref.current;
    if (!nav) return;
    const indicator = nav.querySelector<HTMLElement>(".motion-nav-indicator");
    if (!indicator) return;
    let active: Animation | undefined;
    const update = () => {
      const target = nav.querySelector<HTMLElement>("[aria-current=page]");
      if (!target) {
        indicator.hidden = true;
        return;
      }
      const n = nav.getBoundingClientRect(),
        b = target.getBoundingClientRect();
      const next = {
        x: b.left - n.left + nav.scrollLeft + (dock ? (b.width - 24) / 2 : 0),
        y: dock ? 4 : b.top - n.top + nav.scrollTop,
        width: dock ? 24 : b.width,
        height: dock ? 3 : b.height,
      };
      indicator.hidden = false;
      if (
        old.current &&
        ["x", "y", "width", "height"].every(
          (k) =>
            Math.abs(
              next[k as keyof typeof next] -
                old.current![k as keyof typeof next],
            ) < 0.5,
        )
      )
        return;
      indicator.style.width = `${next.width}px`;
      indicator.style.height = `${next.height}px`;
      indicator.style.transform = `translate3d(${next.x}px,${next.y}px,0)`;
      if (old.current && !reduced) {
        active?.cancel();
        active = play(
          indicator,
          [
            {
              transform: `translate3d(${old.current.x}px,${old.current.y}px,0) scale(${old.current.width / next.width},${old.current.height / next.height})`,
            },
            { transform: `translate3d(${next.x}px,${next.y}px,0) scale(1)` },
          ],
          motionTiming.panel,
        );
      }
      old.current = next;
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(nav);
    return () => {
      observer.disconnect();
      if (active?.playState === "running") {
        const n = nav.getBoundingClientRect(),
          r = indicator.getBoundingClientRect();
        old.current = {
          x: r.left - n.left + nav.scrollLeft,
          y: r.top - n.top + nav.scrollTop,
          width: r.width,
          height: r.height,
        };
      }
      active?.cancel();
    };
  }, [ref, selection, dock, reduced]);
}
export function useMessageArrival(
  ref: RefObject<HTMLElement | null>,
  ids: readonly string[],
  conversation: string,
  ready = true,
) {
  const { reduced } = useMotionPreferences(),
    previous = useRef<{ conversation: string; ids: readonly string[] }>({
      conversation,
      ids: [],
    });
  const signature = ids.join("|");
  useEffect(() => {
    if (!ready) return;
    const before = previous.current;
    previous.current = { conversation, ids: [...ids] };
    if (before.conversation !== conversation || reduced) return;
    const fresh = appendedMessageIds(before.ids, ids).slice(-4);
    const animations: Animation[] = [];
    fresh.forEach((id) => {
      const node = [
        ...(ref.current?.querySelectorAll<HTMLElement>(
          "[data-motion-message]",
        ) || []),
      ].find((el) => el.dataset.motionMessage === id);
      if (node) {
        const a = play(
          node,
          [{ opacity: 0.25 }, { opacity: 1 }],
          motionTiming.quick,
        );
        if (a) animations.push(a);
      }
    });
    return () => animations.forEach((a) => a.cancel());
  }, [ref, signature, conversation, ready, reduced]);
}
