const sampleJobs = [
  {
    id: "job-1",
    company: "Boteco Central",
    role: "Garçom",
    neighborhood: "Vila Madalena",
    salary: "R$ 2.100 + gorjeta",
    shift: "Noturno",
    contact: "(11) 90000-1001",
    description: "Atendimento de mesas, organização do salão e apoio no fechamento da casa.",
    createdAt: "2026-06-01",
  },
  {
    id: "job-2",
    company: "Cantina Boa Massa",
    role: "Auxiliar de cozinha",
    neighborhood: "Centro",
    salary: "R$ 1.850 + VT",
    shift: "Escala 6x1",
    contact: "rh@boamassa.com",
    description: "Pré-preparo, higienização de alimentos e apoio ao cozinheiro principal.",
    createdAt: "2026-06-02",
  },
  {
    id: "job-3",
    company: "Bar do Mercado",
    role: "Bartender freelancer",
    neighborhood: "Mooca",
    salary: "R$ 180 por diária",
    shift: "Fim de semana",
    contact: "(11) 98888-2020",
    description: "Preparo de drinks clássicos, controle do balcão e atendimento direto ao cliente.",
    createdAt: "2026-06-03",
  },
];

const sampleResumes = [
  {
    id: "resume-1",
    name: "Mariana Costa",
    phone: "(11) 97777-4444",
    desiredRole: "Recepcionista",
    neighborhood: "Pinheiros",
    experience: "3 anos em atendimento, reservas, caixa e organização de salão.",
    createdAt: "2026-06-04",
  },
  {
    id: "resume-2",
    name: "Rafael Lima",
    phone: "(11) 96666-3030",
    desiredRole: "Chapeiro",
    neighborhood: "Tatuapé",
    experience: "Experiência com lanches, porções, mise en place e limpeza de praça.",
    createdAt: "2026-06-04",
  },
];

const jobsKey = "trampoFacil.jobs";
const resumesKey = "trampoFacil.resumes";

const jobsList = document.querySelector("#jobs-list");
const resumesList = document.querySelector("#resumes-list");
const jobForm = document.querySelector("#job-form");
const resumeForm = document.querySelector("#resume-form");
const searchInput = document.querySelector("#job-search");
const jobCount = document.querySelector("#job-count");
const resumeCount = document.querySelector("#resume-count");
const toast = document.querySelector("#toast");

if (new URLSearchParams(window.location.search).get("embed") === "1") {
  document.body.classList.add("embed-mode");
}

function getStoredList(key, fallback) {
  const stored = localStorage.getItem(key);
  if (!stored) {
    localStorage.setItem(key, JSON.stringify(fallback));
    return fallback;
  }

  try {
    return JSON.parse(stored);
  } catch {
    localStorage.setItem(key, JSON.stringify(fallback));
    return fallback;
  }
}

function saveList(key, list) {
  localStorage.setItem(key, JSON.stringify(list));
}

let jobs = getStoredList(jobsKey, sampleJobs);
let resumes = getStoredList(resumesKey, sampleResumes);

function formatDate(dateText) {
  const date = new Date(`${dateText}T12:00:00`);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  window.setTimeout(() => toast.classList.remove("visible"), 2600);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return entities[character];
  });
}

function createId(prefix) {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

function jobMatchesSearch(job, query) {
  const searchable = [job.company, job.role, job.neighborhood, job.shift, job.description]
    .join(" ")
    .toLowerCase();
  return searchable.includes(query.toLowerCase().trim());
}

function renderJobs() {
  const query = searchInput.value;
  const visibleJobs = jobs.filter((job) => jobMatchesSearch(job, query));

  jobCount.textContent = String(jobs.length);

  if (!visibleJobs.length) {
    jobsList.innerHTML = '<p class="empty">Nenhuma vaga encontrada com esse filtro.</p>';
    return;
  }

  jobsList.innerHTML = visibleJobs
    .map(
      (job) => `
        <article class="job-card">
          <div>
            <p class="eyebrow">${escapeHtml(job.company)}</p>
            <h3>${escapeHtml(job.role)}</h3>
          </div>
          <div class="tag-row">
            <span class="tag">${escapeHtml(job.neighborhood)}</span>
            <span class="tag">${escapeHtml(job.shift)}</span>
          </div>
          <div class="card-meta">
            <span><strong>Salário:</strong> ${escapeHtml(job.salary)}</span>
            <span><strong>Contato:</strong> ${escapeHtml(job.contact)}</span>
            <span><strong>Publicado:</strong> ${formatDate(job.createdAt)}</span>
          </div>
          <p class="card-description">${escapeHtml(job.description)}</p>
        </article>
      `,
    )
    .join("");
}

function renderResumes() {
  resumeCount.textContent = String(resumes.length);

  if (!resumes.length) {
    resumesList.innerHTML = '<p class="empty">Nenhum currículo cadastrado ainda.</p>';
    return;
  }

  resumesList.innerHTML = resumes
    .slice(0, 6)
    .map(
      (resume) => `
        <article class="resume-card">
          <div>
            <p class="eyebrow">${escapeHtml(resume.desiredRole)}</p>
            <h3>${escapeHtml(resume.name)}</h3>
          </div>
          <div class="card-meta">
            <span><strong>Bairro:</strong> ${escapeHtml(resume.neighborhood)}</span>
            <span><strong>Telefone:</strong> ${escapeHtml(resume.phone)}</span>
            <span><strong>Cadastrado:</strong> ${formatDate(resume.createdAt)}</span>
          </div>
          <p class="card-description">${escapeHtml(resume.experience)}</p>
        </article>
      `,
    )
    .join("");
}

function formDataToObject(form) {
  return Object.fromEntries(new FormData(form).entries());
}

jobForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = formDataToObject(jobForm);
  const job = {
    id: createId("job"),
    ...data,
    createdAt: new Date().toISOString().slice(0, 10),
  };

  jobs = [job, ...jobs];
  saveList(jobsKey, jobs);
  jobForm.reset();
  renderJobs();
  showToast("Vaga publicada com sucesso.");
});

resumeForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = formDataToObject(resumeForm);
  const resume = {
    id: createId("resume"),
    ...data,
    createdAt: new Date().toISOString().slice(0, 10),
  };

  resumes = [resume, ...resumes];
  saveList(resumesKey, resumes);
  resumeForm.reset();
  renderResumes();
  showToast("Currículo cadastrado com sucesso.");
});

searchInput.addEventListener("input", renderJobs);

renderJobs();
renderResumes();
