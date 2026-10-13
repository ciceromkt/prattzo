import Link from "next/link";

export default function NaoEncontrado() {
  return (
    <div className="auth">
      <main className="auth__caixa">
        <h1 className="auth__titulo">Página não encontrada</h1>
        <p className="auth__sub">O item pode ter sido removido ou o endereço está errado.</p>
        <Link href="/" className="botao botao--grande">
          Voltar ao painel
        </Link>
      </main>
    </div>
  );
}
