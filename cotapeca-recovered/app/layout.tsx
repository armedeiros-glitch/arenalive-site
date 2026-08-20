import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CotaPeça",
  description: "Fundação técnica da V1 do CotaPeça",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
