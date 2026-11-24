"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

export function SmoothListHeight({ children }: { children: ReactNode }) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number>();
  const reduced = useReducedMotion();

  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content || !window.ResizeObserver) return;
    const observer = new ResizeObserver(() => setHeight(content.offsetHeight));
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  return (
    <motion.div
      data-list-height
      initial={false}
      animate={{ height: reduced || height === undefined ? "auto" : height }}
      transition={{ duration: reduced ? 0 : 0.36, ease: [0.22, 1, 0.36, 1] }}
      className="overflow-clip"
    >
      <div ref={contentRef} className="flow-root">{children}</div>
    </motion.div>
  );
}
