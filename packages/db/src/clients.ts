import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Variável de ambiente ${name} não configurada. Copie .env.example para .env.local e preencha.`,
    );
  }
  return value;
}

export function supabaseUrl(): string {
  return required("NEXT_PUBLIC_SUPABASE_URL");
}

export function supabaseAnonKey(): string {
  return required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

/**
 * Cliente anônimo para leitura pública (cardápio). Sem sessão, sem cookie.
 * Respeita RLS: só vê restaurante publicado.
 */
export function createPublicClient(): SupabaseClient {
  return createClient(supabaseUrl(), supabaseAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Cliente com service role. Ignora RLS — use SOMENTE em rota de servidor,
 * depois de validar o que está sendo pedido. Nunca no navegador.
 */
export function createAdminClient(): SupabaseClient {
  return createClient(supabaseUrl(), required("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export interface CookieStore {
  getAll(): { name: string; value: string }[];
  set(name: string, value: string, options?: CookieOptions): void;
}

interface CookieToSet {
  name: string;
  value: string;
  options?: CookieOptions;
}

/**
 * Cliente autenticado para o painel (Server Component / Route Handler).
 * Recebe o cookies() do Next para ler e renovar a sessão.
 */
export function createAuthedClient(cookieStore: CookieStore): SupabaseClient {
  return createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list: CookieToSet[]) => {
        try {
          for (const { name, value, options } of list) cookieStore.set(name, value, options);
        } catch {
          // Em Server Component a escrita de cookie é ignorada; o middleware renova.
        }
      },
    },
  });
}
