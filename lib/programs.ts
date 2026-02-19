import { redirect } from "next/navigation";
import { z } from "zod";
import { getSupabaseReadClient, getSupabaseWriteClient } from "@/lib/supabase";

const personLineSchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  bio: z.string().min(1)
});

const payloadSchema = z.object({
  title: z.string().min(3),
  theatreName: z.string().min(2),
  showDates: z.string().min(3),
  directorNotes: z.string().min(10),
  acknowledgements: z.string().optional(),
  castAndCrewLines: z.string().min(1)
});

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function parsePeople(lines: string) {
  return lines
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name = "", role = "", ...bioParts] = line.split("|").map((part) => part.trim());
      return personLineSchema.parse({
        name,
        role,
        bio: bioParts.join(" | ")
      });
    });
}

export async function createProgram(formData: FormData) {
  "use server";

  const parsed = payloadSchema.parse({
    title: formData.get("title"),
    theatreName: formData.get("theatreName"),
    showDates: formData.get("showDates"),
    directorNotes: formData.get("directorNotes"),
    acknowledgements: formData.get("acknowledgements") ?? "",
    castAndCrewLines: formData.get("castAndCrewLines")
  });

  const client = getSupabaseWriteClient();
  const baseSlug = slugify(parsed.title);
  const slug = `${baseSlug}-${Date.now().toString().slice(-5)}`;

  const { data: program, error: programError } = await client
    .from("programs")
    .insert({
      title: parsed.title,
      slug,
      theatre_name: parsed.theatreName,
      show_dates: parsed.showDates,
      director_notes: parsed.directorNotes,
      acknowledgements: parsed.acknowledgements
    })
    .select("id, slug")
    .single();

  if (programError || !program) {
    throw new Error(programError?.message ?? "Could not create program.");
  }

  const people = parsePeople(parsed.castAndCrewLines).map((person) => ({
    program_id: program.id,
    full_name: person.name,
    role_title: person.role,
    bio: person.bio
  }));

  const { error: peopleError } = await client.from("people").insert(people);
  if (peopleError) {
    throw new Error(peopleError.message);
  }

  redirect(`/programs/${program.slug}`);
}

export async function getProgramBySlug(slug: string) {
  const client = getSupabaseReadClient();

  const { data: program, error } = await client
    .from("programs")
    .select("id, title, slug, theatre_name, show_dates, director_notes, acknowledgements")
    .eq("slug", slug)
    .single();

  if (error || !program) {
    return null;
  }

  const { data: people, error: peopleError } = await client
    .from("people")
    .select("id, full_name, role_title, bio")
    .eq("program_id", program.id)
    .order("full_name", { ascending: true });

  if (peopleError) {
    throw new Error(peopleError.message);
  }

  return { ...program, people: people ?? [] };
}
