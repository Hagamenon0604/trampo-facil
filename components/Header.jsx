export function Header() {
  return (
    <header className="topbar">
      <a className="brand" href="/#inicio" aria-label="Trampo Fácil">
        <img className="brand-logo" src="/assets/as-gestao-logo.png" alt="A&S Gestão de Pessoas" />
        <span>Trampo Fácil</span>
      </a>

      <nav className="nav" aria-label="Navegação principal">
        <a href="/#vagas">Vagas</a>
        <a href="/#agendar">Agendar</a>
        <a href="/#empresas">Cadastrar vaga</a>
        <a href="/#curriculos">
          <span className="desktop-label">Cadastrar currículo</span>
          <span className="mobile-label">Currículo</span>
        </a>
        <a href="/admin">Admin</a>
      </nav>
    </header>
  );
}
