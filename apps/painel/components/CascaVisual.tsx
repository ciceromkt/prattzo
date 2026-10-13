import { BRAND } from "@prattzo/core";

/**
 * A moldura do painel: barra lateral fixa à esquerda e uma área de conteúdo.
 *
 * É só apresentação, e recebe a navegação por slot — no app ela é feita de
 * links, e na demonstração de botões. Assim a mesma casca serve aos dois sem
 * que a demonstração precise de uma cópia que desatualiza.
 */
export function CascaVisual({
  children, titulo, descricao, acoes, nav, restaurante, rodape,
}: {
  children: React.ReactNode;
  titulo: string;
  descricao?: string;
  /** Botões no alto da área de conteúdo (abas da seção, por exemplo). */
  acoes?: React.ReactNode;
  nav: React.ReactNode;
  restaurante: { nome: string; publicado: boolean };
  rodape?: React.ReactNode;
}) {
  return (
    <div className="app">
      <aside className="barra-lateral">
        <span className="marca">{BRAND.name}</span>
        <div className="barra-lateral__restaurante">
          <p className="barra-lateral__nome">{restaurante.nome}</p>
          <span className={`selo ${restaurante.publicado ? "selo--publicado" : "selo--rascunho"}`}>
            {restaurante.publicado ? "● Publicado" : "○ Rascunho"}
          </span>
        </div>

        {nav}

        {rodape ? <div className="barra-lateral__pe">{rodape}</div> : null}
      </aside>

      <main className="principal">
        <div className="principal__interno">
          <header className="cabeca">
            <h1>{titulo}</h1>
            {descricao ? <p>{descricao}</p> : null}
          </header>
          {acoes ? <div className="abas">{acoes}</div> : null}
          {children}
        </div>
      </main>
    </div>
  );
}
