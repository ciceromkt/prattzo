import Link from "next/link";

export default function NaoEncontrado() {
  return (
    <div className="tela">
      <main className="conteudo" style={{ paddingTop: 80, textAlign: "center" }}>
        <p style={{ fontSize: "3rem" }} aria-hidden="true">
          🍽️
        </p>
        <h1 style={{ fontSize: "1.6rem", fontWeight: 760, marginTop: 8 }}>Cardápio não encontrado</h1>
        <p style={{ color: "var(--cor-tinta-media)", marginTop: 10 }}>
          O link pode estar errado ou o restaurante ainda não publicou o cardápio.
        </p>
        <Link href="/" className="botao botao--neutro" style={{ marginTop: 24 }}>
          Voltar ao início
        </Link>
      </main>
    </div>
  );
}
