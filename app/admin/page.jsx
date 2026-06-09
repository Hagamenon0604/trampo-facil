import { Header } from "@/components/Header";
import { AdminDashboard } from "@/components/AdminDashboard";
import { getInterviews, getJobs, getPlatformStatus, getResumes } from "@/lib/data";

export default async function AdminPage() {
  const [jobs, resumes, interviews] = await Promise.all([
    getJobs({ includeDrafts: true }),
    getResumes(),
    getInterviews(),
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

      <AdminDashboard
        initialJobs={jobs}
        initialResumes={resumes}
        initialInterviews={interviews}
        databaseConfigured={status.databaseConfigured}
      />
    </main>
  );
}
