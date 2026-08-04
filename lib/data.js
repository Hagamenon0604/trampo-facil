import { unstable_noStore as noStore } from "next/cache";
import { sampleJobs, sampleResumes } from "@/lib/seed";
import { createSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";

const resumeBucket = "candidate-resumes";
const resumeStatuses = new Set(["new", "screening", "interview", "approved", "rejected", "hired"]);

function isMissingDatabaseSchema(error) {
  return error?.code === "42P01" || error?.message?.includes("schema cache");
}

function isMissingOptionalResumeColumn(error) {
  return error?.message?.includes("Could not find") && error?.message?.includes("resumes");
}

function normalizeTags(tags) {
  if (Array.isArray(tags)) {
    return tags.map((tag) => String(tag).trim()).filter(Boolean).slice(0, 12);
  }

  return String(tags || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function normalizeScore(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const score = Number(value);

  if (!Number.isFinite(score)) {
    return null;
  }

  return Math.min(5, Math.max(0, Math.round(score)));
}

async function withSignedResumeUrls(resumes, supabase) {
  return Promise.all(
    resumes.map(async (resume) => {
      if (!resume.resume_file_path) {
        return resume;
      }

      const { data } = await supabase.storage
        .from(resumeBucket)
        .createSignedUrl(resume.resume_file_path, 60 * 60);

      return {
        ...resume,
        resume_file_url: data?.signedUrl || null,
      };
    }),
  );
}

export async function getJobs({ includeDrafts = false } = {}) {
  noStore();
  const supabase = createSupabaseAdmin();

  if (!supabase) {
    return sampleJobs;
  }

  let query = supabase.from("jobs").select("*").order("created_at", { ascending: false });

  if (!includeDrafts) {
    query = query.eq("status", "published");
  }

  const { data, error } = await query;

  if (error) {
    if (isMissingDatabaseSchema(error)) {
      return sampleJobs;
    }

    throw new Error(error.message);
  }

  return data;
}

export async function getResumes() {
  noStore();
  const supabase = createSupabaseAdmin();

  if (!supabase) {
    return sampleResumes;
  }

  const { data, error } = await supabase
    .from("resumes")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    if (isMissingDatabaseSchema(error)) {
      return sampleResumes;
    }

    throw new Error(error.message);
  }

  return withSignedResumeUrls(data, supabase);
}

export async function getResumeFileAccess(resumeId, { download = false } = {}) {
  const supabase = createSupabaseAdmin();

  if (!supabase) {
    return { configured: false, data: null };
  }

  const { data: resume, error: resumeError } = await supabase
    .from("resumes")
    .select("resume_file_path,resume_file_name")
    .eq("id", resumeId)
    .single();

  if (resumeError) {
    throw new Error(resumeError.message);
  }

  if (!resume?.resume_file_path) {
    return { configured: true, data: null };
  }

  const options = download
    ? { download: resume.resume_file_name || "curriculo" }
    : undefined;
  const { data, error } = await supabase.storage
    .from(resumeBucket)
    .createSignedUrl(resume.resume_file_path, 5 * 60, options);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message || "Não foi possível gerar o acesso ao currículo.");
  }

  return {
    configured: true,
    data: {
      url: data.signedUrl,
      fileName: resume.resume_file_name || "curriculo",
    },
  };
}

export async function getApplications() {
  noStore();
  const supabase = createSupabaseAdmin();

  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("applications")
    .select(
      `
        *,
        jobs (
          id,
          company,
          role,
          neighborhood,
          city,
          status
        ),
        resumes (
          id,
          name,
          phone,
          email,
          desired_role,
          area,
          city,
          neighborhood,
          status,
          resume_file_path,
          resume_file_name
        )
      `,
    )
    .order("created_at", { ascending: false });

  if (error) {
    if (isMissingDatabaseSchema(error)) {
      return [];
    }

    throw new Error(error.message);
  }

  return data;
}

export async function getResumeCount() {
  noStore();
  const supabase = createSupabaseAdmin();

  if (!supabase) {
    return sampleResumes.length;
  }

  const { count, error } = await supabase
    .from("resumes")
    .select("id", { count: "exact", head: true });

  if (error) {
    if (isMissingDatabaseSchema(error)) {
      return sampleResumes.length;
    }

    throw new Error(error.message);
  }

  return count || 0;
}

export async function getInterviews() {
  noStore();
  const supabase = createSupabaseAdmin();

  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("interviews")
    .select("*")
    .order("starts_at", { ascending: true });

  if (error) {
    if (isMissingDatabaseSchema(error)) {
      return [];
    }

    throw new Error(error.message);
  }

  return data;
}

