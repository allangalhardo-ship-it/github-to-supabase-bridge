import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { ProdutoAnalise, QuadranteMenu, formatCurrency, formatPercent } from './types';
import { useIsMobile } from '@/hooks/use-mobile';

interface MatrizScatterProps {
  produtos: ProdutoAnalise[];
  quadranteSelecionado: QuadranteMenu | null;
  onSelectProduto: (produto: ProdutoAnalise) => void;
  margemAlvo: number;
}

const CORES_QUADRANTE: Record<QuadranteMenu, string> = {
  'estrela': '#f59e0b',      // amber-500
  'burro-de-carga': '#f97316', // orange-500
  'desafio': '#3b82f6',      // blue-500
  'cao': '#ef4444',          // red-500
};

const MatrizScatter: React.FC<MatrizScatterProps> = ({
  produtos,
  quadranteSelecionado,
  onSelectProduto,
  margemAlvo,
}) => {
  const isMobile = useIsMobile();

  // Calcular medianas para as linhas de referência
  const { medianaMargens, medianaQuantidades, dadosGrafico } = useMemo(() => {
    const margens = produtos.map(p => p.margemContribuicao);
    const qtds = produtos.map(p => p.quantidadeVendida);
    
    const sortedMargens = [...margens].sort((a, b) => a - b);
    const sortedQtds = [...qtds].sort((a, b) => a - b);
    
    const medianaMargens = sortedMargens[Math.floor(sortedMargens.length / 2)] || margemAlvo;
    const medianaQuantidades = sortedQtds[Math.floor(sortedQtds.length / 2)] || 0;

    const dadosGrafico = produtos.map(p => ({
      x: p.quantidadeVendida,
      y: p.margemContribuicao,
      nome: p.nome,
      preco: p.preco_venda,
      quadrante: p.quadrante,
      id: p.id,
      produto: p,
    }));

    return { medianaMargens, medianaQuantidades, dadosGrafico };
  }, [produtos, margemAlvo]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.[0]) return null;
    const data = payload[0].payload;
    
    return (
      <div className="bg-popover border rounded-lg shadow-lg p-3 text-sm">
        <p className="font-semibold mb-1">{data.nome}</p>
        <div className="space-y-0.5 text-muted-foreground text-xs">
          <p>Preço: <span className="text-foreground font-medium">{formatCurrency(data.preco)}</span></p>
          <p>Margem: <span className="text-foreground font-medium">{formatPercent(data.y)}</span></p>
          <p>Vendas (30d): <span className="text-foreground font-medium">{data.x} un</span></p>
        </div>
      </div>
    );
  };

  const handleClick = (data: any) => {
    if (data?.produto) {
      onSelectProduto(data.produto);
    }
  };

  if (produtos.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          📊 Matriz de Produtos
          <span className="text-xs font-normal text-muted-foreground">
            (clique em um ponto para detalhes)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2">
        <div className={isMobile ? "h-[250px]" : "h-[350px]"}>
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 20, bottom: 40, left: 20 }}>
              <XAxis
                type="number"
                dataKey="x"
                name="Vendas"
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                label={{
                  value: 'Popularidade (vendas 30d)',
                  position: 'bottom',
                  offset: 20,
                  style: { fontSize: 11, fill: 'hsl(var(--muted-foreground))' }
                }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name="Margem"
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickFormatter={(v) => `${v.toFixed(0)}%`}
                label={{
                  value: 'Margem %',
                  angle: -90,
                  position: 'insideLeft',
                  offset: 10,
                  style: { fontSize: 11, fill: 'hsl(var(--muted-foreground))' }
                }}
              />
              
              {/* Linhas de referência das medianas */}
              <ReferenceLine
                x={medianaQuantidades}
                stroke="hsl(var(--border))"
                strokeDasharray="5 5"
              />
              <ReferenceLine
                y={medianaMargens}
                stroke="hsl(var(--border))"
                strokeDasharray="5 5"
              />
              
              <Tooltip content={<CustomTooltip />} />
              
              <Scatter
                data={dadosGrafico}
                onClick={handleClick}
                cursor="pointer"
              >
                {dadosGrafico.map((entry, index) => {
                  const isFiltered = quadranteSelecionado && entry.quadrante !== quadranteSelecionado;
                  return (
                    <Cell
                      key={`cell-${index}`}
                      fill={CORES_QUADRANTE[entry.quadrante]}
                      opacity={isFiltered ? 0.2 : 0.8}
                      r={isMobile ? 6 : 8}
                    />
                  );
                })}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        {/* Legenda */}
        <div className="flex flex-wrap justify-center gap-3 mt-2 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <span>Estrelas</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-orange-500" />
            <span>Burros</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span>Desafios</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span>Cães</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default MatrizScatter;
