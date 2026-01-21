import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface AnimatedCardProps {
  children: React.ReactNode;
  className?: string;
  hoverScale?: number;
  hoverY?: number;
}

const AnimatedCard = React.forwardRef<HTMLDivElement, AnimatedCardProps>(
  ({ className, children, hoverScale = 1.02, hoverY = -4, ...props }, ref) => (
    <motion.div
      ref={ref}
      className={cn(
        "rounded-lg border bg-card text-card-foreground shadow-sm transition-shadow duration-200",
        className
      )}
      whileHover={{
        scale: hoverScale,
        y: hoverY,
        boxShadow: "0 8px 25px -5px rgba(0, 0, 0, 0.1), 0 4px 10px -5px rgba(0, 0, 0, 0.04)",
      }}
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 25,
      }}
      {...props}
    >
      {children}
    </motion.div>
  )
);
AnimatedCard.displayName = "AnimatedCard";

// Stagger container for animating multiple cards
interface AnimatedCardContainerProps {
  children: React.ReactNode;
  className?: string;
  staggerDelay?: number;
}

const AnimatedCardContainer = React.forwardRef<HTMLDivElement, AnimatedCardContainerProps>(
  ({ className, children, staggerDelay = 0.1 }, ref) => (
    <motion.div
      ref={ref}
      className={className}
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: staggerDelay,
          },
        },
      }}
    >
      {children}
    </motion.div>
  )
);
AnimatedCardContainer.displayName = "AnimatedCardContainer";

// Individual card with stagger animation
const StaggeredCard = React.forwardRef<HTMLDivElement, AnimatedCardProps>(
  ({ className, children, hoverScale = 1.02, hoverY = -4 }, ref) => (
    <motion.div
      ref={ref}
      className={cn(
        "rounded-lg border bg-card text-card-foreground shadow-sm",
        className
      )}
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 },
      }}
      whileHover={{
        scale: hoverScale,
        y: hoverY,
        boxShadow: "0 8px 25px -5px rgba(0, 0, 0, 0.1), 0 4px 10px -5px rgba(0, 0, 0, 0.04)",
      }}
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 25,
      }}
    >
      {children}
    </motion.div>
  )
);
StaggeredCard.displayName = "StaggeredCard";

export { AnimatedCard, AnimatedCardContainer, StaggeredCard };
