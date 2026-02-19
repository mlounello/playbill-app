import Link from "next/link";
import { createProgram } from "@/lib/programs";

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
            Director&apos;s Notes
            <textarea name="directorNotes" required placeholder="Welcome message, concept, acknowledgements..." />
          </label>

          <label>
            Additional Acknowledgements
            <textarea name="acknowledgements" placeholder="Sponsors, special thanks, donors..." />
          </label>

          <label>
            Cast & Crew (one per line)
            <textarea
              name="castAndCrewLines"
              required
              placeholder="Jane Doe | Lady Bracknell | Jane is delighted to return to the stage.&#10;Mark Smith | Director | Mark has directed over 20 regional productions."
            />
          </label>

          <div className="card" style={{ fontSize: "0.95rem" }}>
            Format: <code>Name | Role | Bio</code>
          </div>

          <button type="submit">Create Program</button>
        </form>
      </div>
    </main>
  );
}
