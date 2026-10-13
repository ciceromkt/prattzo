import { BRAND } from "@pede-esse/core";

export default function Home() {
  return (
    <main className="institucional">
      <h1>{BRAND.name}</h1>
      <p>{BRAND.tagline}</p>
      <p className="institucional__nota">
        Cada restaurante tem o próprio endereço. Aponte a câmera para o QR Code da mesa.
      </p>
    </main>
  );
}
