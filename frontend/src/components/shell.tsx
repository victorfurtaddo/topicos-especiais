"use client";

import { IconArrowsExchange, IconCalculator, IconChartBar, IconLayoutGrid, IconLayoutGridFilled, IconWallet } from "@tabler/icons-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import Image from "next/image";

const hoverWidth = 100;

const links = [
  { href: "/", label: "Visão geral", icon: IconLayoutGrid },
  { href: "/transactions", label: "Transações", icon: IconArrowsExchange },
  { href: "/insights", label: "Análise de gastos", icon: IconChartBar },
  { href: "/simulator", label: "Simulador", icon: IconCalculator },
];

function SidebarLinks({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();

  return (
    <nav className="sidebar-links" aria-label="Navegação principal">
      {links.map(({ href, label, icon: Icon }) => (
        <Link key={href} href={href} onNavigate={onNavigate} aria-current={path === href ? "page" : undefined} title={label}>
          <Icon size={17} className="shrink-0" aria-hidden />
          <span className="label">{label}</span>
        </Link>
      ))}
    </nav>
  );
}

function BrandMark() {
  return <Image src="/logo/icon.svg" alt="logo " width="50" height="50" className="size-9" />;
}

export function Shell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebar, setSidebar] = useState<"full" | "held" | "auto">("full");
  const [preview, setPreview] = useState(false);
  const pointerInside = useRef(false);
  const expanded = sidebar === "full";
  const mode = expanded ? "full" : sidebar === "held" || preview ? "compact" : "hidden";

  useEffect(() => {
    const root = document.documentElement;
    const scrollTimers = new Map<Element, number>();
    // Algumas barras nativas não entregam eventos ao passar sobre o trilho.
    // A margem interna permite iniciar a revelação antes de chegar nele.
    function revealScrollbar(event: globalThis.PointerEvent) {
      if (event.pointerType !== "mouse") return;
      const vertical = window.innerWidth > root.clientWidth && event.clientX >= root.clientWidth - 12;
      const horizontal = window.innerHeight > root.clientHeight && event.clientY >= root.clientHeight - 12;
      root.toggleAttribute("data-scrollbar-near", vertical || horizontal);
    }
    function revealWhileScrolling(event: Event) {
      const target = event.target === document ? root : event.target;
      if (!(target instanceof Element)) return;
      if (target !== root && !target.matches('.desktop-sidebar-content, [data-slot="table-container"], [data-slot="dialog-content"]')) return;

      window.clearTimeout(scrollTimers.get(target));
      target.setAttribute("data-scrollbar-scrolling", "");
      scrollTimers.set(
        target,
        window.setTimeout(() => {
          target.removeAttribute("data-scrollbar-scrolling");
          scrollTimers.delete(target);
        }, 650),
      );
    }

    const reset = () => {
      root.removeAttribute("data-scrollbar-near");
      for (const [target, timer] of scrollTimers) {
        window.clearTimeout(timer);
        target.removeAttribute("data-scrollbar-scrolling");
      }
      scrollTimers.clear();
    };
    window.addEventListener("pointermove", revealScrollbar, { passive: true });
    window.addEventListener("blur", reset);
    document.addEventListener("scroll", revealWhileScrolling, { capture: true, passive: true });
    return () => {
      window.removeEventListener("pointermove", revealScrollbar);
      window.removeEventListener("blur", reset);
      document.removeEventListener("scroll", revealWhileScrolling, true);
      reset();
    };
  }, []);

  function updateHover(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse") return;

    const inside = event.clientX < hoverWidth;
    if (inside === pointerInside.current) return;

    pointerInside.current = inside;
    setPreview(inside);
    if (inside && sidebar === "held") setSidebar("auto");
  }

  return (
    <div className="shell p-3" data-mode={mode}>
      {/* filtro gooey */}
      <svg className="absolute size-0" aria-hidden focusable="false">
        <defs>
          <filter id="goo" x="-30%" y="-5%" width="160%" height="110%" colorInterpolationFilters="sRGB">
            <feGaussianBlur in="SourceGraphic" stdDeviation="9" result="blur" />
            <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -10" />
          </filter>
        </defs>
      </svg>

      <div
        className="desktop-menu-control"
        style={{ "--hover-width": `${hoverWidth}px` } as CSSProperties}
        onPointerEnter={updateHover}
        onPointerMove={updateHover}
        onPointerLeave={() => {
          pointerInside.current = false;
          setPreview(false);
        }}
      >
        {/* barra + orelhinha + bolha do painel (só visual) */}
        <div className="goo" aria-hidden>
          <span className="goo-bar" />
          <span className="goo-blob" />
          <span className="goo-tab" />
        </div>

        <button type="button" className="edge-tab" aria-label={expanded ? "Recolher menu" : "Expandir menu"} aria-controls="desktop-sidebar" aria-expanded={expanded} onClick={() => setSidebar(expanded ? "held" : "full")}>
          {!expanded ? <IconLayoutGrid size={12} aria-hidden /> : <IconLayoutGridFilled size={12} aria-hidden />}
          <span>Menu</span>
        </button>

        <aside id="desktop-sidebar" className="desktop-sidebar" aria-label="FinScope" inert={mode === "hidden"}>
          <div className="desktop-sidebar-content">
            <Link href="/" className="brand">
              <BrandMark />
              <span className="label">FinScope</span>
            </Link>

            <SidebarLinks />
          </div>
        </aside>
      </div>

      <div className="main">
        <div className="mobile-nav">
          <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
            <DialogTrigger render={<Button variant="ghost" className="menu-tab" aria-label="Abrir menu" />}>
              <IconLayoutGrid aria-hidden />
              <span>Menu</span>
            </DialogTrigger>
            <DialogContent className="sidebar-drawer">
              <DialogTitle className="brand">
                <BrandMark />
                FinScope
              </DialogTitle>
              <SidebarLinks onNavigate={() => setMenuOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>

        <main id="main">{children}</main>
        <footer
          onPointerMove={(event) => {
            if (event.pointerType === "touch") return;
            const x = event.clientX - event.currentTarget.getBoundingClientRect().left;
            event.currentTarget.style.setProperty("--footer-pointer-x", `${x}px`);
          }}
        >
          FinScope <span>Valores em reais · Horário de São Paulo</span>
        </footer>
      </div>
    </div>
  );
}

