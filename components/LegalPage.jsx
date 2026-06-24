import { Header } from "@/components/Header";

export function LegalPage({ eyebrow, title, updatedAt, children }) {
  return (
    <main>
      <Header />
      <article className="legal-page">
        <header>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="legal-updated">Atualizado em {updatedAt}</p>
        </header>
        <div className="legal-content">{children}</div>
      </article>
    </main>
  );
}
