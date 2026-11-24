import type { Metadata } from "next";
import { Shell } from "@/components/shell";
import "@fontsource-variable/inter";
import "@fontsource-variable/funnel-display";
import "./globals.css";
export const metadata: Metadata = {
  title: "FinScope",
  description: "Controle financeiro pessoal",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>
        <a className="skip-link" href="#main">
          Pular para o conteúdo
        </a>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
