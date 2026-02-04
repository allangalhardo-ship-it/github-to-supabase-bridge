import React, { useState } from 'react';
import { 
  ReportCard, 
  DREGerencial, 
  AnaliseVendas, 
  MargensRelatorio,
  FluxoCaixa,
  PosicaoEstoque,
  PerdasDesperdicio
} from '@/components/relatorios';
import { 
  FileText, 
  TrendingUp, 
  ShoppingCart, 
  Package, 
  Wallet, 
  AlertTriangle
} from 'lucide-react';

type ReportView = 'hub' | 'dre' | 'vendas' | 'margens' | 'estoque' | 'fluxo' | 'perdas';

const Relatorios = () => {
  const [currentView, setCurrentView] = useState<ReportView>('hub');

  // Renderizar o relatório selecionado
  if (currentView === 'dre') {
    return <DREGerencial onBack={() => setCurrentView('hub')} />;
  }

  if (currentView === 'vendas') {
    return <AnaliseVendas onBack={() => setCurrentView('hub')} />;
  }

  if (currentView === 'margens') {
    return <MargensRelatorio onBack={() => setCurrentView('hub')} />;
  }

  if (currentView === 'fluxo') {
    return <FluxoCaixa onBack={() => setCurrentView('hub')} />;
  }

  if (currentView === 'estoque') {
    return <PosicaoEstoque onBack={() => setCurrentView('hub')} />;
  }

  if (currentView === 'perdas') {
    return <PerdasDesperdicio onBack={() => setCurrentView('hub')} />;
  }

  // Hub da Central de Relatórios
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Central de Relatórios</h1>
        <p className="text-muted-foreground">
          Escolha um relatório para visualizar informações detalhadas do seu negócio
        </p>
      </div>

      {/* Relatórios Financeiros */}
      <section>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          Relatórios Financeiros
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Para saber se o negócio está dando dinheiro
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <ReportCard
            title="DRE Gerencial"
            description="Demonstrativo de Resultados: veja se teve lucro ou prejuízo e para onde seu dinheiro está indo"
            icon={FileText}
            category="financeiro"
            onClick={() => setCurrentView('dre')}
          />
          <ReportCard
            title="Fluxo de Caixa"
            description="Entradas e saídas de dinheiro: acompanhe a evolução do seu saldo"
            icon={Wallet}
            category="financeiro"
            onClick={() => setCurrentView('fluxo')}
          />
        </div>
      </section>

      {/* Relatórios de Vendas */}
      <section>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          Relatórios de Vendas
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Para entender o comportamento das vendas e dos produtos
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <ReportCard
            title="Análise de Vendas"
            description="Faturamento, ticket médio, ranking de produtos e vendas por canal e dia da semana"
            icon={ShoppingCart}
            category="vendas"
            onClick={() => setCurrentView('vendas')}
          />
          <ReportCard
            title="Análise de Margens"
            description="Rentabilidade por produto e canal: identifique seus produtos campeões e os que precisam de atenção"
            icon={TrendingUp}
            category="vendas"
            onClick={() => setCurrentView('margens')}
          />
        </div>
      </section>

      {/* Relatórios de Estoque e Operação */}
      <section>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-amber-500" />
          Relatórios de Estoque e Operação
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Para controlar a produção e evitar desperdícios
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <ReportCard
            title="Posição de Estoque"
            description="Valor do estoque, insumos em baixa e produtos próximos ao vencimento"
            icon={Package}
            category="operacional"
            onClick={() => setCurrentView('estoque')}
          />
          <ReportCard
            title="Perdas e Desperdícios"
            description="Identifique onde o dinheiro está sendo perdido na operação"
            icon={AlertTriangle}
            category="operacional"
            onClick={() => setCurrentView('perdas')}
          />
        </div>
      </section>
    </div>
  );
};

export default Relatorios;
