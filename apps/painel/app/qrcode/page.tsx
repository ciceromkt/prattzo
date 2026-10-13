import QRCode from "qrcode";
import { Casca } from "@/components/Casca";
import { CopiarLink } from "@/components/CopiarLink";
import { requireRestaurant } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const metadata = { title: "QR Code" };

export default async function QrCodePage() {
  const { restaurant } = await requireRestaurant();
  const url = `${process.env.NEXT_PUBLIC_CARDAPIO_URL ?? "http://localhost:3000"}/r/${restaurant.slug}`;

  // SVG gerado no servidor: imprime sem perder qualidade, em qualquer tamanho.
  const svg = await QRCode.toString(url, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    color: { dark: "#12100f", light: "#ffffff" },
  });

  return (
    <Casca titulo="QR Code das mesas" descricao="Imprima e coloque nas mesas. O código abre o cardápio direto no celular do cliente.">

      {!restaurant.publicado ? (
        <p className="aviso aviso--erro">
          O cardápio está como rascunho: quem escanear vai ver &quot;cardápio não encontrado&quot;. Publique em
          Configurações antes de imprimir.
        </p>
      ) : null}

      <div className="qr-area">
        <div className="qr-caixa" dangerouslySetInnerHTML={{ __html: svg }} />

        <div style={{ flex: 1, minWidth: 260 }}>
          <h2 className="cartao__titulo">Link do cardápio</h2>
          <CopiarLink url={url} svg={svg} nome={restaurant.slug} />

          <h2 className="cartao__titulo" style={{ marginTop: 28 }}>
            Como usar no salão
          </h2>
          <ul style={{ color: "var(--cor-tinta-media)", fontSize: "0.92rem", paddingLeft: 20, lineHeight: 1.7 }}>
            <li>Imprima em pelo menos 5 cm de lado e plastifique ou coloque em display acrílico.</li>
            <li>
              Escreva ao lado: <em>&quot;Não sabe o que pedir? Aponte a câmera.&quot;</em> O convite aumenta muito o
              uso.
            </li>
            <li>Peça para a equipe mencionar o cardápio ao levar o menu impresso, na primeira semana.</li>
            <li>Teste com o seu próprio celular antes do primeiro serviço.</li>
          </ul>
        </div>
      </div>
    </Casca>
  );
}
