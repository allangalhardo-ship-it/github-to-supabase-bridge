import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Search, Loader2, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface MarketPriceSearchProps {
  productName: string;
  category: string | null;
  currentPrice: number;
  trigger: React.ReactNode;
}

interface SearchResult {
  result: string;
  citations: string[];
  productName: string;
  searchedAt: string;
}

const MarketPriceSearch = ({ productName, category, currentPrice, trigger }: MarketPriceSearchProps) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);

  const handleSearch = async () => {
    if (!city || !state) {
      toast({
        title: 'Preencha os campos',
        description: 'Informe a cidade e o estado para pesquisar.',
        variant: 'destructive',
      });
      return;
    }

    setIsSearching(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('search-market-price', {
        body: { productName, category, city, state },
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      setResult(data);
    } catch (error) {
      console.error('Error searching market price:', error);
      toast({
        title: 'Erro na pesquisa',
        description: error instanceof Error ? error.message : 'Não foi possível pesquisar os preços.',
        variant: 'destructive',
      });
    } finally {
      setIsSearching(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div onClick={() => setOpen(true)}>{trigger}</div>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Pesquisar Preço de Mercado
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-4 bg-muted rounded-lg">
            <p className="font-medium">{productName}</p>
            {category && <p className="text-sm text-muted-foreground">{category}</p>}
            <p className="text-sm mt-1">
              Seu preço atual: <span className="font-bold">{formatCurrency(currentPrice)}</span>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">Cidade</Label>
              <Input
                id="city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Ex: São Paulo"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">Estado</Label>
              <Input
                id="state"
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="Ex: SP"
              />
            </div>
          </div>

          <Button onClick={handleSearch} disabled={isSearching} className="w-full">
            {isSearching ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Pesquisando...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Pesquisar Preços
              </>
            )}
          </Button>

          {result && (
            <div className="space-y-4 mt-4">
              <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                <h4 className="font-medium mb-2">Resultado da Pesquisa</h4>
                <div className="prose prose-sm max-w-none text-foreground">
                  <div className="whitespace-pre-wrap">{result.result}</div>
                </div>
              </div>

              {result.citations && result.citations.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Fontes:</h4>
                  <ul className="space-y-1">
                    {result.citations.map((citation, index) => (
                      <li key={index}>
                        <a
                          href={citation}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline flex items-center gap-1"
                        >
                          <ExternalLink className="h-3 w-3" />
                          {citation}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Pesquisado em: {new Date(result.searchedAt).toLocaleString('pt-BR')}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MarketPriceSearch;
