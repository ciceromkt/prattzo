import { redirect } from "next/navigation";
import { BRAND } from "@prattzo/core";
import { getRestaurantDoUsuario } from "@prattzo/db";
import { requireUser } from "@/lib/supabase";
import { FormularioOnboarding } from "@/components/FormularioOnboarding";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cadastrar restaurante" };

export default async function OnboardingPage() {
  const { client, user } = await requireUser();
  if (await getRestaurantDoUsuario(client, user.id)) redirect("/");

  return (
    <div className="auth">
      <main className="auth__caixa" style={{ maxWidth: 520 }}>
        <span className="marca">{BRAND.name}</span>
        <h1 className="auth__titulo">Vamos cadastrar seu restaurante</h1>
        <p className="auth__sub">
          Leva um minuto. Depois você cadastra o cardápio e recebe o QR Code das mesas.
        </p>
        <FormularioOnboarding />
      </main>
    </div>
  );
}
