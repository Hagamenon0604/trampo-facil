import { LegalPage } from "@/components/LegalPage";

export const metadata = {
  title: "Termos de Uso | Trampo Fácil",
};

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="A&S Gestão de Pessoas"
      title="Termos de Uso"
      updatedAt="24 de junho de 2026"
    >
      <section>
        <h2>1. Finalidade da plataforma</h2>
        <p>
          O Trampo Fácil divulga oportunidades e organiza currículos para apoiar processos
          seletivos conduzidos pela A&S Gestão de Pessoas.
        </p>
      </section>
      <section>
        <h2>2. Responsabilidade dos candidatos</h2>
        <p>
          O candidato declara que as informações e os arquivos enviados são verdadeiros, atuais e
          de sua responsabilidade. O cadastro não garante contratação ou participação em
          entrevista.
        </p>
      </section>
      <section>
        <h2>3. Responsabilidade das empresas</h2>
        <p>
          As empresas devem informar condições reais da oportunidade e utilizar os dados dos
          candidatos somente para recrutamento e seleção, respeitando a legislação aplicável.
        </p>
      </section>
      <section>
        <h2>4. Disponibilidade e segurança</h2>
        <p>
          A A&S adota medidas razoáveis para manter a plataforma disponível e protegida, mas poderá
          realizar manutenções, corrigir informações e suspender cadastros abusivos ou fraudulentos.
        </p>
      </section>
      <section>
        <h2>5. Contato</h2>
        <p>
          Dúvidas sobre estes termos podem ser enviadas para{" "}
          <a href="mailto:andrea@aesgestao.com">andrea@aesgestao.com</a>.
        </p>
      </section>
    </LegalPage>
  );
}
