import type { MetadataRoute } from "next";

/**
 * Manifesto da PWA (Web App Manifest).
 *
 * O Next detecta este arquivo automaticamente e injeta
 * `<link rel="manifest" href="/manifest.webmanifest">` em todas as páginas.
 *
 * O que é necessário para o navegador oferecer "instalar na tela inicial":
 * nome, `start_url`, `display: standalone` e ícones de 192 e 512 px.
 * NÃO é necessário service worker — o guia do Next 16 é explícito
 * ("you can trigger install prompts without needing offline support").
 *
 * Decisão registrada no BUILD_LOG (P11): ficamos **sem service worker** nesta
 * fatia. Além de desnecessário, um service worker que cacheasse HTML de páginas
 * autenticadas seria um risco de segurança (servir a tela de um usuário para
 * outro a partir do cache do dispositivo).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Finanças do Casal",
    short_name: "Finanças",
    description:
      "Controle financeiro pessoal e da família — chega de caderno e planilha.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#047857",
    lang: "pt-BR",
    dir: "ltr",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        // Versão com fundo até a borda e glifo na "zona segura": o Android pode
        // recortar o ícone em círculo/squircle sem cortar o desenho.
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
