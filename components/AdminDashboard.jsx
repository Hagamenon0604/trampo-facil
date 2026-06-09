"use client";

import { useMemo, useState, useTransition } from "react";

const statusLabels = {
  new: "Novo",
  screening: "Triagem",
  interview: "Entrevista",
  approved: "Aprovado",
  rejected: "Reprovado",
  hired: "Contratado",
  published: "Publicada",
  draft: "Rascunho",
  paused: "Pausada",
  closed: "Encerrada",
  scheduled: "Agendada",
  confirmed: "Confirmada",
  rescheduled: "Reagendada",
  attended: "Compareceu",
  no_show: "Não compareceu",
  cancelled: "Cancelada",
};

const statusOptions = [
  ["all", "Todos os status"],
  ["new", "Novo"],
  ["screening", "Triagem"],
  ["interview", "Entrevista"],
  ["approved", "Aprovado"],
  ["rejected", "Reprovado"],
  ["hired", "Contratado"],
];

const channelOptions = [
  ["online", "Online"],
  ["phone", "Telefone"],
  ["onsite", "Presencial"],
];

function labelFor(status) {
  return statusLabels[status] || status;
}

function uniqueOptions(items, key, fallbackLabel) {
  const values = Array.from(new Set(items.map((item) => item[key]).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );

  return [["all", fallbackLabel], ...values.map((value) => [value, value])];
}

function formatDateTime(value) {
  if (!value) {
    return "Sem data";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function whatsappPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");

  if (!digits) {
    return "";
  }

  return digits.startsWith("55") ? digits : `55${digits}`;
}

function whatsappUrl(resume, interview, job) {
  const phone = whatsappPhone(resume?.phone);

  if (!phone) {
    return "";
  }

  const jobText = job ? ` para a vaga de ${job.role} (${job.company})` : "";
  const locationText = interview.location ? `\nLocal/link: ${interview.location}` : "";
  const message = [
    `Olá, ${resume.name}. Tudo bem?`,
    `Aqui é da A&S Gestão de Pessoas. Sua entrevista${jobText} foi agendada para ${formatDateTime(interview.starts_at)}.`,
    `Formato: ${labelFor(interview.channel)}.${locationText}`,
    "Pode confirmar sua presença por aqui?",
  ].join("\n\n");

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function whatsappProfileUrl(resume) {
  const phone = whatsappPhone(resume?.phone);

  if (!phone) {
    return "";
  }

  const message = [
    `Olá, ${resume.name}. Tudo bem?`,
    "Aqui é da A&S Gestão de Pessoas. Recebemos seu currículo pela plataforma Trampo Fácil.",
    "Podemos falar sobre oportunidades em bares e restaurantes?",
  ].join("\n\n");

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
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

export function AdminDashboard({ initialJobs, initialResumes, initialInterviews, databaseConfigured }) {
  const [resumes, setResumes] = useState(initialResumes);
  const [interviews, setInterviews] = useState(initialInterviews);
  const [filters, setFilters] = useState({
    query: "",
    desired_role: "all",
    neighborhood: "all",
    status: "all",
  });
  const [selectedResumeId, setSelectedResumeId] = useState(initialResumes[0]?.id || "");
  const [lastWhatsappUrl, setLastWhatsappUrl] = useState("");
  const [toast, setToast] = useState("");
  const [isPending, startTransition] = useTransition();

  const roleOptions = useMemo(
    () => uniqueOptions(resumes, "desired_role", "Todos os cargos"),
    [resumes],
  );
  const neighborhoodOptions = useMemo(
    () => uniqueOptions(resumes, "neighborhood", "Todos os bairros"),
    [resumes],
  );

  const filteredResumes = useMemo(() => {
    const term = filters.query.toLowerCase().trim();

    return resumes.filter((resume) => {
      const matchesText = term
        ? [resume.name, resume.phone, resume.email, resume.desired_role, resume.neighborhood, resume.experience]
            .join(" ")
            .toLowerCase()
            .includes(term)
        : true;
      const matchesRole =
        filters.desired_role === "all" || resume.desired_role === filters.desired_role;
      const matchesNeighborhood =
        filters.neighborhood === "all" || resume.neighborhood === filters.neighborhood;
      const matchesStatus = filters.status === "all" || resume.status === filters.status;

      return matchesText && matchesRole && matchesNeighborhood && matchesStatus;
    });
  }, [filters, resumes]);

  const selectedResume =
    resumes.find((resume) => resume.id === selectedResumeId) || filteredResumes[0] || resumes[0];

  const upcomingInterviews = useMemo(
    () =>
      interviews
        .slice()
        .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
        .slice(0, 6),
    [interviews],
  );

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function showToast(message) {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
  }

  function handleSchedule(event) {
    event.preventDefault();

    if (!selectedResume) {
      showToast("Selecione um candidato para agendar.");
      return;
    }

    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());

    startTransition(async () => {
      try {
        const result = await submitJson("/api/interviews", {
          ...data,
          resume_id: selectedResume.id,
          starts_at: new Date(data.starts_at).toISOString(),
        });
        const created = result.interview || result;
        const notifications = result.notifications || [];
        const sentChannels = notifications
          .filter((item) => item.status === "sent")
          .map((item) => item.channel.toUpperCase());

        setInterviews((current) => [...current, created]);
        setResumes((current) =>
          current.map((resume) =>
            resume.id === selectedResume.id ? { ...resume, status: "interview" } : resume,
          ),
        );
        const relatedJob = initialJobs.find((job) => job.id === created.job_id);
        setLastWhatsappUrl(whatsappUrl(selectedResume, created, relatedJob));
        form.reset();
        showToast(
          sentChannels.length
            ? `Entrevista agendada. Enviado por ${sentChannels.join(" e ")}.`
            : "Entrevista agendada. Envio automático ainda não configurado.",
        );
      } catch (error) {
        showToast(error.message);
      }
    });
  }

  return (
    <>
      {!databaseConfigured ? (
        <section className="section admin-warning">
          <strong>Banco ainda não conectado.</strong>
          <span>Configure o Supabase para salvar a agenda e os candidatos.</span>
        </section>
      ) : null}

      <section className="section admin-kpis">
        <div>
          <span>Vagas</span>
          <strong>{initialJobs.length}</strong>
        </div>
        <div>
          <span>Candidatos</span>
          <strong>{resumes.length}</strong>
        </div>
        <div>
          <span>Em entrevista</span>
          <strong>{resumes.filter((resume) => resume.status === "interview").length}</strong>
        </div>
        <div>
          <span>Agenda</span>
          <strong>{interviews.length}</strong>
        </div>
      </section>

      <section className="section admin-workspace">
        <div className="admin-toolbar">
          <label>
            Buscar
            <input
              type="search"
              value={filters.query}
              onChange={(event) => updateFilter("query", event.target.value)}
              placeholder="Nome, telefone, cargo ou experiência"
            />
          </label>
          <label>
            Cargo
            <select
              value={filters.desired_role}
              onChange={(event) => updateFilter("desired_role", event.target.value)}
            >
              {roleOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Bairro
            <select
              value={filters.neighborhood}
              onChange={(event) => updateFilter("neighborhood", event.target.value)}
            >
              {neighborhoodOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}>
              {statusOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="admin-columns">
          <div className="admin-panel candidate-panel">
            <div className="section-heading compact">
              <div>
                <p className="eyebrow">Candidatos</p>
                <h2>{filteredResumes.length} encontrados</h2>
              </div>
            </div>

            <div className="candidate-list">
              {filteredResumes.length ? (
                filteredResumes.map((resume) => (
                  <button
                    className={resume.id === selectedResume?.id ? "candidate-row active" : "candidate-row"}
                    key={resume.id}
                    type="button"
                    onClick={() => setSelectedResumeId(resume.id)}
                  >
                    <span>
                      <strong>{resume.name}</strong>
                      <small>{resume.desired_role} · {resume.neighborhood}</small>
                    </span>
                    <span className="status-pill">{labelFor(resume.status)}</span>
                  </button>
                ))
              ) : (
                <p className="empty">Nenhum candidato encontrado com esses filtros.</p>
              )}
            </div>
          </div>

          <div className="admin-panel candidate-detail">
            {selectedResume ? (
              <>
                <div className="detail-header">
                  <div>
                    <p className="eyebrow">Perfil selecionado</p>
                    <h2>{selectedResume.name}</h2>
                  </div>
                  <span className="status-pill">{labelFor(selectedResume.status)}</span>
                </div>

                <div className="quick-actions">
                  <a
                    className="button secondary full"
                    href={whatsappProfileUrl(selectedResume)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Chamar no WhatsApp
                  </a>
                </div>

                <dl className="detail-list">
                  <div>
                    <dt>Telefone</dt>
                    <dd>{selectedResume.phone}</dd>
                  </div>
                  <div>
                    <dt>E-mail</dt>
                    <dd>{selectedResume.email || "Não informado"}</dd>
                  </div>
                  <div>
                    <dt>Cargo</dt>
                    <dd>{selectedResume.desired_role}</dd>
                  </div>
                  <div>
                    <dt>Bairro</dt>
                    <dd>{selectedResume.neighborhood}</dd>
                  </div>
                </dl>

                <div className="experience-box">
                  <strong>Experiência</strong>
                  <p>{selectedResume.experience}</p>
                </div>

                <form className="schedule-form" onSubmit={handleSchedule}>
                  <div className="form-heading compact">
                    <p className="eyebrow">Agenda</p>
                    <h3>Agendar entrevista</h3>
                  </div>
                  <label>
                    Vaga relacionada
                    <select name="job_id" defaultValue="">
                      <option value="">Sem vaga específica</option>
                      {initialJobs.map((job) => (
                        <option key={job.id} value={job.id}>
                          {job.role} · {job.company}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="field-group two-columns">
                    <label>
                      Data e horário
                      <input name="starts_at" type="datetime-local" required />
                    </label>
                    <label>
                      Canal
                      <select name="channel" defaultValue="online">
                        {channelOptions.map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label>
                    Local ou link
                    <input name="location" placeholder="Endereço, Google Meet ou WhatsApp" />
                  </label>
                  <label>
                    Observações
                    <textarea name="notes" rows="3" placeholder="Pontos para avaliar na entrevista" />
                  </label>
                  <button className="button primary full" type="submit" disabled={isPending}>
                    Agendar entrevista
                  </button>
                  {lastWhatsappUrl ? (
                    <a className="button whatsapp full" href={lastWhatsappUrl} target="_blank" rel="noreferrer">
                      Enviar confirmação no WhatsApp
                    </a>
                  ) : null}
                </form>
              </>
            ) : (
              <p className="empty">Selecione um candidato para visualizar detalhes.</p>
            )}
          </div>

          <div className="admin-panel schedule-panel">
            <div className="section-heading compact">
              <div>
                <p className="eyebrow">Próximas entrevistas</p>
                <h2>Agenda</h2>
              </div>
            </div>
            <div className="schedule-list">
              {upcomingInterviews.length ? (
                upcomingInterviews.map((interview) => {
                  const resume = resumes.find((item) => item.id === interview.resume_id);
                  const job = initialJobs.find((item) => item.id === interview.job_id);

                  return (
                    <article className="schedule-item" key={interview.id}>
                      <strong>{formatDateTime(interview.starts_at)}</strong>
                      <span>{resume?.name || "Candidato"} · {labelFor(interview.channel)}</span>
                      <small>{job ? `${job.role} · ${job.company}` : interview.location || "Sem vaga específica"}</small>
                      {resume ? (
                        <a href={whatsappUrl(resume, interview, job)} target="_blank" rel="noreferrer">
                          Enviar WhatsApp
                        </a>
                      ) : null}
                    </article>
                  );
                })
              ) : (
                <p className="empty">Nenhuma entrevista agendada ainda.</p>
              )}
            </div>
          </div>
        </div>
      </section>

      {toast ? <div className="toast">{toast}</div> : null}
    </>
  );
}
