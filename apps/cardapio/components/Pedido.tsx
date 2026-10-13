"use client";

import type { Dish, Sugestao } from "@prattzo/core";
import { capaDoPrato, priceLabel } from "@prattzo/core";

interface Linha {
  dish: Dish;
  quantidade: number;
}

/**
 * O carrinho e a lista final.
 *
 * Duas decisões que não são estéticas:
 *
 * 1. Não há preço daqui para a frente. Na lista e no vídeo o cliente compara e
 *    decide; na hora de fechar, a soma na tela só assusta e tira item do pedido.
 * 2. A tela final é a lista DO CLIENTE, não uma ordem para o garçom. Ele anota
 *    como sempre anotou; se a comanda fosse lida do celular, um erro de leitura
 *    viraria culpa dele. O app só evita o "era o quê mesmo?".
 * 3. A sugestão de fechamento aparece uma vez, é pulável num toque e diz por que
 *    está ali. Sem contagem regressiva, sem "só agora", sem botão escondido: o
 *    cliente volta ao salão amanhã, e truque queima isso por alguns reais hoje.
 * 4. O que acabou enquanto ele escolhia aparece marcado, não desaparece. Sumir
 *    com um item que ele escolheu faz o cliente achar que o app perdeu o pedido.
 */
export function Pedido({
  linhas, esgotados, comanda, sugestoes, sugerindo, onMais, onMenos, onFechar,
  onFecharPedido, onVoltar, onAceitarSugestao, onPularSugestao,
}: {
  linhas: Linha[];
  /** Ids que acabaram depois de a página carregar. */
  esgotados: Record<string, true>;
  comanda: boolean;
  sugestoes: Sugestao[];
  sugerindo: boolean;
  onMais: (p: Dish) => void;
  onMenos: (p: Dish) => void;
  onFechar: () => void;
  onFecharPedido: () => void;
  onVoltar: () => void;
  onAceitarSugestao: (p: Dish) => void;
  onPularSugestao: () => void;
}) {
  const valem = linhas.filter((l) => !esgotados[l.dish.id]);
  const total = valem.reduce((n, l) => n + l.quantidade, 0);
  const plural = `${total} ${total === 1 ? "item" : "itens"}`;
  const acabaram = linhas.filter((l) => esgotados[l.dish.id]);

  if (sugerindo && sugestoes.length > 0) {
    return (
      <div className="folha" role="dialog" aria-modal="true" aria-label="Antes de fechar">
        <div className="folha__topo">
          <h2>Falta alguma coisa?</h2>
          <button type="button" className="redondo" onClick={onPularSugestao} aria-label="Pular">✕</button>
        </div>

        <p className="folha__linha-fina">Do que ninguém na mesa pediu ainda.</p>

        <div className="folha__corpo">
          {sugestoes.map(({ prato, motivo }) => {
            const capa = capaDoPrato(prato);
            return (
              <div className="sugestao" key={prato.id}>
                {capa ? <img className="sugestao__foto" src={capa} alt="" /> : <span className="sugestao__foto" />}
                <div className="sugestao__txt">
                  <span className="sugestao__motivo">{motivo}</span>
                  <span className="sugestao__nome">{prato.nome}</span>
                  {prato.descricao ? <span className="sugestao__desc">{prato.descricao}</span> : null}
                  <span className="sugestao__pe">
                    <span className="sugestao__preco">{priceLabel(prato)}</span>
                    <button type="button" className="sugestao__add" onClick={() => onAceitarSugestao(prato)}>
                      + Adicionar
                    </button>
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="folha__pe">
          <button type="button" className="btn-cheio" onClick={onPularSugestao}>
            Está bom assim
          </button>
        </div>
      </div>
    );
  }

  if (comanda) {
    return (
      <div className="comanda" role="dialog" aria-modal="true" aria-label="O que você escolheu">
        <div className="comanda__topo">
          <p className="comanda__selo">Sua lista</p>
          <h2>O que você escolheu</h2>
          <p className="comanda__instrucao">
            Para não esquecer nada quando o garçom chegar. Nada foi enviado para a cozinha.
          </p>
        </div>
        <div className="comanda__corpo">
          {linhas.map(({ dish, quantidade }) => (
            <div className="comanda__linha" key={dish.id}>
              <span className="comanda__qtd">{quantidade}×</span>
              <span className="comanda__nome">{dish.nome}</span>
            </div>
          ))}
        </div>
        <div className="comanda__pe">
          <p className="resumo">
            {plural} na lista
            <small>Você faz o pedido com o garçom</small>
          </p>
          <button type="button" className="btn-vazio" onClick={onVoltar}>Mudar minha lista</button>
        </div>
      </div>
    );
  }

  return (
    <div className="folha" role="dialog" aria-modal="true" aria-label="Meu pedido">
      <div className="folha__topo">
        <h2>Meu pedido</h2>
        <button type="button" className="redondo" onClick={onFechar} aria-label="Voltar ao cardápio">✕</button>
      </div>

      <div className="folha__corpo">
        {linhas.length === 0 ? (
          <p className="folha-vazia">
            Nada escolhido ainda.
            <br />
            Toque em “Quero esse” enquanto assiste aos vídeos.
          </p>
        ) : (
          linhas.map(({ dish, quantidade }) => {
            const capa = capaDoPrato(dish);
            const acabou = Boolean(esgotados[dish.id]);
            return (
              <div className={`item-pedido${acabou ? " item-pedido--acabou" : ""}`} key={dish.id}>
                {capa ? <img className="item-pedido__thumb" src={capa} alt="" /> : <span className="item-pedido__thumb" />}
                <span className="item-pedido__txt">
                  <span className="item-pedido__nome">{dish.nome}</span>
                  {acabou ? <span className="item-pedido__acabou">Acabou agora</span> : null}
                </span>
                {acabou ? (
                  <button
                    type="button"
                    className="item-pedido__tirar"
                    onClick={() => { for (let i = 0; i < quantidade; i++) onMenos(dish); }}
                  >
                    Tirar
                  </button>
                ) : (
                  <span className="contador">
                    <button type="button" onClick={() => onMenos(dish)} aria-label="Tirar um">−</button>
                    <span>{quantidade}</span>
                    <button type="button" onClick={() => onMais(dish)} aria-label="Mais um">+</button>
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>

      {linhas.length > 0 ? (
        <div className="folha__pe">
          <p className="resumo">
            {plural} no pedido
            <small>
              {acabaram.length > 0
                ? `${acabaram.length === 1 ? "1 item acabou" : `${acabaram.length} itens acabaram`} e não entra na lista`
                : "Os valores estão no cardápio"}
            </small>
          </p>
          <button type="button" className="btn-cheio" onClick={onFecharPedido} disabled={total === 0}>
            Fechar pedido
          </button>
          <button type="button" className="btn-vazio" onClick={onFechar}>Continuar escolhendo</button>
        </div>
      ) : null}
    </div>
  );
}
