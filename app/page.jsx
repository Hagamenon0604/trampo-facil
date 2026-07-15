import { Header } from "@/components/Header";
import { PlatformClient } from "@/components/PlatformClient";
import { getJobs, getPlatformStatus, getResumeCount } from "@/lib/data";

export default async function HomePage({ searchParams }) {
  const [jobs, resumeCount] = await Promise.all([getJobs(), getResumeCount()]);
  const status = getPlatformStatus();
  const resolvedSearchParams = await searchParams;
  const embedMode = resolvedSearchParams?.embed === "1";

  return (
    <main className={embedMode ? "embed-surface" : ""}>
      {!embedMode ? <Header /> : null}

      {!embedMode ? (
        <section className="hero" id="inicio">
          <div className="hero-media" role="img" aria-label="Equipe de restaurante em atendimento" />
          <div className="hero-content">
            <p className="eyebrow">A&S Gestão apresenta</p>
            <h1>Trampo Fácil</h1>
            <p>
              Aqui na A&S Gestão conectamos talentos às melhores oportunidades. Profissionais podem cadastrar seus
              currículos gratuitamente, enquanto empresas divulgam vagas e encontram candidatos qualificados com mais
              agilidade.
            </p>
            <div className="hero-actions">
              <a className="button primary" href="#vagas">
                Ver vagas
              </a>
              <a className="button secondary" href="#curriculos">
                Enviar currículo
              </a>
              <a className="button dark" href="#agendar">
                Agendar entrevista
              </a>
            </div>
          </div>
        </section>
      ) : null}

      <PlatformClient
        initialJobs={jobs}
        initialResumeCount={resumeCount}
        databaseConfigured={status.databaseConfigured}
      />

      {!embedMode ? (
        <section className="section partner-band">
          <div>
            <p className="eyebrow">Uma solução A&S Gestão</p>
            <h2>Recrutamento mais ágil para o food service</h2>
          </div>
          <a className="button dark" href="https://www.aesgestao.com/" target="_blank" rel="noreferrer">
            Conhecer a consultoria
          </a>
        </section>
      ) : null}
    </main>
  );
}
