"use client";

import { useMemo, useState, useTransition } from "react";

function formatDate(dateText) {
  const date = new Date(dateText);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

function normalizeJob(job) {
  return {
    ...job,
    created_at: job.created_at || job.createdAt || new Date().toISOString(),
  };
}

async function submitJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || "Não foi possível concluir a operação.");
  }

  return result.data;
}

export function PlatformClient({ initialJobs, initialResumeCount, databaseConfigured }) {
  const [jobs, setJobs] = useState(initialJobs.map(normalizeJob));
  const [resumeCount, setResumeCount] = useState(initialResumeCount);
  const [query, setQuery] = useState("");
  const [selectedJob, setSelectedJob] = useState(null);
  const [desiredRole, setDesiredRole] = useState("");
  const [toast, setToast] = useState("");
  const [isPending, startTransition] = useTransition();

  const visibleJobs = useMemo(() => {
    const term = query.toLowerCase().trim();
    if (!term) {
      return jobs;
    }

    return jobs.filter((job) =>
      [job.company, job.role, job.neighborhood, job.shift, job.description]
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [jobs, query]);

  function showToast(message) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  }

  function handleJobSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());

    startTransition(async () => {
      try {
        const created = await submitJson("/api/jobs", data);
        setJobs((currentJobs) => [normalizeJob(created), ...currentJobs]);
        form.reset();
        showToast("Vaga publicada com sucesso.");
      } catch (error) {
        showToast(error.message);
      }
    });
  }

  function handleResumeSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    data.lgpd_accepted = formData.get("lgpd_accepted") === "on";
    data.job_id = selectedJob?.id || "";

    startTransition(async () => {
      try {
        await submitJson("/api/resumes", data);
        setResumeCount((currentCount) => currentCount + 1);
        form.reset();
        setSelectedJob(null);
        setDesiredRole("");
        showToast(
          data.job_id
            ? "Candidatura enviada com sucesso para essa vaga."
            : "Currículo cadastrado com sucesso.",
        );
      } catch (error) {
        showToast(error.message);
      }
    });
  }

  function handleApplyClick(job) {
    setSelectedJob(job);
    setDesiredRole(job.role);
    window.setTimeout(() => {
      document.getElementById("curriculos")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  return (
    <>
      {!databaseConfigured ? (
        <div className="system-banner">
          Modo demonstração: conecte o Supabase para salvar vagas e currículos em banco real.
        </div>
      ) : null}

      <section className="section stats" aria-label="Resumo da plataforma">
        <div>
          <strong>{jobs.length}</strong>
          <span>vagas abertas</span>
        </div>
        <div>
          <strong>{resumeCount}</strong>
          <span>currículos cadastrados</span>
        </div>
        <div>
          <strong>24h</strong>
          <span>para publicar uma oportunidade</span>
        </div>
      </section>

      <section className="section jobs-section" id="vagas">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Oportunidades para bares e restaurantes</p>
            <h2>Vagas para começar agora</h2>
          </div>
          <label className="search">
            <span>Buscar</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              type="search"
              placeholder="Cargo, bairro ou estabelecimento"
            />
          </label>
        </div>

        <div className="job-grid" aria-live="polite">
          {visibleJobs.length ? (
            visibleJobs.map((job) => (
              <article className="job-card" key={job.id}>
                <div>
                  <p className="eyebrow">{job.company}</p>
                  <h3>{job.role}</h3>
                </div>
                <div className="tag-row">
                  <span className="tag">{job.neighborhood}</span>
                  <span className="tag">{job.shift}</span>
                </div>
                <div className="card-meta">
                  <span>
                    <strong>Salário:</strong> {job.salary}
                  </span>
                  <span>
                    <strong>Contato:</strong> {job.contact}
                  </span>
                  <span>
                    <strong>Publicado:</strong> {formatDate(job.created_at)}
                  </span>
                </div>
                <p className="card-description">{job.description}</p>
                <button className="button primary full" type="button" onClick={() => handleApplyClick(job)}>
                  Candidatar-se
                </button>
              </article>
            ))
          ) : (
            <p className="empty">Nenhuma vaga encontrada com esse filtro.</p>
          )}
        </div>
      </section>

      <section className="section forms-layout">
        <form className="panel" id="empresas" onSubmit={handleJobSubmit}>
          <div className="form-heading">
            <p className="eyebrow">Para estabelecimentos</p>
            <h2>Cadastrar vaga</h2>
          </div>

          <div className="field-group two-columns">
            <label>
              Nome do bar ou restaurante
              <input name="company" required placeholder="Ex.: Boteco Central" />
            </label>
            <label>
              Cargo
              <input name="role" required placeholder="Ex.: Garçom" />
            </label>
          </div>

          <div className="field-group two-columns">
            <label>
              Bairro
              <input name="neighborhood" required placeholder="Ex.: Pinheiros" />
            </label>
            <label>
              Salário
              <input name="salary" required placeholder="Ex.: R$ 2.100 + gorjeta" />
            </label>
          </div>

          <div className="field-group two-columns">
            <label>
              Escala
              <select name="shift" required defaultValue="">
                <option value="">Selecione</option>
                <option>Diurno</option>
                <option>Noturno</option>
                <option>Fim de semana</option>
                <option>Escala 6x1</option>
                <option>Freelancer</option>
              </select>
            </label>
            <label>
              Contato
              <input name="contact" required placeholder="WhatsApp ou e-mail" />
            </label>
          </div>

          <label>
            Descrição da vaga
            <textarea
              name="description"
              required
              rows="4"
              placeholder="Conte as atividades, requisitos e benefícios."
            />
          </label>

          <button className="button primary full" type="submit" disabled={isPending}>
            Publicar vaga
          </button>
        </form>

        <form className="panel accent" id="curriculos" onSubmit={handleResumeSubmit}>
          <div className="form-heading">
            <p className="eyebrow">Para candidatos</p>
            <h2>{selectedJob ? "Candidatar-se à vaga" : "Cadastrar currículo"}</h2>
          </div>

          {selectedJob ? (
            <div className="selected-job">
              <div>
                <strong>{selectedJob.role}</strong>
                <span>{selectedJob.company} · {selectedJob.neighborhood}</span>
              </div>
              <button
                className="button secondary"
                type="button"
                onClick={() => {
                  setSelectedJob(null);
                  setDesiredRole("");
                }}
              >
                Trocar
              </button>
            </div>
          ) : null}

          <input name="job_id" type="hidden" value={selectedJob?.id || ""} readOnly />

          <div className="field-group two-columns">
            <label>
              Nome completo
              <input name="name" required placeholder="Seu nome" />
            </label>
            <label>
              Telefone
              <input name="phone" required placeholder="WhatsApp" />
            </label>
          </div>

          <div className="field-group two-columns">
            <label>
              E-mail
              <input name="email" type="email" placeholder="email@exemplo.com" />
            </label>
            <label>
              Cargo desejado
              <input
                name="desired_role"
                required
                value={desiredRole}
                onChange={(event) => setDesiredRole(event.target.value)}
                placeholder="Ex.: Cozinheira"
              />
            </label>
          </div>

          <div className="field-group two-columns">
            <label>
              Bairro
              <input name="neighborhood" required placeholder="Onde você busca vaga" />
            </label>
            <label>
              Disponibilidade
              <input name="availability" placeholder="Ex.: Noite, 6x1, freelancer" />
            </label>
          </div>

          <label>
            Experiência
            <textarea
              name="experience"
              required
              rows="4"
              placeholder="Resumo das experiências, cursos e disponibilidade."
            />
          </label>

          <label className="checkbox-field">
            <input name="lgpd_accepted" type="checkbox" required />
            <span>Autorizo a A&S Gestão a tratar meus dados para processos seletivos.</span>
          </label>

          <button className="button dark full" type="submit" disabled={isPending}>
            Enviar currículo
          </button>
        </form>
      </section>

      <section className="section trust-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Banco de talentos protegido</p>
            <h2>Currículos centralizados para a A&S</h2>
          </div>
        </div>
        <div className="trust-grid">
          <article className="resume-card">
            <p className="eyebrow">Privacidade</p>
            <h3>Dados pessoais não ficam públicos</h3>
            <p className="card-description">
              Currículos, telefones e observações de triagem aparecem somente no painel protegido da
              A&S.
            </p>
          </article>
          <article className="resume-card">
            <p className="eyebrow">Triagem</p>
            <h3>Pipeline para acompanhar candidatos</h3>
            <p className="card-description">
              O próximo passo é mover talentos entre novo, triagem, entrevista, aprovado e
              contratado.
            </p>
          </article>
          <article className="resume-card">
            <p className="eyebrow">Agenda</p>
            <h3>Entrevistas com status claro</h3>
            <p className="card-description">
              A agenda vai organizar horários, confirmações, faltas, remarcações e histórico de
              atendimento.
            </p>
          </article>
        </div>
      </section>

      <div className={`toast ${toast ? "visible" : ""}`} role="status" aria-live="polite">
        {toast}
      </div>
    </>
  );
}
