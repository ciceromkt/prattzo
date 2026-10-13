/**
 * Tradutor PostgREST → Postgres, só para teste local.
 *
 * O `@supabase/supabase-js` não fala com o Postgres: ele fala HTTP com o
 * PostgREST, que o Supabase hospeda. Como o PostgREST não pode ser baixado
 * neste ambiente, este arquivo implementa o pedaço dele que o projeto usa.
 *
 * O que isto permite testar de verdade: o código do app sem nenhuma alteração,
 * as consultas como elas são escritas, e — o mais importante — as políticas de
 * RLS, porque cada requisição roda com `set local role` e o `sub` do JWT, igual
 * ao Supabase. O que NÃO é real: o próprio PostgREST e o GoTrue (login), que
 * aqui é um atalho de teste.
 *
 * Uso: node supabase/teste/servidor-rest.mjs
 */
import { createServer } from "node:http";
import pg from "pg";
import jwt from "jsonwebtoken";

// O PostgREST devolve timestamp como texto do Postgres, com microssegundos.
// O driver converteria para Date e o JSON perderia precisão — justamente o que
// quebrou a trava otimista no primeiro teste.
pg.types.setTypeParser(1114, (v) => v);
pg.types.setTypeParser(1184, (v) => v);

const PORTA = Number(process.env.PORTA ?? 3100);
const SEGREDO = process.env.JWT_SECRET ?? "segredo-de-teste-do-pede-esse-1234567890";

const pool = new pg.Pool({
  host: "/tmp", port: 5433, user: "postgres", database: "pede_esse", max: 10,
});

/** Chaves no formato do Supabase: JWT com o papel dentro. */
export function chave(role, sub) {
  return jwt.sign({ role, ...(sub ? { sub } : {}) }, SEGREDO, { expiresIn: "10y" });
}

function papelDoToken(req) {
  const auth = req.headers.authorization ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : (req.headers.apikey ?? "");
  try {
    const p = jwt.verify(token, SEGREDO);
    return { role: p.role ?? "anon", sub: p.sub ?? null };
  } catch {
    return { role: "anon", sub: null };
  }
}

// ----------------------------------------------------------------- filtros
/** Traduz `coluna=eq.valor` / `is.null` / `gt.` … para SQL com parâmetro. */
function condicao(coluna, bruto, params) {
  const i = bruto.indexOf(".");
  const op = bruto.slice(0, i);
  const valor = bruto.slice(i + 1);
  const col = `"${coluna.replace(/"/g, "")}"`;
  const mapa = { eq: "=", neq: "<>", gt: ">", gte: ">=", lt: "<", lte: "<=", like: "like", ilike: "ilike" };

  if (op === "is") return `${col} is ${valor === "null" ? "null" : valor}`;
  if (op === "in") {
    const lista = valor.replace(/^\(|\)$/g, "").split(",").map((v) => v.replace(/^"|"$/g, ""));
    params.push(lista);
    return `${col} = any($${params.length})`;
  }
  if (!mapa[op]) throw new Error(`operador não suportado no teste: ${op}`);
  params.push(valor);
  return `${col} ${mapa[op]} $${params.length}`;
}

function montaSelect(tabela, url, params) {
  const colunas = (url.searchParams.get("select") ?? "*")
    .split(",").map((c) => (c.trim() === "*" ? "*" : `"${c.trim()}"`)).join(", ");

  const ondes = [];
  for (const [k, v] of url.searchParams) {
    if (["select", "order", "limit", "offset"].includes(k)) continue;
    ondes.push(condicao(k, v, params));
  }

  let sql = `select ${colunas} from public."${tabela}"`;
  if (ondes.length) sql += ` where ${ondes.join(" and ")}`;

  const order = url.searchParams.get("order");
  if (order) {
    sql += " order by " + order.split(",").map((o) => {
      const [col, ...resto] = o.split(".");
      const dir = resto.includes("desc") ? "desc" : "asc";
      return `"${col}" ${dir}`;
    }).join(", ");
  }
  const limit = url.searchParams.get("limit");
  if (limit) sql += ` limit ${Number(limit)}`;
  return sql;
}

function corpoJson(req) {
  return new Promise((resolve) => {
    let b = "";
    req.on("data", (c) => { b += c; });
    req.on("end", () => { try { resolve(b ? JSON.parse(b) : null); } catch { resolve(null); } });
  });
}

