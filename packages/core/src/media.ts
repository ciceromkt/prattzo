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
export const MAX_VIDEO_BYTES = 20 * 1024 * 1024;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
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
  if (input.size > MAX_VIDEO_BYTES) {
    errors.push(`Vídeo acima de ${Math.round(MAX_VIDEO_BYTES / 1024 / 1024)} MB. Comprima antes de enviar.`);
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

export function validatePhoto(input: MediaValidationInput): MediaValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!(ALLOWED_PHOTO_TYPES as readonly string[]).includes(input.type)) {
    errors.push("Formato não aceito. Envie JPG, PNG ou WebP.");
  }
  if (input.size > MAX_PHOTO_BYTES) {
    errors.push(`Imagem acima de ${Math.round(MAX_PHOTO_BYTES / 1024 / 1024)} MB.`);
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

/** Mídia do restaurante, não de um prato: vídeo de capa e logo. */
export function brandingPath(restaurantId: string, kind: "capa" | "logo", ext: string): string {
  const safeExt = ext.replace(/[^a-z0-9]/gi, "").toLowerCase() || "bin";
  return `${restaurantId}/casa/${kind}-${Date.now()}.${safeExt}`;
}
