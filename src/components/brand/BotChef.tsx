import { cn } from "@/lib/utils";
import principal from "@/assets/bot-chef/principal.png";
import apresentando from "@/assets/bot-chef/apresentando.png";
import pensando from "@/assets/bot-chef/pensando.png";
import alerta from "@/assets/bot-chef/alerta.png";
import dica from "@/assets/bot-chef/dica.png";
import celebrando from "@/assets/bot-chef/celebrando.png";
import analisando from "@/assets/bot-chef/analisando.png";
import explicando from "@/assets/bot-chef/explicando.png";
import grafico from "@/assets/bot-chef/grafico.png";

export type BotChefMood =
  | "principal"
  | "apresentando"
  | "pensando"
  | "alerta"
  | "dica"
  | "celebrando"
  | "analisando"
  | "explicando"
  | "grafico";

const MOODS: Record<BotChefMood, string> = {
  principal,
  apresentando,
  pensando,
  alerta,
  dica,
  celebrando,
  analisando,
  explicando,
  grafico,
};

const SIZES = {
  xs: "h-12 w-12",
  sm: "h-20 w-20",
  md: "h-32 w-32",
  lg: "h-48 w-48",
  xl: "h-64 w-64",
} as const;

interface BotChefProps {
  mood?: BotChefMood;
  size?: keyof typeof SIZES;
  className?: string;
  alt?: string;
  /** Adiciona uma leve animação de flutuação */
  float?: boolean;
}

export const BotChef = ({
  mood = "principal",
  size = "md",
  className,
  alt,
  float = false,
}: BotChefProps) => {
  return (
    <img
      src={MOODS[mood]}
      alt={alt ?? `Gi ${mood}`}
      className={cn(
        SIZES[size],
        "object-contain select-none pointer-events-none",
        float && "animate-bot-float",
        className
      )}
      draggable={false}
    />
  );
};
