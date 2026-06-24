import { LegalPage } from "@/components/LegalPage";

export const metadata = {
  title: "Política de Privacidade | Trampo Fácil",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="A&S Gestão de Pessoas"
      title="Política de Privacidade"
      updatedAt="24 de junho de 2026"
    >
      <section>
        <h2>1. Quem trata seus dados</h2>
        <p>
          A plataforma Trampo Fácil é operada pela A&S Gestão de Pessoas para aproximar candidatos
          e empresas em processos de recrutamento e seleção.
        </p>
      </section>
      <section>
        <h2>2. Dados coletados</h2>
        <p>
          Podemos coletar nome, telefone, e-mail, localização, cargo desejado, disponibilidade,
          experiências profissionais, currículo anexado e informações relacionadas às
          candidaturas e entrevistas.
        </p>
      </section>
      <section>
        <h2>3. Como usamos os dados</h2>
        <p>
          Os dados são utilizados para cadastrar o candidato no banco de talentos, avaliar
          compatibilidade com vagas, entrar em contato, organizar entrevistas e apresentar perfis
          a empresas com oportunidades relacionadas.
        </p>
      </section>
      <section>
        <h2>4. Compartilhamento e segurança</h2>
        <p>
          Os dados não são publicados livremente. O acesso operacional é restrito à A&S e as
          informações poderão ser compartilhadas com empresas contratantes quando necessário para
          um processo seletivo compatível.
        </p>
      </section>
      <section>
        <h2>5. Prazo de retenção</h2>
        <p>
          Os currículos poderão permanecer no banco de talentos por até 12 meses, salvo obrigação
          legal, solicitação de exclusão ou renovação da autorização pelo candidato.
        </p>
      </section>
      <section>
        <h2>6. Seus direitos</h2>
        <p>
          O candidato pode solicitar confirmação do tratamento, correção, atualização, acesso ou
          exclusão dos dados. Para exercer esses direitos, escreva para{" "}
          <a href="mailto:andrea@aesgestao.com">andrea@aesgestao.com</a>.
        </p>
      </section>
    </LegalPage>
  );
}
