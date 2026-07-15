-- Limpeza operacional Trampo Facil
-- Objetivo:
-- 1. Remover candidaturas/curriculos de teste, preservando a candidata real Jandira.
-- 2. Remover vagas de demonstracao/teste conhecidas.
-- 3. Manter vagas reais/prioritarias como ASG e Atendente.
--
-- Execute primeiro os SELECTs de conferencia.
-- Depois execute o bloco BEGIN/COMMIT.

-- Conferencia: curriculos que seriam preservados.
select
  id,
  name,
  phone,
  email,
  desired_role,
  status,
  created_at
from resumes
where lower(name) like '%jandira%'
order by created_at desc;

-- Conferencia: curriculos que seriam removidos.
select
  id,
  name,
  phone,
  email,
  desired_role,
  status,
  created_at
from resumes
where lower(name) not like '%jandira%'
order by created_at desc;

-- Conferencia: vagas claramente de teste/demonstracao.
select
  id,
  company,
  role,
  contact,
  status,
  created_at
from jobs
where
  company in ('Boteco Central', 'Cantina Boa Massa', 'Bar do Mercado')
  or lower(company) like '%teste%'
  or lower(role) like '%teste%'
  or lower(description) like '%teste%'
order by created_at desc;

begin;

-- Remove agendamentos ligados a candidatos de teste.
delete from interviews
where resume_id in (
  select id
  from resumes
  where lower(name) not like '%jandira%'
);

-- Remove candidaturas ligadas a candidatos de teste.
delete from applications
where resume_id in (
  select id
  from resumes
  where lower(name) not like '%jandira%'
);

-- Remove curriculos de teste, preservando Jandira.
delete from resumes
where lower(name) not like '%jandira%';

-- Remove vagas seed/demo e qualquer vaga marcada claramente como teste.
delete from jobs
where
  company in ('Boteco Central', 'Cantina Boa Massa', 'Bar do Mercado')
  or lower(company) like '%teste%'
  or lower(role) like '%teste%'
  or lower(description) like '%teste%';

commit;

-- Conferencia final.
select
  id,
  name,
  phone,
  email,
  desired_role,
  status,
  created_at
from resumes
order by created_at desc;

select
  id,
  company,
  role,
  contact,
  status,
  created_at
from jobs
order by created_at desc;
