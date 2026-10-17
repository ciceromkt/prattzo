import { describe, expect, it } from "vitest";
import {
  MAX_FOTO_ESCOLHIDA_BYTES, MAX_VIDEO_BYTES, VIDEO_SEGUNDOS_EXIBIDOS, validatePhoto, validateVideo,
} from "../src/media";

const video = (over: Partial<Parameters<typeof validateVideo>[0]> = {}) => ({
  type: "video/mp4", size: 8 * 1024 * 1024, durationSeconds: 10, width: 1080, height: 1920, ...over,
});

describe("duração do vídeo", () => {
  it("vídeo maior que a exibição passa, com aviso — não é erro do dono", () => {
    // O caso real: 15.7s baixado do Instagram, recusado por sete décimos.
    const r = validateVideo(video({ durationSeconds: 15.7 }), { exibidoAte: VIDEO_SEGUNDOS_EXIBIDOS });
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.warnings.join(" ")).toContain("primeiros 15s");
  });

  it("o aviso diz que o fim não aparece, para o dono cortar o começo se precisar", () => {
    const r = validateVideo(video({ durationSeconds: 40 }), { exibidoAte: VIDEO_SEGUNDOS_EXIBIDOS });
    expect(r.ok).toBe(true);
    expect(r.warnings.join(" ")).toContain("corte o começo");
  });

  it("vídeo dentro da exibição não avisa nada", () => {
    const r = validateVideo(video({ durationSeconds: 12 }), { exibidoAte: VIDEO_SEGUNDOS_EXIBIDOS });
    expect(r.warnings).toEqual([]);
  });

  it("meio segundo a mais não vira aviso: a duração do arquivo tem arredondamento", () => {
    const r = validateVideo(video({ durationSeconds: 15.4 }), { exibidoAte: VIDEO_SEGUNDOS_EXIBIDOS });
    expect(r.warnings).toEqual([]);
  });

  it("acima de um minuto é recusado: não é vídeo de prato", () => {
    const r = validateVideo(video({ durationSeconds: 95 }), { exibidoAte: VIDEO_SEGUNDOS_EXIBIDOS });
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toContain("envie um trecho");
  });

  it("o vídeo de ambiente da capa não ganha aviso de corte: ele roda em laço", () => {
    const r = validateVideo(video({ durationSeconds: 30 }));
    expect(r.ok).toBe(true);
    expect(r.warnings).toEqual([]);
  });
});

describe("o que continua sendo recusado", () => {
  it("arquivo acima do que o Storage aceita", () => {
    expect(validateVideo(video({ size: MAX_VIDEO_BYTES + 1 })).ok).toBe(false);
    // A mensagem tem de dizer o tamanho DELE e o que fazer, não só "comprima".
    const r = validateVideo(video({ size: 64 * 1024 * 1024 }));
    expect(r.errors.join(" ")).toContain("64 MB");
    expect(r.errors.join(" ")).toContain("trecho mais curto");
  });

  it("vídeo de celular de 30 MB SOBE — era o que os 20 MB barravam", () => {
    const r = validateVideo(video({ size: 30 * 1024 * 1024 }));
    expect(r.ok).toBe(true);
  });

  it("formato que o navegador do cliente não toca", () => {
    expect(validateVideo(video({ type: "video/avi" })).ok).toBe(false);
    expect(validatePhoto({ type: "image/gif", size: 1000 }).ok).toBe(false);
  });
});

describe("avisos que não barram o envio", () => {
  it("vídeo pesado avisa que o cliente vai esperar, mas sobe", () => {
    const r = validateVideo(video({ size: 30 * 1024 * 1024 }));
    expect(r.ok).toBe(true);
    expect(r.warnings.join(" ")).toContain("30 MB");
    expect(r.warnings.join(" ")).toContain("4G");
  });

  it("vídeo dentro do confortável não enche a tela de aviso", () => {
    const r = validateVideo(video({ size: 6 * 1024 * 1024 }));
    expect(r.warnings.join(" ")).not.toContain("pesado");
  });

  it("vídeo deitado avisa, mas sobe", () => {
    const r = validateVideo(video({ width: 1920, height: 1080 }));
    expect(r.ok).toBe(true);
    expect(r.warnings.join(" ")).toContain("vertical");
  });
});

describe("teto da foto escolhida", () => {
  it("foto de celular novo (10 MB) passa no cadastro do prato: ela é reduzida no recorte", () => {
    const r = validatePhoto(
      { type: "image/jpeg", size: 10 * 1024 * 1024, width: 4032, height: 3024 },
      { maxBytes: MAX_FOTO_ESCOLHIDA_BYTES },
    );
    expect(r.ok).toBe(true);
  });

  it("a mesma foto é recusada onde o arquivo sobe como está — o logo da casa", () => {
    const r = validatePhoto({ type: "image/jpeg", size: 10 * 1024 * 1024 });
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toContain("5 MB");
  });

  it("arquivo absurdo continua barrado: o navegador não aguenta decodificar", () => {
    const r = validatePhoto(
      { type: "image/jpeg", size: 40 * 1024 * 1024 },
      { maxBytes: MAX_FOTO_ESCOLHIDA_BYTES },
    );
    expect(r.ok).toBe(false);
  });
});
