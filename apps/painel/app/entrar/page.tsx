import { BRAND } from "@prattzo/core";
import { FormularioEntrar } from "@/components/FormularioEntrar";

export const metadata = { title: `Entrar — ${BRAND.name}` };

export default function EntrarPage({ searchParams }: { searchParams: { de?: string; erro?: string } }) {
  return (
    <div className="auth">
      <main className="auth__caixa">
        <span className="marca">{BRAND.name}</span>
        <h1 className="auth__titulo">Painel do restaurante</h1>
        <p className="auth__sub">Entre com seu e-mail e senha, ou receba um link de acesso.</p>

        {searchParams.erro ? <p className="aviso aviso--erro">{searchParams.erro}</p> : null}

        <FormularioEntrar destino={searchParams.de ?? "/"} />
      </main>
    </div>
  );
}
