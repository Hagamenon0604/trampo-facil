-- Ajuste pontual Trampo Facil
-- Objetivo:
-- 1. Manter a candidata Jandira cadastrada.
-- 2. Manter Jandira vinculada somente a vaga de ASG.
-- 3. Remover o estabelecimento ficticio "Botequim Sao Paulo" da vaga ASG.
--
-- Execute primeiro os SELECTs de conferencia.
-- Depois execute o bloco BEGIN/COMMIT.

-- Conferencia: candidatura atual da Jandira.
select
  r.id as resume_id,
  r.name,
  r.desired_role,
  a.id as application_id,
  a.status as application_status,
  j.id as job_id,
  j.role,
  j.company,
  j.contact
from resumes r
left join applications a on a.resume_id = r.id
left join jobs j on j.id = a.job_id
where lower(r.name) like '%jandira%'
order by a.created_at desc;

-- Conferencia: vaga ASG que sera preservada e ajustada.
select
  id,
  company,
  role,
  contact,
  status,
  created_at
from jobs
where lower(role) like '%auxiliar de serviços gerais%'
   or lower(role) like '%auxiliar de servicos gerais%'
   or lower(role) like '%asg%'
order by created_at desc;

begin;

-- Remove qualquer candidatura da Jandira que nao seja ASG.
delete from applications a
using resumes r, jobs j
where a.resume_id = r.id
  and a.job_id = j.id
  and lower(r.name) like '%jandira%'
  and not (
    lower(j.role) like '%auxiliar de serviços gerais%'
    or lower(j.role) like '%auxiliar de servicos gerais%'
    or lower(j.role) like '%asg%'
  );

-- Remove o estabelecimento ficticio da vaga ASG, mantendo a oportunidade ativa.
update jobs
set
  company = 'A&S Gestão',
  contact = '11950877154',
  updated_at = now()
where
  (
    lower(role) like '%auxiliar de serviços gerais%'
   or lower(role) like '%auxiliar de servicos gerais%'
   or lower(role) like '%asg%'
  )
  and (
    lower(company) like '%botequim são paulo%'
    or lower(company) like '%botequim sao paulo%'
    or lower(company) like '%botequim%'
  );

commit;

-- Conferencia final: Jandira deve aparecer somente vinculada a ASG.
select
  r.id as resume_id,
  r.name,
  r.desired_role,
  a.id as application_id,
  a.status as application_status,
  j.id as job_id,
  j.role,
  j.company,
  j.contact
from resumes r
left join applications a on a.resume_id = r.id
left join jobs j on j.id = a.job_id
where lower(r.name) like '%jandira%'
order by a.created_at desc;
