import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface Usuario {
  id: string;
  empresa_id: string;
  nome: string;
  email: string;
  telefone?: string;
  cpf_cnpj?: string;
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

  const fetchUsuario = async (userId: string) => {
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
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Use setTimeout to avoid potential race conditions
          setTimeout(async () => {
            let usuario = await fetchUsuario(session.user.id);

            // If the user exists in auth but doesn't have an app profile yet,
            // bootstrap it on the backend and retry.
            if (!usuario) {
              const { error: bootstrapError } = await supabase.functions.invoke('bootstrap-account', {
                body: {},
              });

              if (bootstrapError) {
                console.error('Error bootstrapping account:', bootstrapError);
              } else {
                usuario = await fetchUsuario(session.user.id);
              }
            }

            setUsuario(usuario);
            setLoading(false);
          }, 0);
        } else {
          setUsuario(null);
          setLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        let usuario = await fetchUsuario(session.user.id);

        if (!usuario) {
          const { error: bootstrapError } = await supabase.functions.invoke('bootstrap-account', {
            body: {},
          });

          if (bootstrapError) {
            console.error('Error bootstrapping account:', bootstrapError);
          } else {
            usuario = await fetchUsuario(session.user.id);
          }
        }

        setUsuario(usuario);
      }

      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

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
      const { data: bootstrapData, error: bootstrapError } = await supabase.functions.invoke(
        'bootstrap-account',
        {
          body: { 
            nome, 
            nomeEmpresa,
            telefone: extra?.telefone,
            cpfCnpj: extra?.cpfCnpj,
            segmento: extra?.segmento,
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
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
