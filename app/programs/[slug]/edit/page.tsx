import Link from "next/link";
import { notFound } from "next/navigation";
import { PerformanceInputs } from "@/components/performance-inputs";
import { ProgramEditDraftManager } from "@/components/program-edit-draft-manager";
import { ProgramImageUpload } from "@/components/program-image-upload";
import { RichTextField } from "@/components/rich-text-field";
import { getProgramBySlug, updateProgram } from "@/lib/programs";
import { getSupabaseReadClient } from "@/lib/supabase";

export default async function EditProgramPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { slug } = await params;
  const { error } = await searchParams;
  const program = await getProgramBySlug(slug);

  if (!program) {
    notFound();
  }

  const client = getSupabaseReadClient();
  const { data: showRow } = await client.from("shows").select("id").eq("program_id", program.id).maybeSingle();
  const programPlanHref = showRow?.id ? `/app/shows/${showRow.id}?tab=program-plan` : null;

  const rosterLines = [...program.castPeople, ...program.productionPeople]
    .map((person) => `${person.full_name} | ${person.role_title} | ${person.team_type} | ${person.email || ""}`)
    .join("\n");

  const action = updateProgram.bind(null, slug);
  const draftNamespace = `program-edit:${slug}`;
  const formId = "program-edit-form";

  return (
    <main>
      <div className="container page-shell">
        <div className="hide-print top-actions">
          <Link href={`/programs/${slug}`}>Back to program</Link>
          <Link href="/programs">All programs</Link>
        </div>

        <h1>Edit Program</h1>
        {error ? (
          <div className="card alert">
            {error}
          </div>
        ) : null}
        <div className="card stack-sm">
          <strong>Program Structure</strong>
          <div className="meta-text">
            Page order and visibility are managed in Program Plan, not on this form.
          </div>
          {programPlanHref ? (
            <div>
              <Link href={programPlanHref}>Open Program Plan</Link>
            </div>
          ) : null}
        </div>

        <form id={formId} action={action} className="form-grid page-shell">
          <ProgramEditDraftManager formId={formId} draftNamespace={draftNamespace} />
          <label>
            Show Title
            <input name="title" required defaultValue={program.title} />
          </label>

          <label>
            Theatre Company
            <input name="theatreName" defaultValue={program.theatre_name} />
          </label>

          <PerformanceInputs
            initialPerformances={program.performance_schedule}
            initialShowDatesOverride={program.show_dates}
            draftNamespace={draftNamespace}
          />

          <label>
            Poster Image URL
            <input id="posterImageUrlInput" name="posterImageUrl" defaultValue={program.poster_image_url} />
          </label>
          <ProgramImageUpload
            programSlug={slug}
            assetType="poster"
            targetInputId="posterImageUrlInput"
            label="Upload Poster Image (optional)"
          />

          <RichTextField name="directorNotes" label="Director's Note" initialValue={program.director_notes} draftNamespace={draftNamespace} />
          <RichTextField name="dramaturgicalNote" label="Dramaturgical Note" initialValue={program.dramaturgical_note} draftNamespace={draftNamespace} />
          <RichTextField name="billingPage" label="Billing Page" initialValue={program.billing_page} draftNamespace={draftNamespace} />
          <RichTextField name="actsAndSongs" label="Acts & Songs" initialValue={program.acts_songs} draftNamespace={draftNamespace} />
          <RichTextField name="departmentInfo" label="Department Information" initialValue={program.department_info} draftNamespace={draftNamespace} />
          <RichTextField name="acknowledgements" label="Acknowledgements" initialValue={program.acknowledgements} draftNamespace={draftNamespace} />
          <RichTextField name="seasonCalendar" label="Season Calendar" initialValue={program.season_calendar} draftNamespace={draftNamespace} />

          <label>
            ACTF Ad Image URL
            <input id="actfAdImageUrlInput" name="actfAdImageUrl" defaultValue={program.actf_ad_image_url} />
          </label>
          <ProgramImageUpload
            programSlug={slug}
            assetType="actf"
            targetInputId="actfAdImageUrlInput"
            label="Upload ACTF/Ad Image (optional)"
          />

          <label>
            Production Roster
            <textarea name="rosterLines" defaultValue={rosterLines} />
          </label>

          <label>
            Production Photo URLs (one per line)
            <textarea name="productionPhotoUrls" defaultValue={program.production_photo_urls.join("\n")} />
          </label>
          <ProgramImageUpload
            programSlug={slug}
            assetType="photo"
            label="Upload a Production Photo (copy URL into list above)"
          />

          <label>
            Custom Pages (one per line)
            <textarea
              name="customPages"
              defaultValue={program.custom_pages
                .map((page) => `${page.title} | ${page.kind} | ${page.body}`)
                .join("\n")}
            />
          </label>
          <div className="meta-text">
            Google Drive files can be used if they are shared publicly and pasted as direct image URLs.
          </div>

          <button type="submit">Save Changes</button>
        </form>
      </div>
    </main>
  );
}
