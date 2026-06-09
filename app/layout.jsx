import "./globals.css";

export const metadata = {
  title: "Trampo Fácil | A&S Gestão de Pessoas",
  description: "Vagas e currículos para bares e restaurantes.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
