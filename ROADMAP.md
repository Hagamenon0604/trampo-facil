# Trampo Facil - Plataforma Real

## Visao

Construir a melhor plataforma brasileira de vagas para bares, restaurantes e food service, combinando vitrine publica, banco de talentos, operacao de hunting e agenda de entrevistas.

## Stack

- Frontend e backend: Next.js
- Banco: Supabase/PostgreSQL
- Deploy: Vercel
- Dominio: https://vagas.aesgestao.com

## Fase 1 - Fundacao

- Migrar prototipo estatico para Next.js.
- Criar APIs para vagas e curriculos.
- Criar schema inicial do Supabase.
- Criar painel admin inicial.
- Manter modo demonstracao quando o banco ainda nao estiver configurado.

## Fase 2 - Banco real

- Criar projeto Supabase.
- Rodar `supabase/schema.sql`.
- Rodar `supabase/seed.sql`.
- Configurar variaveis na Vercel:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Testar envio de vaga e curriculo em producao.

## Fase 3 - Operacao A&S

- Login admin.
- Status de candidato por vaga.
- Anotacoes internas.
- Filtros avancados.
- Exportacao de contatos.

## Fase 4 - Agenda

- Criar horarios de entrevista.
- Vincular candidato a vaga e horario.
- Status: marcado, confirmado, compareceu, faltou, remarcou.
- Integracao futura com Google Calendar e WhatsApp.

## Fase 5 - Escala

- Portal de empresas.
- Portal de candidatos.
- Matching por cargo, bairro, escala e experiencia.
- Observabilidade, analytics e backup.
