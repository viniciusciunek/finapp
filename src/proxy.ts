import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseEnv } from "@/lib/supabase/env";

/**
 * Proxy do Next.js — é o antigo `middleware.ts`, renomeado no Next 16.
 * Roda antes das rotas, em todas as requisições capturadas pelo `matcher`.
 *
 * Responsabilidade única aqui: **manter a sessão do Supabase viva**.
 * Os tokens ficam em cookies; quando o access token está perto de expirar,
 * o `getClaims()` renova a sessão e o `setAll` grava os cookies novos.
 *
 * Por que `getClaims()` e não `getSession()`: `getSession()` apenas lê o cookie,
 * sem revalidar — e o cookie pode ser forjado por qualquer um. `getClaims()`
 * valida a assinatura do token a cada chamada.
 *
 * Este proxy NÃO autoriza acesso a dados: a verificação de autorização é feita
 * de novo dentro de cada página/Server Function (o matcher pode excluir rotas
 * sem querer e o proxy não é fronteira de segurança).
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const { url, publishableKey } = getSupabaseEnv();

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        // 1) Propaga os cookies renovados para a requisição atual, para que o
        //    Server Component renderizado logo em seguida já enxergue a sessão.
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }

        // 2) Regrava a resposta com a requisição atualizada e persiste os cookies.
        response = NextResponse.next({ request });

        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }

        // 3) Headers de cache obrigatórios: sem eles uma CDN pode guardar a
        //    resposta com o cookie de sessão e servir a sessão de um usuário
        //    para outro.
        for (const [key, value] of Object.entries(headers)) {
          response.headers.set(key, value);
        }
      },
    },
  });

  // Não remover: é esta chamada que renova o token expirado.
  // O retorno é ignorado de propósito — o proxy só cuida da sessão.
  await supabase.auth.getClaims();

  return response;
}

export const config = {
  matcher: [
    /*
     * Roda em todas as rotas, exceto:
     * - /_next/static  → arquivos estáticos do build
     * - /_next/image   → otimização de imagens
     * - favicon.ico, manifest.webmanifest, sw.js → arquivos de PWA/ícone
     * - /icons/* e imagens → assets públicos
     *
     * Sem o matcher, o proxy roda até em CSS/JS e pode bloquear o carregamento
     * da própria página.
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
