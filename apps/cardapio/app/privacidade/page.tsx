import { BRAND } from "@prattzo/core";
import { ApagarDados } from "@/components/ApagarDados";

export const metadata = { title: `Privacidade — ${BRAND.name}` };

export default function Privacidade() {
  return (
    <main className="institucional" style={{ textAlign: "left", paddingTop: "8vh" }}>
      <h1 style={{ fontSize: "2rem" }}>Privacidade</h1>

      <h2>O que guardamos</h2>
      <p>
        Um código aleatório gerado no seu navegador quando você abre o cardápio, que termina quando
        você fecha a aba. Com ele registramos quais pratos foram vistos, por quanto tempo, e o que
        você separou no pedido.
      </p>

      <h2>O que não guardamos</h2>
      <p>
        Nome, telefone, e-mail, localização e qualquer dado que identifique você. Não há login, não
        há cookie de rastreamento e nada é compartilhado com terceiros.
      </p>

      <h2>Para quê</h2>
      <p>
        Para o restaurante saber quais pratos prendem atenção e quais passam batido. A lista que você
        monta não é enviada para a cozinha: ela existe só na sua tela, para você mostrar ao garçom.
      </p>

      <h2>Apagar</h2>
      <p>Você pode apagar tudo que foi registrado nesta sessão agora:</p>
      <ApagarDados />

      <p className="institucional__nota">
        Dúvidas: <a href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a>
      </p>
    </main>
  );
}
