import Link from "next/link";
import { notFound } from "next/navigation";
import { PerformanceInputs } from "@/components/performance-inputs";
import { RichTextField } from "@/components/rich-text-field";
import { SectionOrderBuilder } from "@/components/section-order-builder";
import { getProgramBySlug, updateProgram } from "@/lib/programs";

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

  const rosterLines = [...program.castPeople, ...program.productionPeople]
    .map((person) => `${person.full_name} | ${person.role_title} | ${person.team_type} | ${person.email || ""}`)
    .join("\n");

  const action = updateProgram.bind(null, slug);

  return (
    <main>
      <div className="container grid">
        <div className="hide-print" style={{ display: "flex", gap: "0.8rem" }}>
          <Link href={`/programs/${slug}`}>Back to program</Link>
          <Link href="/programs">All programs</Link>
        </div>

        <h1>Edit Program</h1>
        {error ? (
          <div className="card" style={{ borderColor: "#b12727", color: "#8f1f1f" }}>
            {error}
          </div>
        ) : null}

        <form action={action} className="form-grid">
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
          />

          <label>
            Poster Image URL
            <input name="posterImageUrl" defaultValue={program.poster_image_url} />
          </label>

          <RichTextField name="directorNotes" label="Director's Note" initialValue={program.director_notes} />
          <RichTextField name="dramaturgicalNote" label="Dramaturgical Note" initialValue={program.dramaturgical_note} />
          <RichTextField name="billingPage" label="Billing Page" initialValue={program.billing_page} />
          <RichTextField name="actsAndSongs" label="Acts & Songs" initialValue={program.acts_songs} />
          <RichTextField name="departmentInfo" label="Department Information" initialValue={program.department_info} />
          <RichTextField name="acknowledgements" label="Acknowledgements" initialValue={program.acknowledgements} />
          <RichTextField name="seasonCalendar" label="Season Calendar" initialValue={program.season_calendar} />

          <label>
            ACTF Ad Image URL
            <input name="actfAdImageUrl" defaultValue={program.actf_ad_image_url} />
          </label>

          <label>
            Production Roster
            <textarea name="rosterLines" defaultValue={rosterLines} />
          </label>

          <label>
            Production Photo URLs (one per line)
            <textarea name="productionPhotoUrls" defaultValue={program.production_photo_urls.join("\n")} />
          </label>

          <label>
            Custom Pages (one per line)
            <textarea
              name="customPages"
              defaultValue={program.custom_pages
                .map((page) => `${page.title} | ${page.kind} | ${page.body}`)
                .join("\n")}
            />
          </label>

          <SectionOrderBuilder initialValue={program.layout_order.join("\n")} />

          <button type="submit">Save Changes</button>
        </form>
      </div>
    </main>
  );
}
