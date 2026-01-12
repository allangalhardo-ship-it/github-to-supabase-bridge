import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ChefHat, Loader2 } from 'lucide-react';

const SEGMENTOS = [
  'Restaurante',
  'Confeitaria',
  'Padaria',
  'Food Truck',
  'Lanchonete',
  'Pizzaria',
  'Hamburgueria',
  'Cafeteria',
  'Bar',
  'Delivery',
  'Catering/Buffet',
  'Outro',
];

// Função para formatar CPF/CNPJ
const formatCpfCnpj = (value: string) => {
  const numbers = value.replace(/\D/g, '');
  
  if (numbers.length <= 11) {
    // CPF: 000.000.000-00
    return numbers
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  } else {
    // CNPJ: 00.000.000/0000-00
    return numbers
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2')
      .substring(0, 18);
  }
};

// Função para formatar telefone
const formatTelefone = (value: string) => {
  const numbers = value.replace(/\D/g, '');
  
  if (numbers.length <= 10) {
    // (00) 0000-0000
    return numbers
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  } else {
    // (00) 00000-0000
    return numbers
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2')
      .substring(0, 15);
  }
};

// Validar CPF
const validarCpf = (cpf: string) => {
  const numbers = cpf.replace(/\D/g, '');
  if (numbers.length !== 11) return false;
  if (/^(\d)\1+$/.test(numbers)) return false;
  
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(numbers[i]) * (10 - i);
  let digit = (sum * 10) % 11;
  if (digit === 10) digit = 0;
  if (digit !== parseInt(numbers[9])) return false;
  
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(numbers[i]) * (11 - i);
  digit = (sum * 10) % 11;
  if (digit === 10) digit = 0;
  return digit === parseInt(numbers[10]);
};

// Validar CNPJ
const validarCnpj = (cnpj: string) => {
  const numbers = cnpj.replace(/\D/g, '');
  if (numbers.length !== 14) return false;
  if (/^(\d)\1+$/.test(numbers)) return false;
  
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(numbers[i]) * weights1[i];
  let digit = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (digit !== parseInt(numbers[12])) return false;
  
  sum = 0;
  for (let i = 0; i < 13; i++) sum += parseInt(numbers[i]) * weights2[i];
  digit = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  return digit === parseInt(numbers[13]);
};

const Cadastro = () => {
  const [nomeEmpresa, setNomeEmpresa] = useState('');
  const [segmento, setSegmento] = useState('');
  const [nome, setNome] = useState('');
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleCpfCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCpfCnpj(formatCpfCnpj(e.target.value));
  };

  const handleTelefoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTelefone(formatTelefone(e.target.value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validações
    if (password.length < 6) {
      toast({
        title: 'Senha muito curta',
        description: 'A senha deve ter pelo menos 6 caracteres.',
        variant: 'destructive',
      });
      return;
    }

    const cpfCnpjNumbers = cpfCnpj.replace(/\D/g, '');
    if (cpfCnpjNumbers.length === 11) {
      if (!validarCpf(cpfCnpj)) {
        toast({
          title: 'CPF inválido',
          description: 'Por favor, verifique o CPF informado.',
          variant: 'destructive',
        });
        return;
      }
    } else if (cpfCnpjNumbers.length === 14) {
      if (!validarCnpj(cpfCnpj)) {
        toast({
          title: 'CNPJ inválido',
          description: 'Por favor, verifique o CNPJ informado.',
          variant: 'destructive',
        });
        return;
      }
    } else {
      toast({
        title: 'CPF/CNPJ inválido',
        description: 'Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.',
        variant: 'destructive',
      });
      return;
    }

    const telefoneNumbers = telefone.replace(/\D/g, '');
    if (telefoneNumbers.length < 10 || telefoneNumbers.length > 11) {
      toast({
        title: 'Telefone inválido',
        description: 'Informe um telefone válido com DDD.',
        variant: 'destructive',
      });
      return;
    }

    if (!segmento) {
      toast({
        title: 'Segmento não selecionado',
        description: 'Por favor, selecione o segmento do seu negócio.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    const { error } = await signUp(email, password, nome, nomeEmpresa, {
      telefone: telefoneNumbers,
      cpfCnpj: cpfCnpjNumbers,
      segmento,
    });

    if (error) {
      toast({
        title: 'Erro ao cadastrar',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Cadastro realizado!',
        description: 'Bem-vindo ao GastroGestor.',
      });
      navigate('/dashboard');
    }

    setLoading(false);
  };

  return (
    <div className="fixed inset-0 overflow-y-auto flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-primary p-3 rounded-xl">
              <ChefHat className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl">Criar Conta <span className="text-xs font-normal text-muted-foreground align-middle">(beta)</span></CardTitle>
          <CardDescription>
            Comece a gerenciar seu negócio hoje
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nomeEmpresa">Nome da Empresa *</Label>
              <Input
                id="nomeEmpresa"
                placeholder="Minha Lanchonete"
                value={nomeEmpresa}
                onChange={(e) => setNomeEmpresa(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="segmento">Segmento do Negócio *</Label>
              <Select value={segmento} onValueChange={setSegmento} required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o segmento" />
                </SelectTrigger>
                <SelectContent>
                  {SEGMENTOS.map((seg) => (
                    <SelectItem key={seg} value={seg}>{seg}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nome">Nome Completo *</Label>
              <Input
                id="nome"
                placeholder="João da Silva"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cpfCnpj">CPF ou CNPJ *</Label>
              <Input
                id="cpfCnpj"
                placeholder="000.000.000-00 ou 00.000.000/0000-00"
                value={cpfCnpj}
                onChange={handleCpfCnpjChange}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone/WhatsApp *</Label>
              <Input
                id="telefone"
                placeholder="(11) 99999-9999"
                value={telefone}
                onChange={handleTelefoneChange}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-mail *</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha *</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
              <p className="text-xs text-muted-foreground">Mínimo de 6 caracteres</p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar Conta
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              Já tem uma conta?{' '}
              <Link to="/login" className="text-primary hover:underline">
                Entre aqui
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default Cadastro;
