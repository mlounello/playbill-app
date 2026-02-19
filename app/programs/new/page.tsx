import Link from "next/link";
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

export default function NewProgramPage() {
  return (
    <main>
      <div className="container grid">
        <div className="hide-print">
          <Link href="/">Back</Link>
        </div>
        <h1>New Theatre Program</h1>
        <form action={createProgram} className="form-grid">
          <label>
            Show Title
            <input name="title" required placeholder="The Importance of Being Earnest" />
          </label>

          <label>
            Theatre Company
            <input name="theatreName" required placeholder="Main Street Players" />
          </label>

          <label>
            Show Dates
            <input name="showDates" required placeholder="March 14-23, 2026" />
          </label>

          <label>
            Poster Image URL (front page)
            <input name="posterImageUrl" placeholder="https://..." />
          </label>

          <label>
            Director&apos;s Note (full page)
            <textarea name="directorNotes" />
          </label>

          <label>
            Dramaturgical Note (full page)
            <textarea name="dramaturgicalNote" />
          </label>

          <label>
            Billing Page
            <textarea name="billingPage" placeholder="Production credits, rights, unions, legal copy..." />
          </label>

          <label>
            Acts & Songs (optional)
            <textarea name="actsAndSongs" placeholder="Act I\n1. Opening Number...\n\nAct II\n..." />
          </label>

          <label>
            Department Information
            <textarea name="departmentInfo" />
          </label>

          <label>
            Acknowledgements
            <textarea name="acknowledgements" />
          </label>

          <label>
            Season Calendar
            <textarea name="seasonCalendar" placeholder="Show title | dates | location\n..." />
          </label>

          <label>
            ACTF Full Page Ad Image URL
            <input name="actfAdImageUrl" placeholder="https://..." />
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
