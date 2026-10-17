/**
 * Quanto de cada vídeo o cardápio mostra ao cliente.
 *
 * Não é limite de arquivo, é limite de atenção: passados uns 15 segundos o
 * cliente já passou para o próximo prato. Vídeo maior é aceito e tocado até
 * aqui — o que o dono precisa saber, e a tela diz no envio, é que o fim não vai
 * aparecer. Recusar o arquivo por causa de meio segundo, como acontecia antes,
 * é devolver trabalho para quem baixou o vídeo do Instagram e não tem editor.
 */
export const VIDEO_SEGUNDOS_EXIBIDOS = 15;

/** Acima disto o arquivo é recusado: não é vídeo de prato, é outra coisa. */
export const MAX_VIDEO_SECONDS = 60;

/**
 * Teto do arquivo de vídeo: 50 MB.
 *
 * Não é um número escolhido — é o limite por arquivo do plano gratuito do
 * Supabase, onde a mídia mora. Mandar mais que isso não é questão de afrouxar
 * a validação: o Storage recusa.
 *
 * Eram 20 MB, e barrava vídeo de celular novo, que grava em bitrate alto e
 * passa disso em poucos segundos. Quem baixou o vídeo do Instagram e não tem
 * editor não tinha o que fazer com "comprima antes de enviar".
 */
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

/**
 * Acima disto o arquivo sobe, com aviso: quem paga a conta é o cliente.
 *
 * O cardápio serve o arquivo como ele é, e o celular do salão está no 4G.
 * Os onze vídeos que já estão no ar têm 2,7 MB em média e abrem na hora; um
 * de 40 MB faz o cliente olhar para um quadro parado. O aviso diz isso na
 * hora do envio, quando ainda dá para escolher outro trecho.
 */
export const VIDEO_BYTES_CONFORTAVEL = 12 * 1024 * 1024;
/** Teto do arquivo que SOBE como está: o logo da casa. */
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/**
 * Teto da foto que o dono ESCOLHE para um prato.
 *
 * Muito maior que o de cima, e de propósito: a foto do prato não sobe como
 * está. Ela passa pelo enquadramento, que a reencoda em no máximo 1080 de
 * largura — o arquivo que chega no Storage tem algumas centenas de KB, venha
 * de onde vier. Medir o arquivo ORIGINAL contra 5 MB barrava foto de celular
 * novo, que sai com 8, 10, 12 MB, por um limite que o resultado nunca
 * encostaria. Aqui o número serve só para não travar o navegador decodificando
 * uma imagem gigante.
 */
export const MAX_FOTO_ESCOLHIDA_BYTES = 30 * 1024 * 1024;
export const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"] as const;
export const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
/** Proporção vertical esperada (9:16), com tolerância. */
export const TARGET_ASPECT = 9 / 16;
export const ASPECT_TOLERANCE = 0.25;

/**
 * Tamanho do recorte que o dono escolhe no envio da foto.
 *
 * 9:16 porque é a tela inteira do celular, que é onde a foto do prato aparece
 * grande. A foto de restaurante quase sempre chega deitada, e encaixar deitado
 * em 9:16 por conta própria corta o prato ao meio — daí a tela de recorte.
 * 1080 de largura é o limite: é o que o celular mostra, e subir mais que isso
 * só pesa no 4G do salão.
 */
export const RECORTE_LARGURA = 1080;
export const RECORTE_ALTURA = 1920;

/**
 * A capa da categoria é deitada (3:2), e não em pé como a foto do prato.
 *
 * Por isso ela precisa do seu próprio recorte: a mesma foto que fica certa na
 * tela do prato entra na grade da home como uma faixa fina do meio dela — foi
 * o que aconteceu com o quadro do vídeo do torresmo, que virou uma tira.
 */
export const CAPA_LARGURA = 1200;
export const CAPA_ALTURA = 800;

export interface MediaValidationInput {
  type: string;
  size: number;
  durationSeconds?: number;
  width?: number;
  height?: number;
}

