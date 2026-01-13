import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Users, 
  CreditCard, 
  Clock, 
  AlertTriangle, 
  Shield, 
  RefreshCw,
  Search,
  CheckCircle,
  XCircle,
  TestTube,
  Activity
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AdminUser {
  id: string;
  email: string;
  nome: string;
  telefone?: string;
  cpf_cnpj?: string;
  is_test_user: boolean;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  empresa?: {
    id: string;
    nome: string;
    segmento?: string;
  };
  roles: string[];
  subscription: {
    subscribed: boolean;
    status: string;
    endDate: string | null;
  } | null;
  trial: {
    status: string;
    daysRemaining: number;
  };
}

interface AdminStats {
  totalUsers: number;
  activeSubscribers: number;
  inTrial: number;
  expired: number;
  testUsers: number;
  activeToday: number;
  activeLast7Days: number;
}

const Admin = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    checkAdminAndFetchData();
  }, [user]);

  const checkAdminAndFetchData = async () => {
    if (!user) return;

    try {
      // Check if user is admin
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (!roleData) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      setIsAdmin(true);
      await fetchAdminData();
    } catch (error) {
      console.error('Error checking admin status:', error);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  const fetchAdminData = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-dashboard');

      if (error) throw error;

      setUsers(data.users);
      setStats(data.stats);
    } catch (error) {
      console.error('Error fetching admin data:', error);
      toast({
        title: 'Erro ao carregar dados',
        description: 'Não foi possível carregar os dados do painel.',
        variant: 'destructive',
      });
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return format(new Date(dateStr), "dd/MM/yyyy HH:mm", { locale: ptBR });
  };

  const getStatusBadge = (user: AdminUser) => {
    if (user.is_test_user) {
      return <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-300"><TestTube className="h-3 w-3 mr-1" />Teste</Badge>;
    }
    if (user.subscription?.subscribed) {
      return <Badge className="bg-green-100 text-green-700 border-green-300"><CheckCircle className="h-3 w-3 mr-1" />Assinante</Badge>;
    }
    if (user.trial.status === 'trialing') {
      return <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300"><Clock className="h-3 w-3 mr-1" />Trial ({user.trial.daysRemaining}d)</Badge>;
    }
    return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Expirado</Badge>;
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = 
      u.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.empresa?.nome.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    switch (activeTab) {
      case 'subscribers':
        return u.subscription?.subscribed;
      case 'trial':
        return !u.subscription?.subscribed && u.trial.status === 'trialing';
      case 'expired':
        return !u.subscription?.subscribed && u.trial.status === 'expired' && !u.is_test_user;
      case 'test':
        return u.is_test_user;
      default:
        return true;
    }
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" />
            Painel Administrativo
          </h1>
          <p className="text-muted-foreground">
            Gerencie usuários, assinaturas e monitore o sistema
          </p>
        </div>
        <Button onClick={fetchAdminData} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total</CardDescription>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                {stats.totalUsers}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Assinantes</CardDescription>
              <CardTitle className="text-2xl flex items-center gap-2 text-green-600">
                <CreditCard className="h-5 w-5" />
                {stats.activeSubscribers}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Em Trial</CardDescription>
              <CardTitle className="text-2xl flex items-center gap-2 text-blue-600">
                <Clock className="h-5 w-5" />
                {stats.inTrial}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Expirados</CardDescription>
              <CardTitle className="text-2xl flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                {stats.expired}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Teste</CardDescription>
              <CardTitle className="text-2xl flex items-center gap-2 text-purple-600">
                <TestTube className="h-5 w-5" />
                {stats.testUsers}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Ativos Hoje</CardDescription>
              <CardTitle className="text-2xl flex items-center gap-2 text-orange-600">
                <Activity className="h-5 w-5" />
                {stats.activeToday}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Últimos 7 dias</CardDescription>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Activity className="h-5 w-5 text-muted-foreground" />
                {stats.activeLast7Days}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Usuários</CardTitle>
          <div className="flex flex-col sm:flex-row gap-4 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, email ou empresa..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="all">Todos ({users.length})</TabsTrigger>
              <TabsTrigger value="subscribers">Assinantes ({stats?.activeSubscribers || 0})</TabsTrigger>
              <TabsTrigger value="trial">Trial ({stats?.inTrial || 0})</TabsTrigger>
              <TabsTrigger value="expired">Expirados ({stats?.expired || 0})</TabsTrigger>
              <TabsTrigger value="test">Teste ({stats?.testUsers || 0})</TabsTrigger>
            </TabsList>

            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Cadastro</TableHead>
                    <TableHead>Último Acesso</TableHead>
                    <TableHead>Roles</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Nenhum usuário encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{u.nome}</p>
                            <p className="text-sm text-muted-foreground">{u.email}</p>
                            {u.telefone && (
                              <p className="text-xs text-muted-foreground">{u.telefone}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{u.empresa?.nome || '-'}</p>
                            {u.empresa?.segmento && (
                              <p className="text-xs text-muted-foreground">{u.empresa.segmento}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(u)}</TableCell>
                        <TableCell className="text-sm">{formatDate(u.created_at)}</TableCell>
                        <TableCell className="text-sm">{formatDate(u.last_sign_in_at)}</TableCell>
                        <TableCell>
                          {u.roles.length > 0 ? (
                            <div className="flex gap-1">
                              {u.roles.map((role) => (
                                <Badge key={role} variant="secondary" className="text-xs">
                                  {role}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">user</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Admin;