const servidor = createServer(async (req, res) => {
  const url = new URL(req.url, "http://local");
  const { role, sub } = papelDoToken(req);
  const responde = (status, corpo) => {
    res.writeHead(status, { "content-type": "application/json", "access-control-allow-origin": "*" });
    res.end(corpo === undefined ? "" : JSON.stringify(corpo));
  };

  if (req.method === "OPTIONS") return responde(200, {});

  // Atalho de teste no lugar do GoTrue: devolve o usuário do token.
  if (url.pathname === "/auth/v1/user") {
    if (!sub) return responde(401, { message: "sem sessão" });
    return responde(200, { id: sub, aud: "authenticated", role: "authenticated", email: "dono@teste" });
  }
  if (url.pathname.startsWith("/auth/")) return responde(200, {});

  // Storage: devolve URL assinada de mentira, só para o fluxo não quebrar.
  if (url.pathname.startsWith("/storage/")) {
    return responde(200, { url: "http://localhost:3100/upload-falso", token: "falso" });
  }

  const rest = url.pathname.replace(/^\/rest\/v1\/?/, "");
  if (!rest) return responde(404, { message: "rota desconhecida" });

  const cliente = await pool.connect();
  try {
    await cliente.query("begin");
    // É isto que faz o teste valer: a requisição roda com o papel e o usuário
    // do token, então as políticas de RLS são as mesmas da produção.
    await cliente.query(`set local role ${role === "service_role" ? "service_role" : role === "authenticated" ? "authenticated" : "anon"}`);
    await cliente.query("select set_config('request.jwt.claim.sub', $1, true)", [sub ?? ""]);

    let r;
    if (rest.startsWith("rpc/")) {
      const fn = rest.slice(4);
      const args = (await corpoJson(req)) ?? {};
      const nomes = Object.keys(args);
      const sql = `select public."${fn}"(${nomes.map((n, i) => `"${n}" => $${i + 1}`).join(", ")}) as r`;
      r = await cliente.query(sql, nomes.map((n) => args[n]));
      await cliente.query("commit");
      return responde(200, r.rows[0]?.r ?? null);
    }

    const params = [];
    if (req.method === "GET") {
      r = await cliente.query(montaSelect(rest, url, params), params);
    } else if (req.method === "POST") {
      const corpo = await corpoJson(req);
      const linhas = Array.isArray(corpo) ? corpo : [corpo];
      const cols = Object.keys(linhas[0]);
      const valores = linhas.map((l, li) =>
        `(${cols.map((_, ci) => `$${li * cols.length + ci + 1}`).join(", ")})`).join(", ");
      const flat = linhas.flatMap((l) => cols.map((c) => l[c]));
      const sql = `insert into public."${rest}" (${cols.map((c) => `"${c}"`).join(", ")}) values ${valores} returning *`;
      r = await cliente.query(sql, flat);
    } else if (req.method === "PATCH") {
      const corpo = await corpoJson(req);
      const cols = Object.keys(corpo);
      const sets = cols.map((c, i) => `"${c}" = $${i + 1}`).join(", ");
      const p = cols.map((c) => corpo[c]);
      const ondes = [];
      for (const [k, v] of url.searchParams) {
        if (["select", "order", "limit", "offset"].includes(k)) continue;
        ondes.push(condicao(k, v, p));
      }
      const sql = `update public."${rest}" set ${sets}${ondes.length ? ` where ${ondes.join(" and ")}` : ""} returning *`;
      r = await cliente.query(sql, p);
    } else if (req.method === "DELETE") {
      const p = [];
      const ondes = [];
      for (const [k, v] of url.searchParams) {
        if (["select", "order", "limit", "offset"].includes(k)) continue;
        ondes.push(condicao(k, v, p));
      }
      const sql = `delete from public."${rest}"${ondes.length ? ` where ${ondes.join(" and ")}` : ""} returning *`;
      r = await cliente.query(sql, p);
    } else {
      await cliente.query("rollback");
      return responde(405, { message: "método não suportado" });
    }

    await cliente.query("commit");
    const aceita = req.headers.accept ?? "";
    // `.single()` e `.maybeSingle()` pedem object em vez de array.
    if (aceita.includes("vnd.pgrst.object")) {
      if (r.rows.length === 0) return responde(406, { message: "nenhuma linha", code: "PGRST116" });
      return responde(200, r.rows[0]);
    }
    return responde(req.method === "POST" ? 201 : 200, r.rows);
  } catch (erro) {
    await cliente.query("rollback").catch(() => {});
    const codigo = erro.code === "42501" ? 403 : 400;
    responde(codigo, { message: erro.message, code: erro.code, details: erro.detail ?? null });
  } finally {
    cliente.release();
  }
});

servidor.listen(PORTA, () => {
  console.log(`REST de teste em http://localhost:${PORTA}`);
  console.log("ANON_KEY=" + chave("anon"));
  console.log("SERVICE_KEY=" + chave("service_role"));
  console.log("DONO_KEY=" + chave("authenticated", "11111111-1111-1111-1111-111111111111"));
});
