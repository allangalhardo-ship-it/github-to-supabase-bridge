import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface Usuario {
  id: string;
  empresa_id: string;
  nome: string;
  email: string;
  telefone?: string;
  cpf_cnpj?: string;
  is_test_user?: boolean;
  avatar_url?: string;
}

interface ExtraSignUpData {
  telefone?: string;
  cpfCnpj?: string;
  segmento?: string;
}

interface AuthContextType {
  user: User | null;
  usuario: Usuario | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, nome: string, nomeEmpresa: string, extra?: ExtraSignUpData) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshUsuario: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Track current user ID to avoid redundant fetches on TOKEN_REFRESHED
  const currentUserIdRef = useRef<string | null>(null);
  const isFetchingRef = useRef(false);

  const fetchUsuario = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching usuario:', error);
      return null;
    }
    return data;
  }, []);

  const handleAuthUser = useCallback(async (newSession: Session | null, isInitial = false) => {
    const newUserId = newSession?.user?.id ?? null;
    const previousUserId = currentUserIdRef.current;

    // Always update session (token may have changed)
    setSession(newSession);

    // If the user ID hasn't changed, skip the expensive work
    // (this prevents re-renders on TOKEN_REFRESHED events)
    if (newUserId === previousUserId && !isInitial) {
      return;
    }

    currentUserIdRef.current = newUserId;
    setUser(newSession?.user ?? null);

    if (newSession?.user && !isFetchingRef.current) {
      isFetchingRef.current = true;
      try {
        let fetchedUsuario = await fetchUsuario(newSession.user.id);

        if (!fetchedUsuario) {
          const { error: bootstrapError } = await supabase.functions.invoke('bootstrap-account', {
            body: {},
          });

          if (bootstrapError) {
            console.error('Error bootstrapping account:', bootstrapError);
          } else {
            fetchedUsuario = await fetchUsuario(newSession.user.id);
          }
        }

        setUsuario(fetchedUsuario);
      } finally {
        isFetchingRef.current = false;
      }
    } else if (!newSession?.user) {
      setUsuario(null);
    }

    setLoading(false);
  }, [fetchUsuario]);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        handleAuthUser(session);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      await handleAuthUser(session, true);
    });

    return () => subscription.unsubscribe();
  }, [handleAuthUser]);

  const signUp = async (email: string, password: string, nome: string, nomeEmpresa: string, extra?: ExtraSignUpData) => {
    try {
      // 1. Create auth user (store extra data in user metadata)
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            nome,
            nomeEmpresa,
            telefone: extra?.telefone,
            cpfCnpj: extra?.cpfCnpj,
            segmento: extra?.segmento,
          },
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Erro ao criar usuário');

      // 2. Ensure app profile exists (empresa + usuario + defaults)
      // Pass userId and email for cases where email confirmation is required
      // and no valid session token exists yet
      const { data: bootstrapData, error: bootstrapError } = await supabase.functions.invoke(
        'bootstrap-account',
        {
          body: { 
            nome, 
            nomeEmpresa,
            telefone: extra?.telefone,
            cpfCnpj: extra?.cpfCnpj,
            segmento: extra?.segmento,
            userId: authData.user.id,
            email: authData.user.email,
          },
        }
      );

      if (bootstrapError) throw bootstrapError;

      // 3. Set usuario in state immediately
      if (bootstrapData?.usuario) {
        setUsuario(bootstrapData.usuario);
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setUsuario(null);
    setSession(null);
  };

  const refreshUsuario = async () => {
    if (user) {
      const updatedUsuario = await fetchUsuario(user.id);
      setUsuario(updatedUsuario);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        usuario,
        session,
        loading,
        signUp,
        signIn,
        signOut,
        refreshUsuario,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
