/**
 * Estado de carregamento das rotas do app.
 *
 * Existe por dois motivos:
 *
 * 1. **UX**: mostrar algo imediatamente enquanto o servidor resolve a sessão e
 *    monta a tela, em vez de deixar a tela em branco.
 * 2. **Exigência do Next 16 (Cache Components)**: ler `cookies()` fora de um
 *    limite `<Suspense>` é **erro de build** ("Next.js encountered uncached or
 *    runtime data during prerendering"). O `loading.tsx` cria justamente esse
 *    limite em volta da página — sem ele, o build falha.
 *
 * Referência: `node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-components.md`
 * ("A component that reads the session must sit behind a <Suspense> boundary").
 */
export default function Loading() {
  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <p className="text-muted-foreground animate-pulse text-sm">Carregando…</p>
    </main>
  );
}
