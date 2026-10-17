import Link from "next/link";
import type { Oportunidade } from "@prattzo/core";

const ROTULO: Record<Oportunidade["tipo"], string> = {
  alto_interesse: "Está funcionando",
  baixo_desempenho: "Não está convencendo",
  pouco_descoberto: "Ninguém acha",
  sem_harmonizacao: "Oferta que falta",
  sem_video: "Teste de vídeo",
  par_promissor: "Combinação que rende",
};

/**
 * As recomendações.
 *
 * Cada cartão carrega os números que o sustentam, e não só a conclusão. É o
 * que separa isto de um horóscopo: o dono pode discordar da leitura, mas
 * consegue conferir a conta — e, se discordar, ele aprendeu o número mesmo
 * assim. O botão leva direto para a tela onde a ação acontece, porque uma
 * recomendação que exige procurar onde se faz aquilo não é seguida.
 */
export function Oportunidades({ itens }: { itens: readonly Oportunidade[] }) {
  if (itens.length === 0) {
    return (
      <p className="vazio-suave">
        Nenhuma recomendação neste período. Ou o movimento ainda é pequeno para sustentar uma
        conclusão, ou o cardápio está equilibrado — nos dois casos, não há o que inventar aqui.
      </p>
    );
  }

  return (
    <ul className="oportunidades">
      {itens.map((o) => (
        <li className={`oport oport--${o.tipo}`} key={`${o.tipo}:${o.dishId}:${o.alvoId ?? ""}`}>
          <span className="oport__tipo">{ROTULO[o.tipo]}</span>
          <h3 className="oport__titulo">{o.titulo}</h3>
          <p className="oport__dados">{o.dados}</p>
          <p className="oport__porque">{o.porque}</p>
          <p className="oport__acao">{o.acao}</p>
          <Link className="bt bt--mini" href={o.destino.href}>{o.destino.rotulo} →</Link>
        </li>
      ))}
    </ul>
  );
}
