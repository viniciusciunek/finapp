import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  applicationName: "Finanças do Casal",
  title: {
    default: "Finanças do Casal",
    template: "%s · Finanças do Casal",
  },
  description:
    "Controle financeiro pessoal e da família — chega de caderno e planilha.",
  appleWebApp: {
    capable: true,
    title: "Finanças",
    statusBarStyle: "default",
  },
  // O iOS adora transformar números soltos em links de telefone — péssimo num
  // app cheio de valores em reais.
  formatDetection: {
    telephone: false,
  },
  // Os ícones (favicon.ico, icon.png e apple-icon.png) vêm da **convenção de
  // arquivo** do App Router, em `src/app/`. Eles são gerados por
  // `scripts/generate-icons.py` — não editar à mão.
  // O manifest (`src/app/manifest.ts`) cuida da instalação no Android/desktop.
};

export const viewport: Viewport = {
  themeColor: "#047857",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={cn("font-sans", geist.variable)}>
      <body>{children}</body>
    </html>
  );
}
