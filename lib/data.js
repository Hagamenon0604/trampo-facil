import { unstable_noStore as noStore } from "next/cache";
import { sampleJobs, sampleResumes } from "@/lib/seed";
import { createSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";

function isMissingDatabaseSchema(error) {
  return error?.code === "42P01" || error?.message?.includes("schema cache");
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

  if (!supabase || !jobId || !resumeId) {
    return {
      configured: Boolean(supabase),
      data: null,
    };
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

  const { data, error } = await supabase
    .from("resumes")
    .insert({
      name: payload.name,
      phone: payload.phone,
      email: payload.email || null,
      desired_role: payload.desired_role,
      neighborhood: payload.neighborhood,
      availability: payload.availability || null,
      experience: payload.experience,
      lgpd_accepted: Boolean(payload.lgpd_accepted),
      status: "new",
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  let application = null;

  if (payload.job_id) {
    const applicationResult = await createApplication({
      jobId: payload.job_id,
      resumeId: data.id,
    });
    application = applicationResult.data;
  }

  return { configured: true, data, application };
}

export function getPlatformStatus() {
  return {
    databaseConfigured: isSupabaseConfigured(),
  };
}
