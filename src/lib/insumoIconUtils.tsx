import {
  Wheat,
  Milk,
  Beef,
  Apple,
  Carrot,
  Droplets,
  Cookie,
  Candy,
  Egg,
  Fish,
  Nut,
  Citrus,
  Banana,
  Cherry,
  Grape,
  Leaf,
  Coffee,
  Wine,
  Beer,
  Sparkles,
  Flame,
  Snowflake,
  Package,
  Box,
  type LucideIcon,
} from 'lucide-react';

interface InsumoCategory {
  icon: LucideIcon;
  keywords: string[];
  color: string;
}

const INSUMO_CATEGORIES: InsumoCategory[] = [
  // Grãos e farinhas
  {
    icon: Wheat,
    keywords: ['farinha', 'trigo', 'aveia', 'arroz', 'milho', 'fuba', 'fubá', 'amido', 'polvilho', 'tapioca', 'maizena', 'centeio', 'cevada', 'quinoa', 'granola', 'cereal', 'pão', 'massa'],
    color: 'text-amber-600',
  },
  // Laticínios
  {
    icon: Milk,
    keywords: ['leite', 'nata', 'creme', 'queijo', 'requeijão', 'iogurte', 'manteiga', 'margarina', 'ricota', 'cottage', 'mussarela', 'parmesão', 'gorgonzola', 'cream cheese', 'chantilly', 'condensado', 'lácteo'],
    color: 'text-blue-400',
  },
  // Ovos
  {
    icon: Egg,
    keywords: ['ovo', 'ovos', 'gema', 'clara'],
    color: 'text-yellow-500',
  },
  // Carnes
  {
    icon: Beef,
    keywords: ['carne', 'boi', 'vaca', 'frango', 'porco', 'bacon', 'linguiça', 'salsicha', 'presunto', 'peito', 'coxa', 'hamburguer', 'hamburger', 'blend', 'patinho', 'alcatra', 'picanha', 'costela', 'lombo', 'bisteca', 'copa', 'calabresa', 'salame', 'mortadela', 'tender', 'pernil'],
    color: 'text-red-500',
  },
  // Peixes e frutos do mar
  {
    icon: Fish,
    keywords: ['peixe', 'salmão', 'atum', 'tilápia', 'bacalhau', 'camarão', 'lula', 'polvo', 'marisco', 'mexilhão', 'sardinha', 'anchova'],
    color: 'text-cyan-500',
  },
  // Frutas cítricas
  {
    icon: Citrus,
    keywords: ['limão', 'laranja', 'tangerina', 'mexerica', 'lima', 'cidra', 'bergamota', 'pomelo', 'grapefruit', 'citrico', 'cítrico'],
    color: 'text-yellow-400',
  },
  // Banana
  {
    icon: Banana,
    keywords: ['banana'],
    color: 'text-yellow-500',
  },
  // Cerejas e frutas vermelhas
  {
    icon: Cherry,
    keywords: ['cereja', 'morango', 'framboesa', 'amora', 'mirtilo', 'blueberry', 'cranberry', 'frutas vermelhas', 'goiaba'],
    color: 'text-red-400',
  },
  // Uva
  {
    icon: Grape,
    keywords: ['uva', 'passas', 'passa'],
    color: 'text-purple-500',
  },
  // Outras frutas
  {
    icon: Apple,
    keywords: ['maçã', 'maca', 'pera', 'pêssego', 'pessego', 'manga', 'abacaxi', 'melão', 'melancia', 'mamão', 'kiwi', 'caqui', 'figo', 'açaí', 'acai', 'cupuaçu', 'jabuticaba', 'ameixa', 'damasco', 'frutas', 'fruta'],
    color: 'text-red-400',
  },
  // Vegetais/legumes
  {
    icon: Carrot,
    keywords: ['cenoura', 'batata', 'mandioca', 'aipim', 'beterraba', 'abóbora', 'abobrinha', 'berinjela', 'chuchu', 'inhame', 'cará', 'nabo', 'rabanete', 'legume'],
    color: 'text-orange-500',
  },
  // Folhas e ervas
  {
    icon: Leaf,
    keywords: ['alface', 'rúcula', 'agrião', 'espinafre', 'couve', 'repolho', 'brócolis', 'coentro', 'salsa', 'salsinha', 'cebolinha', 'manjericão', 'orégano', 'alecrim', 'tomilho', 'louro', 'hortelã', 'menta', 'erva', 'tempero', 'tomate', 'cebola', 'alho', 'gengibre', 'pimentão', 'pimenta', 'pepino'],
    color: 'text-green-500',
  },
  // Castanhas e nozes
  {
    icon: Nut,
    keywords: ['castanha', 'nozes', 'noz', 'amêndoa', 'amendoim', 'pistache', 'avelã', 'macadâmia', 'pecã', 'coco', 'gergelim', 'semente', 'linhaça', 'chia'],
    color: 'text-amber-700',
  },
  // Chocolates e doces
  {
    icon: Cookie,
    keywords: ['chocolate', 'cacau', 'biscoito', 'bolacha', 'cookie', 'brownie', 'brigadeiro', 'nutella', 'creme de avelã'],
    color: 'text-amber-800',
  },
  // Açúcares e adoçantes
  {
    icon: Candy,
    keywords: ['açúcar', 'acucar', 'mel', 'melado', 'rapadura', 'glucose', 'xarope', 'maple', 'demerara', 'mascavo', 'cristal', 'refinado', 'adoçante', 'stevia', 'eritritol', 'xilitol', 'caramelo'],
    color: 'text-pink-400',
  },
  // Óleos e gorduras
  {
    icon: Droplets,
    keywords: ['óleo', 'oleo', 'azeite', 'gordura', 'banha', 'ghee'],
    color: 'text-yellow-600',
  },
  // Café
  {
    icon: Coffee,
    keywords: ['café', 'cafe', 'expresso', 'cappuccino', 'chá', 'cha'],
    color: 'text-amber-900',
  },
  // Vinhos e bebidas
  {
    icon: Wine,
    keywords: ['vinho', 'champagne', 'espumante', 'prosecco', 'licor', 'rum', 'conhaque', 'brandy', 'vodka', 'gin'],
    color: 'text-red-700',
  },
  // Cervejas
  {
    icon: Beer,
    keywords: ['cerveja', 'chopp', 'malte', 'lúpulo'],
    color: 'text-amber-500',
  },
  // Fermentos e químicos
  {
    icon: Sparkles,
    keywords: ['fermento', 'bicarbonato', 'essência', 'corante', 'aromatizante', 'emulsificante', 'gelatina', 'ágar', 'agar', 'pectina', 'goma', 'lecitina'],
    color: 'text-purple-400',
  },
  // Congelados
  {
    icon: Snowflake,
    keywords: ['congelado', 'sorvete', 'gelo', 'picolé'],
    color: 'text-blue-300',
  },
  // Temperos picantes/especiarias
  {
    icon: Flame,
    keywords: ['páprica', 'curry', 'cominho', 'canela', 'cravo', 'noz moscada', 'cardamomo', 'açafrão', 'cúrcuma', 'mostarda', 'wasabi', 'molho', 'ketchup', 'maionese', 'shoyu', 'vinagre', 'sal'],
    color: 'text-orange-600',
  },
];

// Ícone padrão para quando não encontrar categoria
const DEFAULT_CATEGORY = {
  icon: Package,
  color: 'text-muted-foreground',
};

/**
 * Identifica a categoria do insumo baseado no nome e retorna o ícone apropriado
 */
export function getInsumoIcon(nome: string): { icon: LucideIcon; color: string } {
  const nomeLower = nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  for (const category of INSUMO_CATEGORIES) {
    for (const keyword of category.keywords) {
      const keywordNormalized = keyword.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (nomeLower.includes(keywordNormalized)) {
        return { icon: category.icon, color: category.color };
      }
    }
  }
  
  return DEFAULT_CATEGORY;
}

/**
 * Componente para renderizar o ícone do insumo
 */
export function InsumoIcon({ nome, className = 'h-4 w-4' }: { nome: string; className?: string }) {
  const { icon: Icon, color } = getInsumoIcon(nome);
  return <Icon className={`${className} ${color}`} />;
}
