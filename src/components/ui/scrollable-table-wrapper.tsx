import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScrollableTableWrapperProps {
  children: React.ReactNode;
  className?: string;
}

export function ScrollableTableWrapper({
  children,
  className,
}: ScrollableTableWrapperProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [canScrollRight, setCanScrollRight] = React.useState(false);
  const [canScrollLeft, setCanScrollLeft] = React.useState(false);

  const checkScroll = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    const hasHorizontalScroll = el.scrollWidth > el.clientWidth;
    const isAtStart = el.scrollLeft <= 5;
    const isAtEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 5;

    setCanScrollLeft(hasHorizontalScroll && !isAtStart);
    setCanScrollRight(hasHorizontalScroll && !isAtEnd);
  }, []);

  React.useEffect(() => {
    checkScroll();
    window.addEventListener("resize", checkScroll);
    return () => window.removeEventListener("resize", checkScroll);
  }, [checkScroll]);

  React.useEffect(() => {
    // Re-check when children change
    const timer = setTimeout(checkScroll, 100);
    return () => clearTimeout(timer);
  }, [children, checkScroll]);

  return (
    <div className={cn("relative", className)}>
      {/* Gradiente da esquerda */}
      <div
        className={cn(
          "pointer-events-none absolute left-0 top-0 bottom-0 w-8 z-10 transition-opacity duration-200",
          "bg-gradient-to-r from-card to-transparent",
          canScrollLeft ? "opacity-100" : "opacity-0"
        )}
      />

      {/* Container com scroll */}
      <div
        ref={scrollRef}
        onScroll={checkScroll}
        className="overflow-x-auto -webkit-overflow-scrolling-touch"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {children}
      </div>

      {/* Gradiente e indicador da direita */}
      <div
        className={cn(
          "pointer-events-none absolute right-0 top-0 bottom-0 w-12 z-10 transition-opacity duration-200 flex items-center justify-end pr-1",
          "bg-gradient-to-l from-card via-card/80 to-transparent",
          canScrollRight ? "opacity-100" : "opacity-0"
        )}
      >
        <div className="animate-pulse flex items-center justify-center w-6 h-6 rounded-full bg-primary/20 text-primary">
          <ChevronRight className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}
