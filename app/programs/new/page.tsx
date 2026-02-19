import Link from "next/link";
import { PerformanceInputs } from "@/components/performance-inputs";
import { RichTextField } from "@/components/rich-text-field";
import { createProgram } from "@/lib/programs";

const defaultLayoutOrder = [
  "poster",
  "director_note",
  "dramaturgical_note",
  "billing",
  "acts_songs",
  "cast_bios",
  "team_bios",
  "department_info",
  "actf_ad",
  "acknowledgements",
  "season_calendar",
  "production_photos",
  "custom_pages"
].join("\n");

export default async function NewProgramPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main>
      <div className="container grid">
        <div className="hide-print">
          <Link href="/">Back</Link>
        </div>
        <h1>New Theatre Program</h1>
        {error ? (
          <div className="card" style={{ borderColor: "#b12727", color: "#8f1f1f" }}>
            {error}
          </div>
        ) : null}
        <form action={createProgram} className="form-grid">
          <label>
            Show Title
            <input name="title" required placeholder="The Importance of Being Earnest" />
          </label>

          <label>
            Theatre Company
            <input name="theatreName" placeholder="Main Street Players" />
          </label>

          <PerformanceInputs />

          <label>
            Poster Image URL (front page)
            <input name="posterImageUrl" placeholder="https://..." />
          </label>

          <RichTextField name="directorNotes" label="Director's Note (full page)" />
          <RichTextField name="dramaturgicalNote" label="Dramaturgical Note (full page)" />
          <RichTextField
            name="billingPage"
            label="Billing Page"
            placeholder="Production credits, rights, unions, legal copy..."
          />
          <RichTextField
            name="actsAndSongs"
            label="Acts & Songs (optional)"
            placeholder="Act I, song list, Act II, reprises..."
          />
          <RichTextField name="departmentInfo" label="Department Information" />
          <RichTextField name="acknowledgements" label="Acknowledgements" />
          <RichTextField name="seasonCalendar" label="Season Calendar" placeholder="Show title, dates, location..." />

          <label>
            ACTF Full Page Ad Image URL
            <input name="actfAdImageUrl" placeholder="https://..." />
          </label>

          <label>
            Production Roster (recommended)
            <textarea
              name="rosterLines"
              placeholder="Jane Doe | Juliet | cast | jane@example.com&#10;Mark Smith | Director | production | mark@example.com&#10;..."
            />
          </label>

          <label>
            Cast Bios (one per line)
            <textarea
              name="castLines"
              placeholder="Jane Doe | Lady Bracknell | Jane is delighted to return to the stage. | https://headshot-url"
            />
          </label>

          <label>
            Production Team Bios (one per line)
            <textarea
              name="productionTeamLines"
              placeholder="Mark Smith | Director | Mark has directed over 20 productions. | https://headshot-url"
            />
          </label>

          <label>
            Production Photo URLs (one per line)
            <textarea name="productionPhotoUrls" placeholder="https://...\nhttps://..." />
          </label>

          <label>
            Custom Pages (one per line)
            <textarea
              name="customPages"
              placeholder="Patron List | text | Names and giving levels...&#10;Lobby Display | image | https://...&#10;Rehearsal Montage | photos | https://..., https://..., https://..."
            />
          </label>

          <label>
            Layout Order Blueprint (one token per line)
            <textarea name="layoutOrder" defaultValue={defaultLayoutOrder} />
          </label>

          <div className="card" style={{ fontSize: "0.95rem" }}>
            Roster format: <code>Name | Role | cast|production | optional@email.com</code>
            <br />
            Person format: <code>Name | Role | Bio | OptionalHeadshotURL</code>
            <br />
            Custom page format: <code>Title | text|image|photos | Content</code>
            <br />
            Valid layout tokens: <code>poster</code>, <code>director_note</code>, <code>dramaturgical_note</code>, <code>billing</code>, <code>acts_songs</code>, <code>cast_bios</code>, <code>team_bios</code>, <code>department_info</code>, <code>actf_ad</code>, <code>acknowledgements</code>, <code>season_calendar</code>, <code>production_photos</code>, <code>custom_pages</code>
          </div>

          <button type="submit">Create Program</button>
        </form>
      </div>
    </main>
  );
}
