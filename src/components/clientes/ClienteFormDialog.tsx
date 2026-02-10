import React, { useState, useEffect } from 'react';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogBody,
} from '@/components/ui/responsive-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, MapPin, FileText } from 'lucide-react';
import { Cliente, ClienteFormData } from '@/hooks/useClientes';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cliente?: Cliente | null;
  onSubmit: (data: ClienteFormData) => void;
  isLoading?: boolean;
}

const ESTADOS_BR = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

export function ClienteFormDialog({ open, onOpenChange, cliente, onSubmit, isLoading }: Props) {
  const [formData, setFormData] = useState<ClienteFormData>({
    nome: '',
    whatsapp: '',
    email: '',
    data_nascimento: '',
    endereco_rua: '',
    endereco_numero: '',
    endereco_complemento: '',
    endereco_bairro: '',
    endereco_cidade: '',
    endereco_estado: '',
    endereco_cep: '',
    observacoes: '',
    preferencias: '',
  });

  useEffect(() => {
    if (cliente) {
      setFormData({
        nome: cliente.nome || '',
        whatsapp: cliente.whatsapp || '',
        email: cliente.email || '',
        data_nascimento: cliente.data_nascimento || '',
        endereco_rua: cliente.endereco_rua || '',
        endereco_numero: cliente.endereco_numero || '',
        endereco_complemento: cliente.endereco_complemento || '',
        endereco_bairro: cliente.endereco_bairro || '',
        endereco_cidade: cliente.endereco_cidade || '',
        endereco_estado: cliente.endereco_estado || '',
        endereco_cep: cliente.endereco_cep || '',
        observacoes: cliente.observacoes || '',
        preferencias: cliente.preferencias || '',
      });
    } else {
      setFormData({
        nome: '',
        whatsapp: '',
        email: '',
        data_nascimento: '',
        endereco_rua: '',
        endereco_numero: '',
        endereco_complemento: '',
        endereco_bairro: '',
        endereco_cidade: '',
        endereco_estado: '',
        endereco_cep: '',
        observacoes: '',
        preferencias: '',
      });
    }
  }, [cliente, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
    onOpenChange(false);
  };

  const formatWhatsApp = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  };

  const formatCEP = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 5) return digits;
    return `${digits.slice(0, 5)}-${digits.slice(5, 8)}`;
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="max-w-[95vw] sm:max-w-lg">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{cliente ? 'Editar Cliente' : 'Novo Cliente'}</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        
        <ResponsiveDialogBody>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Tabs defaultValue="dados" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="dados" className="text-xs sm:text-sm">
                <User className="h-3 w-3 mr-1" />
                Dados
              </TabsTrigger>
              <TabsTrigger value="endereco" className="text-xs sm:text-sm">
                <MapPin className="h-3 w-3 mr-1" />
                Endereço
              </TabsTrigger>
              <TabsTrigger value="notas" className="text-xs sm:text-sm">
                <FileText className="h-3 w-3 mr-1" />
                Notas
              </TabsTrigger>
            </TabsList>

            <TabsContent value="dados" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome *</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Nome do cliente"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="whatsapp">WhatsApp</Label>
                  <Input
                    id="whatsapp"
                    value={formData.whatsapp}
                    onChange={(e) => setFormData({ ...formData, whatsapp: formatWhatsApp(e.target.value) })}
                    placeholder="(11) 99999-9999"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="data_nascimento">Aniversário</Label>
                  <Input
                    id="data_nascimento"
                    type="date"
                    value={formData.data_nascimento}
                    onChange={(e) => setFormData({ ...formData, data_nascimento: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@exemplo.com"
                />
              </div>
            </TabsContent>

            <TabsContent value="endereco" className="space-y-4 mt-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="endereco_rua">Rua</Label>
                  <Input
                    id="endereco_rua"
                    value={formData.endereco_rua}
                    onChange={(e) => setFormData({ ...formData, endereco_rua: e.target.value })}
                    placeholder="Nome da rua"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endereco_numero">Nº</Label>
                  <Input
                    id="endereco_numero"
                    value={formData.endereco_numero}
                    onChange={(e) => setFormData({ ...formData, endereco_numero: e.target.value })}
                    placeholder="123"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="endereco_complemento">Complemento</Label>
                  <Input
                    id="endereco_complemento"
                    value={formData.endereco_complemento}
                    onChange={(e) => setFormData({ ...formData, endereco_complemento: e.target.value })}
                    placeholder="Apto, bloco..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endereco_bairro">Bairro</Label>
                  <Input
                    id="endereco_bairro"
                    value={formData.endereco_bairro}
                    onChange={(e) => setFormData({ ...formData, endereco_bairro: e.target.value })}
                    placeholder="Bairro"
                  />
                </div>
              </div>

              <div className="grid grid-cols-5 gap-3">
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="endereco_cidade">Cidade</Label>
                  <Input
                    id="endereco_cidade"
                    value={formData.endereco_cidade}
                    onChange={(e) => setFormData({ ...formData, endereco_cidade: e.target.value })}
                    placeholder="Cidade"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endereco_estado">UF</Label>
                  <Select
                    value={formData.endereco_estado}
                    onValueChange={(value) => setFormData({ ...formData, endereco_estado: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="UF" />
                    </SelectTrigger>
                    <SelectContent>
                      {ESTADOS_BR.map((uf) => (
                        <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="endereco_cep">CEP</Label>
                  <Input
                    id="endereco_cep"
                    value={formData.endereco_cep}
                    onChange={(e) => setFormData({ ...formData, endereco_cep: formatCEP(e.target.value) })}
                    placeholder="00000-000"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="notas" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="preferencias">Preferências / Alergias</Label>
                <Textarea
                  id="preferencias"
                  value={formData.preferencias}
                  onChange={(e) => setFormData({ ...formData, preferencias: e.target.value })}
                  placeholder="Ex: Não come glúten, prefere sem açúcar..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="observacoes">Observações Gerais</Label>
                <Textarea
                  id="observacoes"
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  placeholder="Anotações sobre o cliente..."
                  rows={3}
                />
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading} className="flex-1">
              {cliente ? 'Salvar' : 'Cadastrar'}
            </Button>
          </div>
        </form>
        </ResponsiveDialogBody>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
