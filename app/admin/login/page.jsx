import { AdminLoginForm } from "@/components/AdminLoginForm";

export default function AdminLoginPage({ searchParams }) {
  return (
    <main className="login-page">
      <section className="login-panel">
        <img className="brand-logo" src="/assets/as-gestao-logo.png" alt="A&S Gestão de Pessoas" />
        <p className="eyebrow">Área restrita</p>
        <h1>Entrar no painel A&S</h1>
        <p>
          Acesse currículos, pipeline de vagas e agenda operacional da plataforma Trampo Fácil.
        </p>
        <AdminLoginForm nextPath={searchParams?.next || "/admin"} />
      </section>
    </main>
  );
}
