import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Database, 
  ArrowRight, 
  PackageSearch, 
  FileSpreadsheet, 
  ChefHat, 
  Tag,
  Loader2,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AdminUser {
  id: string;
  email: string;
  nome: string;
  empresa?: {
    id: string;
    nome: string;
    segmento?: string;
  };
}

interface MigrateBaseSectionProps {
  users: AdminUser[];
}

interface PreviewData {
  insumos: number;
  receitasIntermediarias: number;
  produtos: number;
  fichasTecnicas: number;
  precosCanais: number;
}

interface MigrationResult {
  insumos: { copied: number; updated: number; skipped: number };
  receitasIntermediarias: { copied: number; updated: number; skipped: number };
  produtos: { copied: number; updated: number; skipped: number };
  fichasTecnicas: { copied: number; skipped: number };
  precosCanais: { copied: number; updated: number; skipped: number };
}

const MigrateBaseSection: React.FC<MigrateBaseSectionProps> = ({ users }) => {
  const { toast } = useToast();
  const [empresaOrigemId, setEmpresaOrigemId] = useState<string>('');
  const [empresaDestinoId, setEmpresaDestinoId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [result, setResult] = useState<MigrationResult | null>(null);

  // Criar lista única de empresas
  const empresas = users
    .filter(u => u.empresa?.id)
    .reduce((acc, u) => {
      if (!acc.find(e => e.id === u.empresa!.id)) {
        acc.push({
          id: u.empresa!.id,
          nome: u.empresa!.nome,
          usuario: u.nome,
          email: u.email,
        });
      }
      return acc;
    }, [] as { id: string; nome: string; usuario: string; email: string }[]);

  const handlePreview = async () => {
    if (!empresaOrigemId || !empresaDestinoId) {
      toast({
        title: 'Selecione as empresas',
        description: 'Escolha a empresa de origem e destino.',
        variant: 'destructive',
      });
      return;
    }

    if (empresaOrigemId === empresaDestinoId) {
      toast({
        title: 'Empresas iguais',
        description: 'A empresa de origem e destino não podem ser a mesma.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    setPreview(null);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('migrate-base', {
        body: {
          action: 'preview',
          empresaOrigemId,
          empresaDestinoId,
        },
      });

      if (error) throw error;

      setPreview(data.preview);
    } catch (error) {
      console.error('Error previewing migration:', error);
      toast({
        title: 'Erro ao carregar preview',
        description: 'Não foi possível verificar os dados para migração.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMigrate = async () => {
    if (!preview) return;

    setMigrating(true);

    try {
      const { data, error } = await supabase.functions.invoke('migrate-base', {
        body: {
          action: 'migrate',
          empresaOrigemId,
          empresaDestinoId,
        },
      });

      if (error) throw error;

      setResult(data.result);
      setPreview(null);

      toast({
        title: '✅ Migração concluída!',
        description: 'Os dados foram migrados com sucesso.',
      });
    } catch (error) {
      console.error('Error migrating:', error);
      toast({
        title: 'Erro na migração',
        description: 'Ocorreu um erro durante a migração.',
        variant: 'destructive',
      });
    } finally {
      setMigrating(false);
    }
  };

  const empresaOrigem = empresas.find(e => e.id === empresaOrigemId);
  const empresaDestino = empresas.find(e => e.id === empresaDestinoId);

  return (
    <Card className="border-2 border-dashed border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          Migrar Base de Dados
        </CardTitle>
        <CardDescription>
          Copie insumos, produtos, fichas técnicas e receitas de uma empresa para outra.
          Dados existentes com mesmo nome serão sobrescritos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Selects de origem e destino */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr] gap-4 items-end">
          <div className="space-y-2">
            <label className="text-sm font-medium">Empresa Origem</label>
            <Select value={empresaOrigemId} onValueChange={setEmpresaOrigemId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a origem..." />
              </SelectTrigger>
              <SelectContent>
                {empresas.map(e => (
                  <SelectItem key={e.id} value={e.id}>
                    <div className="flex flex-col">
                      <span className="font-medium">{e.nome}</span>
                      <span className="text-xs text-muted-foreground">{e.email}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {empresaOrigem && (
              <p className="text-xs text-muted-foreground">
                Usuário: {empresaOrigem.usuario}
              </p>
            )}
          </div>

          <div className="flex justify-center py-2">
            <ArrowRight className="h-6 w-6 text-muted-foreground" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Empresa Destino</label>
            <Select value={empresaDestinoId} onValueChange={setEmpresaDestinoId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o destino..." />
              </SelectTrigger>
              <SelectContent>
                {empresas.map(e => (
                  <SelectItem key={e.id} value={e.id} disabled={e.id === empresaOrigemId}>
                    <div className="flex flex-col">
                      <span className="font-medium">{e.nome}</span>
                      <span className="text-xs text-muted-foreground">{e.email}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {empresaDestino && (
              <p className="text-xs text-muted-foreground">
                Usuário: {empresaDestino.usuario}
              </p>
            )}
          </div>
        </div>

        {/* Botão Preview */}
        <Button 
          onClick={handlePreview} 
          disabled={!empresaOrigemId || !empresaDestinoId || loading}
          className="w-full md:w-auto"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Carregando...
            </>
          ) : (
            <>
              <PackageSearch className="h-4 w-4 mr-2" />
              Verificar Dados
            </>
          )}
        </Button>

        {/* Preview dos dados */}
        {preview && (
          <div className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Atenção:</strong> Itens com mesmo nome serão sobrescritos. 
                Estoques NÃO serão copiados.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <PackageSearch className="h-5 w-5 mx-auto mb-1 text-primary" />
                <p className="text-2xl font-bold">{preview.insumos}</p>
                <p className="text-xs text-muted-foreground">Insumos</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <ChefHat className="h-5 w-5 mx-auto mb-1 text-primary" />
                <p className="text-2xl font-bold">{preview.receitasIntermediarias}</p>
                <p className="text-xs text-muted-foreground">Receitas</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <FileSpreadsheet className="h-5 w-5 mx-auto mb-1 text-primary" />
                <p className="text-2xl font-bold">{preview.produtos}</p>
                <p className="text-xs text-muted-foreground">Produtos</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <Database className="h-5 w-5 mx-auto mb-1 text-primary" />
                <p className="text-2xl font-bold">{preview.fichasTecnicas}</p>
                <p className="text-xs text-muted-foreground">Fichas Técnicas</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <Tag className="h-5 w-5 mx-auto mb-1 text-primary" />
                <p className="text-2xl font-bold">{preview.precosCanais}</p>
                <p className="text-xs text-muted-foreground">Preços Canais</p>
              </div>
            </div>

            <Button 
              onClick={handleMigrate} 
              disabled={migrating}
              variant="default"
              className="w-full"
            >
              {migrating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Migrando dados...
                </>
              ) : (
                <>
                  <Database className="h-4 w-4 mr-2" />
                  Confirmar Migração
                </>
              )}
            </Button>
          </div>
        )}

        {/* Resultado da migração */}
        {result && (
          <Alert className="border-green-300 bg-green-50">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              <strong className="block mb-2">Migração concluída com sucesso!</strong>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                <div>
                  <Badge variant="outline" className="mb-1">Insumos</Badge>
                  <p>{result.insumos.copied} novos, {result.insumos.updated} atualizados</p>
                </div>
                <div>
                  <Badge variant="outline" className="mb-1">Receitas</Badge>
                  <p>{result.receitasIntermediarias.copied} novas, {result.receitasIntermediarias.updated} atualizadas</p>
                </div>
                <div>
                  <Badge variant="outline" className="mb-1">Produtos</Badge>
                  <p>{result.produtos.copied} novos, {result.produtos.updated} atualizados</p>
                </div>
                <div>
                  <Badge variant="outline" className="mb-1">Fichas Técnicas</Badge>
                  <p>{result.fichasTecnicas.copied} copiadas</p>
                </div>
                <div>
                  <Badge variant="outline" className="mb-1">Preços Canais</Badge>
                  <p>{result.precosCanais.copied} novos, {result.precosCanais.updated} atualizados</p>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default MigrateBaseSection;
