"use client";

import { useMemo, useState, useTransition } from "react";
import { TurnstileWidget } from "@/components/TurnstileWidget";

const businessWhatsappNumber = "5511950877154";
const businessWhatsappDisplay = "(11) 95087-7154";
const scheduleRoleOptions = [
  "Auxiliar de Serviços Gerais (ASG)",
  "Repositor de Buffet",
  "Atendente",
  "Cozinheiro",
  "Chef executivo",
];

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

function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getPriorityJobInfo(job) {
  const text = normalizeSearchText([job.role, job.description].join(" "));

  if (text.includes("servicos gerais") || /\basg\b/.test(text)) {
    return {
      rank: 0,
      ribbon: "Prioridade A&S",
      detail: "9 vagas abertas",
      tag: "Contratação prioritária",
      schedule: ["1º turno: 5h30 às 14h00", "2º turno: 12h30 às 21h00", "3º turno: 22h00 às 5h00"],
    };
  }

  if (text.includes("repositor de buffet") || (text.includes("repositor") && text.includes("buffet"))) {
    return {
      rank: 1,
      ribbon: "Prioridade A&S",
      detail: "Vaga em destaque",
      tag: "Contratação prioritária",
      schedule: [],
    };
  }

  return null;
}

function isRecruitingPriorityJob(job) {
  return Boolean(getPriorityJobInfo(job));
}

function sortJobsByPriority(list) {
  return [...list].sort((first, second) => {
    const firstPriority = getPriorityJobInfo(first);
    const secondPriority = getPriorityJobInfo(second);

    if (firstPriority || secondPriority) {
      return (firstPriority?.rank ?? 99) - (secondPriority?.rank ?? 99);
    }

    return new Date(second.created_at).getTime() - new Date(first.created_at).getTime();
  });
}

function businessWhatsappLink(message) {
  return `https://wa.me/${businessWhatsappNumber}?text=${encodeURIComponent(message)}`;
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

async function submitFormData(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    body: payload,
  });
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || "Não foi possível concluir a operação.");
  }

  return result.data;
}

function notificationWasSent(result) {
  return result?.status === "sent";
}

function buildScheduleFeedback(result) {
  const meetCreated = result?.meet?.status === "created" && result?.meet?.eventId;
  const adminEmailSent = notificationWasSent(result?.emailNotification);
  const candidateEmailSent = notificationWasSent(result?.candidateConfirmation);
  const whatsappSent = notificationWasSent(result?.whatsappNotification);
  const pending = [];

  if (!meetCreated) pending.push("Agenda Google");
  if (!adminEmailSent) pending.push("e-mail para A&S");
  if (!candidateEmailSent) pending.push("e-mail para candidato");
  if (!whatsappSent) pending.push("WhatsApp da A&S");

  if (!pending.length) {
    return "Entrevista agendada com sucesso. A&S recebeu os avisos por e-mail e WhatsApp.";
  }

  if (pending.length === 4) {
    return "Solicitação registrada, mas Agenda, e-mail e WhatsApp precisam de revisão nos logs da Vercel.";
  }

  return `Solicitação registrada, mas precisa revisar: ${pending.join(", ")}.`;
}

