import { Header } from "@/components/Header";
import { getJobs, getPlatformStatus, getResumes } from "@/lib/data";

function statusLabel(status) {
  const labels = {
    published: "Publicada",
    draft: "Rascunho",
    paused: "Pausada",
    closed: "Encerrada",
    new: "Novo",
    screening: "Triagem",
    interview: "Entrevista",
    approved: "Aprovado",
    rejected: "Reprovado",
    hired: "Contratado",
  };

  return labels[status] || status;
}

export default async function AdminPage() {
  const [jobs, resumes] = await Promise.all([
    getJobs({ includeDrafts: true }),
    getResumes(),
  ]);
  const status = getPlatformStatus();

  return (
    <main>
      <Header />
      <section className="section admin-hero">
        <div>
          <p className="eyebrow">Operação A&S</p>
          <h1>Painel de recrutamento</h1>
          <p>
            Primeira visão operacional para acompanhar vagas, currículos e preparar a agenda de
            entrevistas.
          </p>
        </div>
      </section>

      {!status.databaseConfigured ? (
        <section className="section admin-warning">
          <strong>Banco ainda não conectado.</strong>
          <span>
            Configure as variáveis do Supabase para ativar persistência real e liberar o painel
            operacional.
          </span>
        </section>
      ) : null}

      <section className="section admin-kpis">
        <div>
          <span>Vagas</span>
          <strong>{jobs.length}</strong>
        </div>
        <div>
          <span>Candidatos</span>
          <strong>{resumes.length}</strong>
        </div>
        <div>
          <span>Entrevistas hoje</span>
          <strong>0</strong>
        </div>
        <div>
          <span>Contratações</span>
          <strong>0</strong>
        </div>
      </section>

      <section className="section admin-grid">
        <div className="admin-panel">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">Vagas</p>
              <h2>Pipeline de oportunidades</h2>
            </div>
          </div>
          <div className="table-list">
            {jobs.map((job) => (
              <article key={job.id} className="table-row">
                <div>
                  <strong>{job.role}</strong>
                  <span>{job.company} · {job.neighborhood}</span>
                </div>
                <span className="status-pill">{statusLabel(job.status)}</span>
              </article>
            ))}
          </div>
        </div>

        <div className="admin-panel">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">Candidatos</p>
              <h2>Talentos recentes</h2>
            </div>
          </div>
          <div className="table-list">
            {resumes.map((resume) => (
              <article key={resume.id} className="table-row">
                <div>
                  <strong>{resume.name}</strong>
                  <span>{resume.desired_role} · {resume.neighborhood}</span>
                </div>
                <span className="status-pill">{statusLabel(resume.status)}</span>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