export interface MediaValidation {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export function validateVideo(
  input: MediaValidationInput,
  opcoes: {
    /**
     * Quanto deste vídeo vai ao ar. Acima disso o envio passa, com aviso.
     * O vídeo de ambiente da capa não manda nada aqui: ele roda em laço, então
     * não existe "pedaço cortado" para avisar.
     */
    exibidoAte?: number;
  } = {},
): MediaValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!(ALLOWED_VIDEO_TYPES as readonly string[]).includes(input.type)) {
    errors.push("Formato não aceito. Envie MP4, MOV ou WebM.");
  }
  const mb = (n: number) => Math.round(n / 1024 / 1024);
  if (input.size > MAX_VIDEO_BYTES) {
    errors.push(
      `Vídeo de ${mb(input.size)} MB. O limite é ${mb(MAX_VIDEO_BYTES)} MB — envie um trecho mais curto `
      + `ou grave em qualidade menor (no iPhone: Ajustes › Câmera › Gravar vídeo › 1080p 30 fps).`,
    );
  } else if (input.size > VIDEO_BYTES_CONFORTAVEL) {
    // Aviso, não erro: sobe, mas o dono precisa saber que o cliente espera.
    warnings.push(
      `Vídeo pesado (${mb(input.size)} MB). Ele sobe, mas no 4G do salão o cliente espera para ver. `
      + "Um trecho de 10 a 15 segundos costuma ficar abaixo de 10 MB e abre na hora.",
    );
  }
  if (input.durationSeconds !== undefined && input.durationSeconds > MAX_VIDEO_SECONDS + 0.5) {
    errors.push(
      `Vídeo com ${Math.round(input.durationSeconds)}s. Acima de ${MAX_VIDEO_SECONDS}s não é vídeo de prato — `
      + "envie um trecho.",
    );
  } else if (
    opcoes.exibidoAte !== undefined
    && input.durationSeconds !== undefined
    && input.durationSeconds > opcoes.exibidoAte + 0.5
  ) {
    // Aviso, não erro: o arquivo sobe inteiro e o cardápio toca o começo. O que
    // o dono precisa saber é que o fim não vai aparecer — se o melhor pedaço
    // estiver lá, ele corta antes de enviar.
    warnings.push(
      `Vídeo com ${Math.round(input.durationSeconds)}s: o cardápio mostra os primeiros `
      + `${opcoes.exibidoAte}s e passa para o próximo prato. Se o melhor pedaço estiver no fim, `
      + "corte o começo antes de enviar.",
    );
  }
  if (input.width && input.height) {
    const aspect = input.width / input.height;
    if (aspect > TARGET_ASPECT + ASPECT_TOLERANCE) {
      warnings.push("O vídeo não é vertical. No celular ele aparece com tarjas.");
    }
    if (input.height < 720) {
      warnings.push("Resolução baixa (menos de 720p de altura).");
    }
  }
  return { ok: errors.length === 0, errors, warnings };
}

export function validatePhoto(
  input: MediaValidationInput,
  opcoes: {
    /** Teto do arquivo escolhido. O padrão vale para quem sobe sem recortar. */
    maxBytes?: number;
  } = {},
): MediaValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const teto = opcoes.maxBytes ?? MAX_PHOTO_BYTES;
  if (!(ALLOWED_PHOTO_TYPES as readonly string[]).includes(input.type)) {
    errors.push("Formato não aceito. Envie JPG, PNG ou WebP.");
  }
  if (input.size > teto) {
    errors.push(`Imagem acima de ${Math.round(teto / 1024 / 1024)} MB.`);
  }
  if (input.width && input.height && input.width < 800) {
    warnings.push("Imagem pequena. O ideal é pelo menos 1080px de largura.");
  }
  return { ok: errors.length === 0, errors, warnings };
}

/**
 * Caminho dentro do bucket.
 *
 * A primeira pasta é SEMPRE o id do restaurante: é o que a política do Storage
 * confere para decidir quem pode escrever. Mudar isso aqui abre o bucket de um
 * cliente para outro.
 */
export function mediaPath(restaurantId: string, dishId: string, kind: "foto" | "video", ext: string): string {
  const safeExt = ext.replace(/[^a-z0-9]/gi, "").toLowerCase() || "bin";
  return `${restaurantId}/${dishId}/${kind}-${Date.now()}.${safeExt}`;
}

/**
 * Caminho da mídia de um item que ainda não existe.
 *
 * O cadastro de item novo é uma tela só: o dono preenche os dados E escolhe as
 * fotos antes de gravar qualquer coisa. Mas `mediaPath` exige o id do prato, que
 * só nasce no Salvar — e esperar o Salvar para então subir um vídeo de 18 MB
 * transformaria o botão numa espera de um minuto, com tudo para perder se a
 * conexão cair no fim.
 *
 * Então o arquivo sobe assim que é escolhido, para esta pasta, enquanto o dono
 * ainda digita a descrição. O Salvar só grava as linhas apontando para ele. A
 * primeira pasta continua sendo o id do restaurante, que é o que a política do
 * Storage confere.
 */
export function rascunhoPath(restaurantId: string, kind: "foto" | "video", ext: string): string {
  const safeExt = ext.replace(/[^a-z0-9]/gi, "").toLowerCase() || "bin";
  return `${restaurantId}/novos/${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExt}`;
}

/** Mídia do restaurante, não de um prato: vídeo de capa, logo e capa de categoria. */
export function brandingPath(restaurantId: string, kind: "capa" | "logo" | "categoria", ext: string): string {
  const safeExt = ext.replace(/[^a-z0-9]/gi, "").toLowerCase() || "bin";
  return `${restaurantId}/casa/${kind}-${Date.now()}.${safeExt}`;
}