export async function createJob(payload) {
  const supabase = createSupabaseAdmin();

  if (!supabase) {
    return {
      configured: false,
      data: null,
    };
  }

  const { data, error } = await supabase
    .from("jobs")
    .insert({
      company: payload.company,
      role: payload.role,
      neighborhood: payload.neighborhood,
      salary: payload.salary,
      shift: payload.shift,
      contact: payload.contact,
      description: payload.description,
      status: "published",
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return { configured: true, data };
}

export async function createInterview(payload) {
  const supabase = createSupabaseAdmin();

  if (!supabase) {
    return {
      configured: false,
      data: null,
    };
  }

  const { data, error } = await supabase
    .from("interviews")
    .insert({
      resume_id: payload.resume_id,
      job_id: payload.job_id || null,
      starts_at: payload.starts_at,
      ends_at: payload.ends_at || null,
      channel: payload.channel,
      location: payload.location || null,
      notes: payload.notes || null,
      status: "scheduled",
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  if (payload.resume_id) {
    await supabase
      .from("resumes")
      .update({ status: "interview", updated_at: new Date().toISOString() })
      .eq("id", payload.resume_id);
  }

  return { configured: true, data };
}

export async function createApplication({ jobId, resumeId }) {
  const supabase = createSupabaseAdmin();

  if (!supabase || !resumeId) {
    return {
      configured: Boolean(supabase),
      data: null,
    };
  }

  if (!jobId) {
    return { configured: true, data: null };
  }

  const { data, error } = await supabase
    .from("applications")
    .insert({
      job_id: jobId,
      resume_id: resumeId,
      status: "applied",
    })
    .select()
    .single();

  if (error) {
    const isForeignKeyViolation =
      error?.code === "23503" || error?.message?.includes("foreign key");

    if (isForeignKeyViolation) {
      globalThis.console.warn(
        "[data] Aplicação não criada: vaga inexistente ou inativa para o job_id informado.",
        { jobId, resumeId },
      );
      return { configured: true, data: null };
    }

    throw new Error(error.message);
  }

  return { configured: true, data };
}

export async function createResume(payload) {
  const supabase = createSupabaseAdmin();

  if (!supabase) {
    return {
      configured: false,
      data: null,
    };
  }

  const baseRecord = {
    name: payload.name,
    phone: payload.phone,
    email: payload.email || null,
    desired_role: payload.desired_role,
    neighborhood: payload.neighborhood,
    availability: payload.availability || null,
    experience: payload.experience,
    lgpd_accepted: Boolean(payload.lgpd_accepted),
    status: "new",
  };
  const enrichedRecord = {
    ...baseRecord,
    area: payload.area || null,
    city: payload.city || "São Paulo",
    resume_file_path: payload.resume_file_path || null,
    resume_file_name: payload.resume_file_name || null,
    resume_file_type: payload.resume_file_type || null,
    resume_file_size: payload.resume_file_size || null,
  };

  let { data, error } = await supabase.from("resumes").insert(enrichedRecord).select().single();

  if (error && isMissingOptionalResumeColumn(error)) {
    const fallback = await supabase.from("resumes").insert(baseRecord).select().single();
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    throw new Error(error.message);
  }

  let application = null;

  if (payload.job_id) {
    try {
      const applicationResult = await createApplication({
        jobId: payload.job_id,
        resumeId: data.id,
      });
      application = applicationResult.data;
    } catch (caughtError) {
      globalThis.console.warn(
        "[data] Falha ao vincular application; currículo foi salvo normalmente.",
        { jobId: payload.job_id, resumeId: data.id, reason: caughtError.message },
      );
    }
  }

  return { configured: true, data, application };
}

export async function uploadResumeFile({ resumeId, fileName, contentType, bytes }) {
  const supabase = createSupabaseAdmin();

  if (!supabase) {
    return {
      configured: false,
      path: null,
    };
  }

  await supabase.storage.createBucket(resumeBucket, {
    public: false,
    fileSizeLimit: 8 * 1024 * 1024,
  });

  const safeName = fileName.replace(/[^\w.-]+/g, "_");
  const path = `${resumeId}/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage.from(resumeBucket).upload(path, bytes, {
    contentType,
    upsert: true,
  });

  if (error) {
    throw new Error(error.message);
  }

  return {
    configured: true,
    path,
  };
}

export async function updateResumeFile(resumeId, payload) {
  const supabase = createSupabaseAdmin();

  if (!supabase) {
    return {
      configured: false,
      data: null,
    };
  }

  const { data, error } = await supabase
    .from("resumes")
    .update({
      resume_file_path: payload.resume_file_path,
      resume_file_name: payload.resume_file_name,
      resume_file_type: payload.resume_file_type,
      resume_file_size: payload.resume_file_size,
      updated_at: new Date().toISOString(),
    })
    .eq("id", resumeId)
    .select()
    .single();

  if (error) {
    if (isMissingOptionalResumeColumn(error)) {
      return { configured: true, data: null };
    }

    throw new Error(error.message);
  }

  return { configured: true, data };
}

export async function updateResume(resumeId, payload) {
  const supabase = createSupabaseAdmin();

  if (!supabase) {
    return {
      configured: false,
      data: null,
    };
  }

  const record = {
    updated_at: new Date().toISOString(),
  };

  if (payload.status && resumeStatuses.has(payload.status)) {
    record.status = payload.status;
  }

  if (typeof payload.favorite === "boolean") {
    record.favorite = payload.favorite;
  }

  if (payload.tags !== undefined) {
    record.tags = normalizeTags(payload.tags);
  }

  if (payload.internal_notes !== undefined) {
    record.internal_notes = payload.internal_notes || null;
  }

  [
    "score_experience",
    "score_availability",
    "score_communication",
    "score_distance",
    "score_fit",
  ].forEach((field) => {
    if (payload[field] !== undefined) {
      record[field] = normalizeScore(payload[field]);
    }
  });

  const { data, error } = await supabase
    .from("resumes")
    .update(record)
    .eq("id", resumeId)
    .select()
    .single();

  if (error) {
    if (isMissingOptionalResumeColumn(error)) {
      const fallbackRecord = {
        updated_at: record.updated_at,
      };

      if (record.status) {
        fallbackRecord.status = record.status;
      }

      if (record.internal_notes !== undefined) {
        fallbackRecord.internal_notes = record.internal_notes;
      }

      const fallback = await supabase
        .from("resumes")
        .update(fallbackRecord)
        .eq("id", resumeId)
        .select()
        .single();

      if (fallback.error) {
        throw new Error(fallback.error.message);
      }

      return { configured: true, data: fallback.data };
    }

    throw new Error(error.message);
  }

  return { configured: true, data };
}

export function getPlatformStatus() {
  return {
    databaseConfigured: isSupabaseConfigured(),
  };
}