export function PlatformClient({ initialJobs, initialResumeCount, databaseConfigured }) {
  const [jobs, setJobs] = useState(() =>
    sortJobsByPriority(initialJobs.map(normalizeJob).filter(isRecruitingPriorityJob)),
  );
  const [resumeCount, setResumeCount] = useState(initialResumeCount);
  const [query, setQuery] = useState("");
  const [selectedJob, setSelectedJob] = useState(null);
  const [desiredRole, setDesiredRole] = useState("");
  const [selectedFileName, setSelectedFileName] = useState("");
  const [activeSubmit, setActiveSubmit] = useState("");
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const [toast, setToast] = useState("");
  const [isPending, startTransition] = useTransition();

  const visibleJobs = useMemo(() => {
    const term = normalizeSearchText(query).trim();
    if (!term) {
      return sortJobsByPriority(jobs);
    }

    return sortJobsByPriority(
      jobs.filter((job) =>
        [job.company, job.role, job.neighborhood, job.shift, job.description]
          .join(" ")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .includes(term),
      ),
    );
  }, [jobs, query]);

  function showToast(message, duration = 2800) {
    setToast(message);
    window.setTimeout(() => setToast(""), duration);
  }

  function handleJobSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());

    setActiveSubmit("job");
    startTransition(async () => {
      try {
        const created = await submitJson("/api/jobs", data);
        const normalizedJob = normalizeJob(created);

        if (isRecruitingPriorityJob(normalizedJob)) {
          setJobs((currentJobs) => sortJobsByPriority([normalizedJob, ...currentJobs]));
        }

        form.reset();
        showToast(
          isRecruitingPriorityJob(normalizedJob)
            ? "Vaga publicada com sucesso."
            : "Vaga recebida pela A&S. Ela será analisada antes de aparecer no portal.",
        );
      } catch (error) {
        showToast(error.message);
      } finally {
        setActiveSubmit("");
        setCaptchaResetKey((current) => current + 1);
      }
    });
  }

  function handleResumeSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set("lgpd_accepted", formData.get("lgpd_accepted") === "on" ? "true" : "");
    formData.set("job_id", selectedJob?.id || "");

    setActiveSubmit("resume");
    startTransition(async () => {
      try {
        await submitFormData("/api/resumes", formData);
        setResumeCount((currentCount) => currentCount + 1);
        form.reset();
        setSelectedJob(null);
        setDesiredRole("");
        setSelectedFileName("");
        showToast(
          selectedJob?.id
            ? "Candidatura enviada com sucesso para essa vaga."
            : "Currículo cadastrado com sucesso.",
        );
      } catch (error) {
        showToast(error.message);
      } finally {
        setActiveSubmit("");
        setCaptchaResetKey((current) => current + 1);
      }
    });
  }

  function handleScheduleSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    data.lgpd_accepted = formData.get("lgpd_accepted") === "on";

    setActiveSubmit("schedule");
    startTransition(async () => {
      try {
        const scheduleResult = await submitJson("/api/public-interviews", data);
        setResumeCount((currentCount) => currentCount + 1);
        form.reset();
        showToast(buildScheduleFeedback(scheduleResult), 7000);
      } catch (error) {
        showToast(error.message);
      } finally {
        setActiveSubmit("");
        setCaptchaResetKey((current) => current + 1);
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
            visibleJobs.map((job) => {
              const priorityJob = getPriorityJobInfo(job);

              return (
                <article className={`job-card${priorityJob ? " job-card-featured" : ""}`} key={job.id}>
                  {priorityJob ? (
                    <div className="featured-ribbon">
                      <span>{priorityJob.ribbon}</span>
                      <strong>{priorityJob.detail}</strong>
                    </div>
                  ) : null}

                  <div>
                    <p className="eyebrow">{job.company}</p>
                    <h3>{job.role}</h3>
                  </div>
                  <div className="tag-row">
                    <span className="tag">{job.neighborhood}</span>
                    <span className="tag">{job.shift}</span>
                    {priorityJob ? <span className="tag tag-urgent">{priorityJob.tag}</span> : null}
                  </div>
                  {priorityJob?.schedule?.length ? (
                    <div className="priority-schedule" aria-label="Horários da vaga prioritária">
                      {priorityJob.schedule.map((schedule) => (
                        <span key={schedule}>{schedule}</span>
                      ))}
                    </div>
                  ) : null}
                  <div className="card-meta">
                    <span>
                      <strong>Salário:</strong> {job.salary}
                    </span>
                    <span>
                      <strong>Contato:</strong>{" "}
                      <a
                        className="contact-link"
                        href={businessWhatsappLink(
                          `Olá! Vim pelo Trampo Fácil e tenho interesse na vaga de ${job.role}.`,
                        )}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {businessWhatsappDisplay}
                      </a>
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
              );
            })
          ) : (
            <p className="empty">Nenhuma vaga encontrada com esse filtro.</p>
          )}
        </div>
      </section>

      <section className="section schedule-section" id="agendar">
        <form
          className="panel schedule-panel"
          onSubmit={handleScheduleSubmit}
          aria-busy={activeSubmit === "schedule"}
        >
          <div className="form-heading">
            <p className="eyebrow">Agendamento rápido</p>
            <h2>Agendar entrevista</h2>
            <p>
              Escolha uma das vagas prioritárias e um horário para entrevista. A A&S recebe a
              solicitação por e-mail e WhatsApp Business.
            </p>
          </div>

          <div className="field-group two-columns">
            <label>
              Vaga
              <select name="desired_role" required defaultValue="">
                <option value="">Selecione</option>
                {scheduleRoleOptions.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Data e horário
              <input name="starts_at" type="datetime-local" required />
            </label>
          </div>

          <div className="field-group two-columns">
            <label>
              Nome completo
              <input name="name" required autoComplete="name" placeholder="Seu nome" />
            </label>
            <label>
              WhatsApp
              <input
                name="phone"
                required
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                placeholder="DDD + número"
              />
            </label>
          </div>

          <label>
            E-mail
            <input name="email" type="email" autoComplete="email" inputMode="email" placeholder="email@exemplo.com" />
          </label>

          <label>
            Observações
            <textarea
              name="observations"
              rows="3"
              placeholder="Conte sua disponibilidade, bairro ou alguma informação importante."
            />
          </label>

          <label className="checkbox-field">
            <input name="lgpd_accepted" type="checkbox" required />
            <span>
              Autorizo a A&S Gestão a tratar meus dados para agendamento e processos seletivos,
              conforme a <a href="/privacidade" target="_blank">Política de Privacidade</a>.
            </span>
          </label>

          <label className="honeypot" aria-hidden="true">
            Não preencha este campo
            <input name="website" tabIndex="-1" autoComplete="off" />
          </label>

          <TurnstileWidget action="interview_schedule" resetKey={`schedule-${captchaResetKey}`} />

          <div className="schedule-actions">
            <button className="button primary" type="submit" disabled={isPending}>
              {activeSubmit === "schedule" ? "Agendando..." : "Solicitar entrevista"}
            </button>
            <a
              className="button secondary"
              href={businessWhatsappLink("Olá! Quero falar com a A&S pelo Trampo Fácil.")}
              target="_blank"
              rel="noreferrer"
            >
              Falar no WhatsApp
            </a>
          </div>

          <p className="schedule-note">
            Neste momento, o agendamento está disponível para ASG, Repositor de Buffet, Atendente, Cozinheiro e Chef executivo.
          </p>
        </form>
      </section>

      <section className="section forms-layout">
        <form className="panel" id="empresas" onSubmit={handleJobSubmit} aria-busy={activeSubmit === "job"}>
          <div className="form-heading">
            <p className="eyebrow">Para estabelecimentos</p>
            <h2>Cadastrar vaga</h2>
          </div>

          <div className="field-group two-columns">
            <label>
              Nome do bar ou restaurante
              <input name="company" required autoComplete="organization" placeholder="Ex.: Boteco Central" />
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
              <input
                name="contact"
                required
                autoComplete="email"
                inputMode="email"
                placeholder="WhatsApp ou e-mail"
              />
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

          <label className="honeypot" aria-hidden="true">
            Não preencha este campo
            <input name="website" tabIndex="-1" autoComplete="off" />
          </label>

          <TurnstileWidget action="job_submission" resetKey={`job-${captchaResetKey}`} />

          <button className="button primary full" type="submit" disabled={isPending}>
            {activeSubmit === "job" ? "Publicando..." : "Publicar vaga"}
          </button>
        </form>

        <form
          className="panel accent"
          id="curriculos"
          onSubmit={handleResumeSubmit}
          aria-busy={activeSubmit === "resume"}
        >
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
              <input name="name" required autoComplete="name" enterKeyHint="next" placeholder="Seu nome" />
            </label>
            <label>
              Telefone
              <input
                name="phone"
                required
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                enterKeyHint="next"
                placeholder="WhatsApp com DDD"
              />
            </label>
          </div>

          <div className="field-group two-columns">
            <label>
              E-mail
              <input
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                enterKeyHint="next"
                placeholder="email@exemplo.com"
              />
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
              Área
              <select name="area" required defaultValue="">
                <option value="">Selecione</option>
                <option>Cozinha</option>
                <option>Atendimento</option>
                <option>Bar</option>
                <option>Administrativo</option>
                <option>Liderança</option>
                <option>Delivery</option>
                <option>Limpeza</option>
              </select>
            </label>
            <label>
              Cidade
              <input
                name="city"
                required
                autoComplete="address-level2"
                enterKeyHint="next"
                placeholder="Ex.: São Paulo"
              />
            </label>
          </div>

          <div className="field-group two-columns">
            <label>
              Bairro ou região
              <input
                name="neighborhood"
                required
                autoComplete="address-level3"
                enterKeyHint="next"
                placeholder="Ex.: Zona Sul, Pinheiros"
              />
            </label>
            <label>
              Disponibilidade
              <input name="availability" placeholder="Ex.: Noite, 6x1, freelancer" />
            </label>
          </div>

          <label className="file-field">
            Anexar currículo
            <input
              name="resume_file"
              type="file"
              accept=".pdf,.doc,.docx,image/png,image/jpeg,image/webp"
              onChange={(event) => setSelectedFileName(event.target.files?.[0]?.name || "")}
            />
            <span className="field-help">
              {selectedFileName || "PDF, Word ou imagem de até 8 MB. Você também pode usar a câmera do celular."}
            </span>
          </label>

          <label>
            Experiência ou observações
            <textarea
              name="experience"
              rows="4"
              placeholder="Opcional se anexar o currículo. Resuma experiências, cursos e disponibilidade."
            />
          </label>

          <label className="checkbox-field">
            <input name="lgpd_accepted" type="checkbox" required />
            <span>
              Autorizo a A&S Gestão a tratar meus dados para processos seletivos, conforme a{" "}
              <a href="/privacidade" target="_blank">Política de Privacidade</a> e os{" "}
              <a href="/termos" target="_blank">Termos de Uso</a>.
            </span>
          </label>

          <label className="honeypot" aria-hidden="true">
            Não preencha este campo
            <input name="website" tabIndex="-1" autoComplete="off" />
          </label>

          <TurnstileWidget action="resume_submission" resetKey={`resume-${captchaResetKey}`} />

          <button className="button dark full" type="submit" disabled={isPending}>
            {activeSubmit === "resume" ? "Enviando currículo..." : "Enviar currículo"}
          </button>
          {activeSubmit === "resume" ? (
            <p className="submit-help" role="status">
              Aguarde enquanto salvamos seus dados e o arquivo. Não feche esta página.
            </p>
          ) : null}
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

      <footer className="site-footer">
        <span>© 2026 A&S Gestão de Pessoas</span>
        <a href="/privacidade">Política de Privacidade</a>
        <a href="/termos">Termos de Uso</a>
        <a
          href={businessWhatsappLink("Olá! Vim pelo Trampo Fácil e gostaria de falar com a A&S.")}
          target="_blank"
          rel="noreferrer"
        >
          Contato
        </a>
      </footer>

      <div className={`toast ${toast ? "visible" : ""}`} role="status" aria-live="polite">
        {toast}
      </div>
    </>
  );
}
