"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

type Modo = "senha" | "cadastro" | "link";

export function FormularioEntrar({ destino }: { destino: string }) {
  const router = useRouter();
  const [modo, setModo] = useState<Modo>("senha");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [estado, setEstado] = useState<"inicial" | "enviando" | "link_enviado">("inicial");
  const [erro, setErro] = useState<string | null>(null);

  function cliente() {
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    );
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEstado("enviando");

    try {
      const supabase = cliente();

      if (modo === "link") {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback?de=${encodeURIComponent(destino)}` },
        });
        if (error) throw error;
        setEstado("link_enviado");
        return;
      }

      if (modo === "cadastro") {
        const { error } = await supabase.auth.signUp({
          email,
          password: senha,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) throw error;
        // Com confirmação de e-mail ativada, a sessão só vem depois do clique no link.
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          setEstado("link_enviado");
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (error) throw error;
      }

      router.push(destino);
      router.refresh();
    } catch (err) {
      setErro(traduzirErro(err));
      setEstado("inicial");
    }
  }

  if (estado === "link_enviado") {
    return (
      <div className="aviso" style={{ marginTop: 20, borderColor: "var(--cor-sucesso)" }}>
        <p style={{ margin: 0 }}>
          ✉ Enviamos um link para <strong>{email}</strong>. Abra o e-mail no celular ou no computador para entrar.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} style={{ marginTop: 24 }}>
      <label className="campo">
        <span className="campo__rotulo">E-mail</span>
        <input
          className="campo__entrada"
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="voce@restaurante.com.br"
        />
      </label>

      {modo !== "link" && (
        <label className="campo">
          <span className="campo__rotulo">Senha</span>
          <input
            className="campo__entrada"
            type="password"
            name="password"
            autoComplete={modo === "cadastro" ? "new-password" : "current-password"}
            required
            minLength={8}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder={modo === "cadastro" ? "Pelo menos 8 caracteres" : ""}
          />
        </label>
      )}

      {erro ? <p className="aviso aviso--erro">{erro}</p> : null}

      <button type="submit" className="botao botao--grande" disabled={estado === "enviando"}>
        {estado === "enviando"
          ? "Aguarde…"
          : modo === "cadastro"
            ? "Criar conta"
            : modo === "link"
              ? "Enviar link de acesso"
              : "Entrar"}
      </button>

      <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 16 }}>
        {modo !== "senha" && (
          <button type="button" className="botao botao--texto" onClick={() => setModo("senha")}>
            Entrar com e-mail e senha
          </button>
        )}
        {modo !== "cadastro" && (
          <button type="button" className="botao botao--texto" onClick={() => setModo("cadastro")}>
            Criar uma conta
          </button>
        )}
        {modo !== "link" && (
          <button type="button" className="botao botao--texto" onClick={() => setModo("link")}>
            Receber link por e-mail
          </button>
        )}
      </div>
    </form>
  );
}

function traduzirErro(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/invalid login credentials/i.test(msg)) return "E-mail ou senha incorretos.";
  if (/already registered/i.test(msg)) return "Este e-mail já tem conta. Entre com a senha.";
  if (/password should be at least/i.test(msg)) return "A senha precisa de pelo menos 8 caracteres.";
  if (/rate limit|too many/i.test(msg)) return "Muitas tentativas. Aguarde um minuto.";
  if (/email.*invalid|invalid.*email/i.test(msg)) return "E-mail inválido.";
  return "Não conseguimos entrar agora. Tente novamente.";
}
