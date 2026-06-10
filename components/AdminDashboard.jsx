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

const pipelineStatuses = statusOptions.filter(([value]) => value !== "all");

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

function scoreTotal(resume) {
  if (Number.isFinite(Number(resume?.score_total))) {
    return Number(resume.score_total);
  }

  return [
    resume?.score_experience,
    resume?.score_availability,
    resume?.score_communication,
    resume?.score_distance,
    resume?.score_fit,
  ].reduce((total, value) => total + (Number(value) || 0), 0);
}

function fitLabel(total) {
  if (total >= 21) {
    return "Alto fit";
  }

  if (total >= 13) {
    return "Médio fit";
  }

  return "Baixo fit";
}

function tagText(tags) {
  return Array.isArray(tags) ? tags.join(", ") : tags || "";
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

async function submitJson(url, payload, method = "POST") {
  const response = await fetch(url, {
    method,
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

export function AdminDashboard({
  initialJobs,
  initialResumes,
  initialInterviews,
  initialApplications = [],
  databaseConfigured,
}) {
  const [resumes, setResumes] = useState(initialResumes);
  const [interviews, setInterviews] = useState(initialInterviews);
  const [filters, setFilters] = useState({
    query: "",
    job_id: "all",
    desired_role: "all",
    area: "all",
    city: "all",
    neighborhood: "all",
    status: "all",
    favorite: "all",
  });
  const [selectedResumeId, setSelectedResumeId] = useState(initialResumes[0]?.id || "");
  const [lastWhatsappUrl, setLastWhatsappUrl] = useState("");
  const [toast, setToast] = useState("");
  const [isPending, startTransition] = useTransition();

  const applicationsByResumeId = useMemo(() => {
    return initialApplications.reduce((map, application) => {
      const resumeId = application.resume_id;

      if (!resumeId) {
        return map;
      }

      map.set(resumeId, [...(map.get(resumeId) || []), application]);
      return map;
    }, new Map());
  }, [initialApplications]);

  const applicationCountByJobId = useMemo(() => {
    return initialApplications.reduce((map, application) => {
      const jobId = application.job_id;

      if (jobId) {
        map.set(jobId, (map.get(jobId) || 0) + 1);
      }

      return map;
    }, new Map());
  }, [initialApplications]);

  const jobOptions = useMemo(
    () => [
      ["all", "Todas as vagas"],
      ...initialJobs.map((job) => [
        job.id,
        `${job.role} · ${job.company} (${labelFor(job.status)})`,
      ]),
    ],
    [initialJobs],
  );

  const roleOptions = useMemo(
    () => uniqueOptions(resumes, "desired_role", "Todos os cargos"),
    [resumes],
  );
  const areaOptions = useMemo(
    () => uniqueOptions(resumes, "area", "Todas as áreas"),
    [resumes],
  );
  const cityOptions = useMemo(
    () => uniqueOptions(resumes, "city", "Todas as cidades"),
    [resumes],
  );
  const neighborhoodOptions = useMemo(
    () => uniqueOptions(resumes, "neighborhood", "Todas as regiões"),
    [resumes],
  );

  const filteredResumes = useMemo(() => {
    const term = filters.query.toLowerCase().trim();

    return resumes.filter((resume) => {
      const matchesText = term
        ? [
            resume.name,
            resume.phone,
            resume.email,
            resume.desired_role,
            resume.area,
            resume.city,
            resume.neighborhood,
            resume.experience,
            tagText(resume.tags),
          ]
            .join(" ")
            .toLowerCase()
            .includes(term)
        : true;
      const matchesRole =
        filters.desired_role === "all" || resume.desired_role === filters.desired_role;
      const matchesJob =
        filters.job_id === "all" ||
        (applicationsByResumeId.get(resume.id) || []).some(
          (application) => application.job_id === filters.job_id,
        );
      const matchesArea = filters.area === "all" || resume.area === filters.area;
      const matchesCity = filters.city === "all" || resume.city === filters.city;
      const matchesNeighborhood =
        filters.neighborhood === "all" || resume.neighborhood === filters.neighborhood;
      const matchesStatus = filters.status === "all" || resume.status === filters.status;
      const matchesFavorite = filters.favorite === "all" || Boolean(resume.favorite);

      return (
        matchesText &&
        matchesJob &&
        matchesRole &&
        matchesArea &&
        matchesCity &&
        matchesNeighborhood &&
        matchesStatus &&
        matchesFavorite
      );
    });
  }, [applicationsByResumeId, filters, resumes]);

  const selectedResume =
    filteredResumes.find((resume) => resume.id === selectedResumeId) || filteredResumes[0] || null;
  const selectedResumeApplications = selectedResume
    ? applicationsByResumeId.get(selectedResume.id) || []
    : [];

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

  function mergeUpdatedResume(updatedResume) {
    setResumes((current) =>
      current.map((resume) =>
        resume.id === updatedResume.id ? { ...resume, ...updatedResume } : resume,
      ),
    );
  }

  function handleResumeUpdate(resumeId, payload, successMessage = "Candidato atualizado.") {
    startTransition(async () => {
      try {
        const updated = await submitJson(`/api/resumes/${resumeId}`, payload, "PATCH");
        mergeUpdatedResume(updated);
        showToast(successMessage);
      } catch (error) {
        showToast(error.message);
      }
    });
  }

  function handleProfileSubmit(event) {
    event.preventDefault();

    if (!selectedResume) {
      return;
    }

    const formData = Object.fromEntries(new FormData(event.currentTarget).entries());
    handleResumeUpdate(
      selectedResume.id,
      {
        tags: formData.tags,
        internal_notes: formData.internal_notes,
        score_experience: formData.score_experience,
        score_availability: formData.score_availability,
        score_communication: formData.score_communication,
        score_distance: formData.score_distance,
        score_fit: formData.score_fit,
      },
      "Perfil atualizado.",
    );
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
        const meet = result.meet || {};
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
        const meetText =
          meet.status === "created"
            ? " Meet criado."
            : meet.status === "failed"
              ? " Meet não criado."
              : "";
        const notificationText = sentChannels.length
          ? ` Enviado por ${sentChannels.join(" e ")}.`
          : " Envio automático ainda não configurado.";
        showToast(`Entrevista agendada.${meetText}${notificationText}`);
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
          <span>Candidaturas</span>
          <strong>{initialApplications.length}</strong>
        </div>
        <div>
          <span>Candidatos</span>
          <strong>{resumes.length}</strong>
        </div>
        <div>
          <span>Em entrevista</span>
          <strong>{resumes.filter((resume) => resume.status === "interview").length}</strong>
        </div>
      </section>

      <section className="section kanban-section">
        <div className="section-heading compact">
          <div>
            <p className="eyebrow">Pipeline visual</p>
            <h2>Kanban de candidatos</h2>
          </div>
        </div>
        <div className="kanban-board">
          {pipelineStatuses.map(([status, label]) => {
            const statusResumes = filteredResumes.filter((resume) => resume.status === status);

            return (
              <article className="kanban-column" key={status}>
                <div className="kanban-heading">
                  <strong>{label}</strong>
                  <span>{statusResumes.length}</span>
                </div>
                <div className="kanban-list">
                  {statusResumes.slice(0, 8).map((resume) => (
                    <button
                      className={resume.id === selectedResume?.id ? "kanban-card active" : "kanban-card"}
                      key={resume.id}
                      type="button"
                      onClick={() => setSelectedResumeId(resume.id)}
                    >
                      <span>
                        {resume.favorite ? "★ " : ""}
                        {resume.name}
                      </span>
                      <small>{resume.desired_role} · {resume.neighborhood}</small>
                      {Array.isArray(resume.tags) && resume.tags.length ? (
                        <small>{resume.tags.slice(0, 3).join(", ")}</small>
                      ) : null}
                    </button>
                  ))}
                  {statusResumes.length > 8 ? (
                    <small className="kanban-more">+{statusResumes.length - 8} no filtro abaixo</small>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="section admin-help-grid">
        <article className="admin-panel">
          <p className="eyebrow">Onde ver candidatos</p>
          <h2>Candidaturas por vaga</h2>
          <p>
            Use o filtro <strong>Vaga</strong> para ver apenas candidatos que clicaram em uma
            oportunidade específica. Sem esse filtro, a lista vira banco geral de currículos.
          </p>
        </article>
        <article className="admin-panel">
          <p className="eyebrow">Currículos recebidos</p>
          <h2>Banco de talentos</h2>
          <p>
            Clique em um candidato para abrir o perfil. Se ele anexou arquivo, os botões
            <strong> Abrir currículo</strong> e <strong>Baixar currículo</strong> aparecem no detalhe.
          </p>
        </article>
        <article className="admin-panel">
          <p className="eyebrow">E-mail</p>
          <h2>Notificações pendentes</h2>
          <p>
            O envio automático por e-mail fica ativo quando as variáveis do provedor são configuradas
            na Vercel. Até lá, o painel centraliza os currículos e apoia contato por WhatsApp.
          </p>
        </article>
      </section>

      <section className="section integration-strip">
        <div>
          <p className="eyebrow">Google Meet</p>
          <h2>Entrevistas online com link automático</h2>
          <p>
            Conecte a conta Google da operação para criar evento no Agenda e link único do Meet
            ao agendar entrevistas online.
          </p>
        </div>
        <a className="button dark" href="/api/google/connect">
          Conectar Google Agenda
        </a>
      </section>

      <section className="section admin-workspace">
        <div className="admin-panel jobs-overview">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">Vagas publicadas</p>
              <h2>Candidatos por vaga</h2>
            </div>
          </div>
          <div className="job-application-list">
            {initialJobs.length ? (
              initialJobs.map((job) => {
                const total = applicationCountByJobId.get(job.id) || 0;

                return (
                  <button
                    className={filters.job_id === job.id ? "job-application-row active" : "job-application-row"}
                    key={job.id}
                    type="button"
                    onClick={() => updateFilter("job_id", filters.job_id === job.id ? "all" : job.id)}
                  >
                    <span>
                      <strong>{job.role}</strong>
                      <small>{job.company} · {job.neighborhood} · {labelFor(job.status)}</small>
                    </span>
                    <span className="status-pill">{total} candidato{total === 1 ? "" : "s"}</span>
                  </button>
                );
              })
            ) : (
              <p className="empty">Nenhuma vaga cadastrada ainda.</p>
            )}
          </div>
        </div>

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
            Vaga
            <select value={filters.job_id} onChange={(event) => updateFilter("job_id", event.target.value)}>
              {jobOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
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
            Região
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
            Área
            <select value={filters.area} onChange={(event) => updateFilter("area", event.target.value)}>
              {areaOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Cidade
            <select value={filters.city} onChange={(event) => updateFilter("city", event.target.value)}>
              {cityOptions.map(([value, label]) => (
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
          <label>
            Favoritos
            <select value={filters.favorite} onChange={(event) => updateFilter("favorite", event.target.value)}>
              <option value="all">Todos</option>
              <option value="yes">Somente favoritos</option>
            </select>
          </label>
        </div>

        <div className="admin-columns">
          <div className="admin-panel candidate-panel">
            <div className="section-heading compact">
              <div>
                <p className="eyebrow">
                  {filters.job_id === "all" ? "Banco de currículos" : "Candidatos da vaga"}
                </p>
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
                      <small>
                        {resume.desired_role} · {resume.area || "Área não informada"} ·{" "}
                        {resume.city || resume.neighborhood}
                      </small>
                      {(applicationsByResumeId.get(resume.id) || []).length ? (
                        <small>{(applicationsByResumeId.get(resume.id) || []).length} candidatura(s)</small>
                      ) : null}
                      {Array.isArray(resume.tags) && resume.tags.length ? (
                        <small>{resume.tags.slice(0, 4).join(", ")}</small>
                      ) : null}
                    </span>
                    <span className="row-actions">
                      {resume.favorite ? <span className="favorite-mark">★</span> : null}
                      <span className="status-pill">{labelFor(resume.status)}</span>
                    </span>
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
                  {selectedResume.resume_file_url ? (
                    <div className="file-actions">
                      <a
                        className="button primary full"
                        href={selectedResume.resume_file_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Abrir currículo
                      </a>
                      <a
                        className="button secondary full"
                        href={selectedResume.resume_file_url}
                        download={selectedResume.resume_file_name || "curriculo"}
                      >
                        Baixar currículo
                      </a>
                    </div>
                  ) : null}
                  <button
                    className={selectedResume.favorite ? "button primary full" : "button secondary full"}
                    type="button"
                    onClick={() =>
                      handleResumeUpdate(
                        selectedResume.id,
                        { favorite: !selectedResume.favorite },
                        selectedResume.favorite ? "Favorito removido." : "Candidato favoritado.",
                      )
                    }
                    disabled={isPending}
                  >
                    {selectedResume.favorite ? "Remover favorito" : "Favoritar candidato"}
                  </button>
                </div>

                <label className="status-control">
                  Etapa do pipeline
                  <select
                    value={selectedResume.status}
                    onChange={(event) =>
                      handleResumeUpdate(
                        selectedResume.id,
                        { status: event.target.value },
                        `Candidato movido para ${labelFor(event.target.value)}.`,
                      )
                    }
                  >
                    {pipelineStatuses.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>

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
                    <dt>Área</dt>
                    <dd>{selectedResume.area || "Não informada"}</dd>
                  </div>
                  <div>
                    <dt>Cidade</dt>
                    <dd>{selectedResume.city || "Não informada"}</dd>
                  </div>
                  <div>
                    <dt>Bairro/região</dt>
                    <dd>{selectedResume.neighborhood}</dd>
                  </div>
                  <div>
                    <dt>Arquivo</dt>
                    <dd>{selectedResume.resume_file_name || "Sem anexo"}</dd>
                  </div>
                  <div>
                    <dt>Score</dt>
                    <dd>
                      {scoreTotal(selectedResume)}/25 · {fitLabel(scoreTotal(selectedResume))}
                    </dd>
                  </div>
                </dl>

                <div className="experience-box">
                  <strong>Experiência</strong>
                  <p>{selectedResume.experience || "Não preenchida. Verifique o currículo anexado."}</p>
                </div>

                <div className="experience-box">
                  <strong>Vagas em que se candidatou</strong>
                  {selectedResumeApplications.length ? (
                    <div className="application-links">
                      {selectedResumeApplications.map((application) => (
                        <span key={application.id}>
                          {application.jobs
                            ? `${application.jobs.role} · ${application.jobs.company}`
                            : "Vaga não localizada"}{" "}
                          · {labelFor(application.status)}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p>Candidato salvo no banco de talentos, sem vaga específica vinculada.</p>
                  )}
                </div>

                <form className="scorecard-form" key={selectedResume.id} onSubmit={handleProfileSubmit}>
                  <div className="form-heading compact">
                    <p className="eyebrow">Triagem</p>
                    <h3>Scorecard e tags</h3>
                  </div>
                  <label>
                    Tags
                    <input
                      name="tags"
                      defaultValue={tagText(selectedResume.tags)}
                      placeholder="Ex.: freelancer, cozinha, urgente"
                    />
                  </label>
                  <div className="score-grid">
                    <label>
                      Experiência
                      <input
                        name="score_experience"
                        type="number"
                        min="0"
                        max="5"
                        defaultValue={selectedResume.score_experience || ""}
                      />
                    </label>
                    <label>
                      Disponibilidade
                      <input
                        name="score_availability"
                        type="number"
                        min="0"
                        max="5"
                        defaultValue={selectedResume.score_availability || ""}
                      />
                    </label>
                    <label>
                      Comunicação
                      <input
                        name="score_communication"
                        type="number"
                        min="0"
                        max="5"
                        defaultValue={selectedResume.score_communication || ""}
                      />
                    </label>
                    <label>
                      Distância
                      <input
                        name="score_distance"
                        type="number"
                        min="0"
                        max="5"
                        defaultValue={selectedResume.score_distance || ""}
                      />
                    </label>
                    <label>
                      Aderência
                      <input
                        name="score_fit"
                        type="number"
                        min="0"
                        max="5"
                        defaultValue={selectedResume.score_fit || ""}
                      />
                    </label>
                  </div>
                  <label>
                    Observações internas
                    <textarea
                      name="internal_notes"
                      rows="3"
                      defaultValue={selectedResume.internal_notes || ""}
                      placeholder="Histórico de contato, impressão da triagem e próximos passos"
                    />
                  </label>
                  <button className="button dark full" type="submit" disabled={isPending}>
                    Salvar triagem
                  </button>
                </form>

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
                    <input name="location" placeholder="Deixe vazio para gerar Google Meet automaticamente" />
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
