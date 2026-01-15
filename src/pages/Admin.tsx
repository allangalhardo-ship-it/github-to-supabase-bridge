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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
  Activity,
  Monitor,
  Smartphone,
  Globe,
  ChevronDown,
  ChevronRight,
  Wifi,
  WifiOff,
  Eye,
  Timer
} from 'lucide-react';
import { ScrollableTableWrapper } from '@/components/ui/scrollable-table-wrapper';
import { useToast } from '@/hooks/use-toast';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SessionInfo {
  id: string;
  ip: string;
  device: string;
  browser: string;
  os: string;
  started_at: string;
  last_activity: string;
  ended_at: string | null;
  is_active: boolean;
  pages_visited: number;
  duration_minutes: number;
}

interface SessionStats {
  active_sessions: number;
  total_sessions: number;
  total_page_views: number;
  total_time_minutes: number;
  unique_ips: string[];
  unique_devices: string[];
}

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
  session_stats?: SessionStats;
  recent_sessions?: SessionInfo[];
}

interface AdminStats {
  totalUsers: number;
  activeSubscribers: number;
  inTrial: number;
  expired: number;
  testUsers: number;
  activeToday: number;
  activeLast7Days: number;
  totalActiveSessions: number;
  usersWithMultipleSessions: number;
  totalPageViews: number;
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
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    checkAdminAndFetchData();
  }, [user]);

  const checkAdminAndFetchData = async () => {
    if (!user) return;

    try {
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

  const formatTimeAgo = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: ptBR });
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}min`;
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

  const getDeviceIcon = (device: string) => {
    if (device === 'Mobile') return <Smartphone className="h-4 w-4" />;
    return <Monitor className="h-4 w-4" />;
  };

  const toggleUserExpand = (userId: string) => {
    setExpandedUsers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
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
      case 'online':
        return (u.session_stats?.active_sessions || 0) > 0;
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
            Gerencie usuários, assinaturas e monitore sessões ativas
          </p>
        </div>
        <Button onClick={fetchAdminData} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Usuários</CardDescription>
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
          </div>

          {/* Session Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-green-200 bg-green-50/50">
              <CardHeader className="pb-2">
                <CardDescription>Sessões Ativas Agora</CardDescription>
                <CardTitle className="text-2xl flex items-center gap-2 text-green-700">
                  <Wifi className="h-5 w-5" />
                  {stats.totalActiveSessions}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-orange-200 bg-orange-50/50">
              <CardHeader className="pb-2">
                <CardDescription>Usuários Simultâneos</CardDescription>
                <CardTitle className="text-2xl flex items-center gap-2 text-orange-700">
                  <Users className="h-5 w-5" />
                  {stats.usersWithMultipleSessions}
                </CardTitle>
                <CardDescription className="text-xs">Com múltiplos dispositivos</CardDescription>
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
                <CardDescription>Total Page Views</CardDescription>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Eye className="h-5 w-5 text-muted-foreground" />
                  {stats.totalPageViews}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>
        </>
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
            <TabsList className="mb-4 flex-wrap">
              <TabsTrigger value="all">Todos ({users.length})</TabsTrigger>
              <TabsTrigger value="online" className="text-green-600">
                <Wifi className="h-3 w-3 mr-1" />
                Online ({users.filter(u => (u.session_stats?.active_sessions || 0) > 0).length})
              </TabsTrigger>
              <TabsTrigger value="subscribers">Assinantes ({stats?.activeSubscribers || 0})</TabsTrigger>
              <TabsTrigger value="trial">Trial ({stats?.inTrial || 0})</TabsTrigger>
              <TabsTrigger value="expired">Expirados ({stats?.expired || 0})</TabsTrigger>
              <TabsTrigger value="test">Teste ({stats?.testUsers || 0})</TabsTrigger>
            </TabsList>

            <ScrollableTableWrapper className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sessões</TableHead>
                    <TableHead>Último Acesso</TableHead>
                    <TableHead>Tempo Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Nenhum usuário encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((u) => (
                      <React.Fragment key={u.id}>
                        <TableRow 
                          className={`cursor-pointer hover:bg-muted/50 ${(u.session_stats?.active_sessions || 0) > 0 ? 'bg-green-50/50' : ''}`}
                          onClick={() => toggleUserExpand(u.id)}
                        >
                          <TableCell className="w-8">
                            {expandedUsers.has(u.id) ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {(u.session_stats?.active_sessions || 0) > 0 && (
                                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                              )}
                              <div>
                                <p className="font-medium">{u.nome}</p>
                                <p className="text-sm text-muted-foreground">{u.email}</p>
                              </div>
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
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {(u.session_stats?.active_sessions || 0) > 0 ? (
                                <Badge className="bg-green-100 text-green-700">
                                  <Wifi className="h-3 w-3 mr-1" />
                                  {u.session_stats?.active_sessions} ativa(s)
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-muted-foreground">
                                  <WifiOff className="h-3 w-3 mr-1" />
                                  Offline
                                </Badge>
                              )}
                              <span className="text-xs text-muted-foreground">
                                ({u.session_stats?.total_sessions || 0} total)
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatTimeAgo(u.last_sign_in_at)}
                          </TableCell>
                          <TableCell className="text-sm">
                            <div className="flex items-center gap-1">
                              <Timer className="h-3 w-3 text-muted-foreground" />
                              {formatDuration(u.session_stats?.total_time_minutes || 0)}
                            </div>
                          </TableCell>
                        </TableRow>

                        {/* Expanded Session Details */}
                        {expandedUsers.has(u.id) && (
                          <TableRow>
                            <TableCell colSpan={7} className="bg-muted/30 p-4">
                              <div className="space-y-4">
                                {/* Session Stats Summary */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                  <div className="bg-background rounded-lg p-3 border">
                                    <p className="text-xs text-muted-foreground">Page Views</p>
                                    <p className="text-lg font-semibold flex items-center gap-1">
                                      <Eye className="h-4 w-4" />
                                      {u.session_stats?.total_page_views || 0}
                                    </p>
                                  </div>
                                  <div className="bg-background rounded-lg p-3 border">
                                    <p className="text-xs text-muted-foreground">IPs Únicos</p>
                                    <p className="text-lg font-semibold flex items-center gap-1">
                                      <Globe className="h-4 w-4" />
                                      {u.session_stats?.unique_ips?.length || 0}
                                    </p>
                                  </div>
                                  <div className="bg-background rounded-lg p-3 border">
                                    <p className="text-xs text-muted-foreground">Dispositivos</p>
                                    <p className="text-lg font-semibold flex items-center gap-1">
                                      <Monitor className="h-4 w-4" />
                                      {u.session_stats?.unique_devices?.length || 0}
                                    </p>
                                  </div>
                                  <div className="bg-background rounded-lg p-3 border">
                                    <p className="text-xs text-muted-foreground">Roles</p>
                                    <div className="flex gap-1 mt-1">
                                      {u.roles.length > 0 ? u.roles.map(r => (
                                        <Badge key={r} variant="secondary" className="text-xs">{r}</Badge>
                                      )) : (
                                        <Badge variant="outline" className="text-xs">user</Badge>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* IPs List */}
                                {u.session_stats?.unique_ips && u.session_stats.unique_ips.length > 0 && (
                                  <div className="bg-background rounded-lg p-3 border">
                                    <p className="text-xs text-muted-foreground mb-2">Endereços IP Utilizados</p>
                                    <div className="flex flex-wrap gap-2">
                                      {u.session_stats.unique_ips.map((ip, i) => (
                                        <Badge key={i} variant="outline" className="font-mono text-xs">
                                          {ip}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Recent Sessions */}
                                {u.recent_sessions && u.recent_sessions.length > 0 && (
                                  <div className="bg-background rounded-lg p-3 border">
                                    <p className="text-xs text-muted-foreground mb-2">Últimas Sessões</p>
                                    <div className="space-y-2">
                                      {u.recent_sessions.map((session) => (
                                        <div 
                                          key={session.id} 
                                          className={`flex items-center justify-between p-2 rounded border ${session.is_active ? 'bg-green-50 border-green-200' : 'bg-muted/50'}`}
                                        >
                                          <div className="flex items-center gap-3">
                                            {session.is_active ? (
                                              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                                            ) : (
                                              <div className="h-2 w-2 rounded-full bg-gray-300" />
                                            )}
                                            <div className="flex items-center gap-2">
                                              {getDeviceIcon(session.device)}
                                              <span className="text-sm font-medium">{session.device}</span>
                                              <span className="text-xs text-muted-foreground">
                                                {session.browser} • {session.os}
                                              </span>
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                            <span className="font-mono">{session.ip}</span>
                                            <span>{session.pages_visited} páginas</span>
                                            <span>{formatDuration(session.duration_minutes)}</span>
                                            <span>{formatTimeAgo(session.started_at)}</span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Additional Info */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                                  <div>
                                    <span className="text-muted-foreground">Cadastro:</span>
                                    <p className="font-medium">{formatDate(u.created_at)}</p>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Telefone:</span>
                                    <p className="font-medium">{u.telefone || '-'}</p>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">CPF/CNPJ:</span>
                                    <p className="font-medium">{u.cpf_cnpj || '-'}</p>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Email Confirmado:</span>
                                    <p className="font-medium">{u.email_confirmed_at ? 'Sim' : 'Não'}</p>
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollableTableWrapper>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Admin;