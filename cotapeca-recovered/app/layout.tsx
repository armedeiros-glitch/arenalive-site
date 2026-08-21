import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CotaPeça | Encontre a peça sem ligar de loja em loja",
  description: "Faça seu pedido uma vez. O CotaPeça procura lojas que podem ter a peça e organiza as respostas para você.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
