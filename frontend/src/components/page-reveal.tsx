"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

const targets = [
  ":scope > :not([data-page-intro], .dashboard-hero, .sr-only)",
  "[data-page-reveal]",
  "[data-page-intro] > *",
].join(", ");

export function PageReveal({ children, dashboard = false }: { children: ReactNode; dashboard?: boolean }) {
  const scope = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = scope.current;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!root || preference.matches || !Element.prototype.animate || !window.IntersectionObserver) return;

    const animations = new Map<HTMLElement, Animation>();
    const seen = new WeakSet<HTMLElement>();
    const observer = new IntersectionObserver((entries) => {
      let order = 0;
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const element = entry.target as HTMLElement;
        const animation = animations.get(element);
        if (animation) {
          animation.effect?.updateTiming({ delay: Math.min(order++ * 65, 325) });
          animation.play();
        }
        observer.unobserve(element);
      }
    }, { threshold: 0.05 });

    function reveal(element: HTMLElement) {
      animations.get(element)?.cancel();
      animations.delete(element);
      observer.unobserve(element);
    }

    const register = () => {
      if (preference.matches) return;
      for (const element of root.querySelectorAll<HTMLElement>(targets)) {
        if (seen.has(element)) continue;
        seen.add(element);
        if (element.contains(document.activeElement)) continue;

        const animation = element.animate([
          { opacity: 0, filter: "blur(8px)", transform: "translateY(14px)" },
          { opacity: 1, filter: "blur(0px)", transform: "translateY(0px)" },
        ], {
          duration: 650,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          fill: "both",
        });
        animation.pause();
        animation.onfinish = () => reveal(element);
        animations.set(element, animation);
        observer.observe(element);
      }
    };

    const mutations = new MutationObserver(() => {
      for (const element of animations.keys()) {
        if (!root.contains(element)) reveal(element);
      }
      register();
    });

    function revealAll() {
      for (const element of animations.keys()) reveal(element);
    }

    function onPreferenceChange() {
      if (preference.matches) revealAll();
    }

    function onFocus(event: FocusEvent) {
      if (!(event.target instanceof Node)) return;
      for (const element of animations.keys()) {
        if (element.contains(event.target)) reveal(element);
      }
    }

    register();
    mutations.observe(root, { childList: true, subtree: true });
    preference.addEventListener("change", onPreferenceChange);
    root.addEventListener("focusin", onFocus);
    return () => {
      mutations.disconnect();
      observer.disconnect();
      revealAll();
      preference.removeEventListener("change", onPreferenceChange);
      root.removeEventListener("focusin", onFocus);
    };
  }, []);

  return <div className={dashboard ? "page-reveal dashboard-reveal" : "page-reveal"} ref={scope}>{children}</div>;
}
