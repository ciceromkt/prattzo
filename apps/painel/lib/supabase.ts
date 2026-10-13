import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createAuthedClient, getRestaurantDoUsuario } from "@pede-esse/db";

/** Cliente autenticado para Server Component e Route Handler. */
export function serverClient(): SupabaseClient {
  return createAuthedClient(cookies());
}

/** Exige sessão. Redireciona para o login quando não há. */
export async function requireUser(): Promise<{ client: SupabaseClient; user: User }> {
  const client = serverClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) redirect("/entrar");
  return { client, user };
}

/** Exige sessão e restaurante cadastrado. Redireciona para o onboarding se faltar. */
export async function requireRestaurant(): Promise<{
  client: SupabaseClient;
  user: User;
  restaurant: { id: string; nome: string; slug: string; publicado: boolean };
}> {
  const { client, user } = await requireUser();
  const restaurant = await getRestaurantDoUsuario(client, user.id);
  if (!restaurant) redirect("/onboarding");
  return { client, user, restaurant };
}
