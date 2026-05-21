import { ReactNode } from "react";
import { BotChef, BotChefMood } from "@/components/brand/BotChef";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  mood?: BotChefMood;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const BOT_SIZE: Record<"sm" | "md" | "lg", "sm" | "md" | "lg"> = {
  sm: "sm",
  md: "md",
  lg: "lg",
};

/**
 * Empty state padrão com Bot Chef.
 * Use em telas/listas vazias pra deixar o app mais amigável.
 */
export const EmptyState = ({
  mood = "apresentando",
  title,
  description,
  action,
  className,
  size = "md",
}: EmptyStateProps) => {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center py-10 px-4 gap-3",
        className
      )}
    >
      <BotChef mood={mood} size={BOT_SIZE[size]} float />
      <div className="space-y-1 max-w-md">
        <h3 className="font-heading font-semibold text-lg text-foreground">
          {title}
        </h3>
        {description && (
          <p className="text-sm text-muted-foreground leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
};
