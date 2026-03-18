import Link from "next/link";
import { FlashToast } from "@/components/flash-toast";
import {
  createSeasonLibraryEntry,
  deleteSeasonLibraryEntry,
  deleteSeasonLibraryEvent,
  getSeasonLibraryData,
  upsertSeasonLibraryEvent,
  updateSeasonLibraryEntry
} from "@/lib/seasons";

export default async function SeasonsLibraryPage({
  searchParams
}: {
  searchParams: Promise<{ seasonId?: string; error?: string; success?: string }>;
}) {
  const { seasonId, error, success } = await searchParams;
  const data = await getSeasonLibraryData(seasonId ?? "");

  return (
    <main>
      <div className="container container-wide page-shell">
        <div className="title-row">
          <h1>Season Builder</h1>
          <Link className="button-link" href="/app/shows">
            Back to Shows
          </Link>
        </div>

        <FlashToast message={error} tone="error" />
        <FlashToast message={success} tone="success" />

        <section className="card stack-sm">
          <strong>Create Season</strong>
          <form action={createSeasonLibraryEntry} className="top-actions">
            <label>
              Season name
              <input name="name" required placeholder="AY 2025-2026" />
            </label>
            <button type="submit">Create Season</button>
          </form>
        </section>

        <section className="card stack-sm">
          <strong>Edit Season</strong>
          {data.seasons.length === 0 ? (
            <div className="meta-text">No seasons yet.</div>
          ) : (
            <>
              <form action="/app/seasons" method="get" className="top-actions">
                <label>
                  Active season
                  <select name="seasonId" defaultValue={data.selectedSeasonId}>
                    {data.seasons.map((season) => (
                      <option key={season.id} value={season.id}>
                        {season.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit">Open</button>
              </form>

              {data.selectedSeasonId ? (
                <div className="stack-sm">
                  <div className="meta-text">
                    Linked shows: <strong>{data.linkedShowCount}</strong>
                  </div>

                  <form action={updateSeasonLibraryEntry} className="top-actions">
                    <input type="hidden" name="seasonId" value={data.selectedSeasonId} />
                    <label>
                      Season name
                      <input name="name" required defaultValue={data.selectedSeasonName} />
                    </label>
                    <button type="submit">Save Season Name</button>
                  </form>

                  <form action={deleteSeasonLibraryEntry} className="stack-sm">
                    <input type="hidden" name="seasonId" value={data.selectedSeasonId} />
                    <button type="submit">Delete Season</button>
                  </form>
                </div>
              ) : null}
            </>
          )}
        </section>

        <section className="card stack-sm">
          <strong>Season Events</strong>
          {!data.selectedSeasonId ? (
            <div className="meta-text">Select a season to manage events.</div>
          ) : (
            <>
              <form action={upsertSeasonLibraryEvent} className="stack-sm">
                <input type="hidden" name="seasonId" value={data.selectedSeasonId} />
                <div className="form-row-2">
                  <label>
                    Event title
                    <input name="title" required placeholder="Spring Cabaret" />
                  </label>
                  <label>
                    Location
                    <input name="location" placeholder="Beaudoin Theatre" />
                  </label>
                </div>
                <div className="form-row-2">
                  <label>
                    Start date
                    <input type="date" name="eventStartDate" required />
                  </label>
                  <label>
                    End date (optional)
                    <input type="date" name="eventEndDate" />
                  </label>
                </div>
                <div className="form-row-2">
                  <label>
                    Time text
                    <input name="timeText" placeholder="8:00pm (3:00pm Sunday matinee)" />
                  </label>
                  <label>
                    Sort order
                    <input type="number" name="sortOrder" defaultValue={0} />
                  </label>
                </div>
                <button type="submit">Add Event</button>
              </form>

              {data.selectedSeasonEvents.length > 0 ? (
                <div className="stack-sm">
                  {data.selectedSeasonEvents.map((event) => (
                    <article key={event.id} className="card card-soft stack-sm">
                      <form action={upsertSeasonLibraryEvent} className="stack-sm">
                        <input type="hidden" name="eventId" value={event.id} />
                        <input type="hidden" name="seasonId" value={data.selectedSeasonId} />
                        <div className="form-row-2">
                          <label>
                            Event title
                            <input name="title" defaultValue={event.title} required />
                          </label>
                          <label>
                            Location
                            <input name="location" defaultValue={event.location} />
                          </label>
                        </div>
                        <div className="form-row-2">
                          <label>
                            Start date
                            <input type="date" name="eventStartDate" defaultValue={event.event_start_date} required />
                          </label>
                          <label>
                            End date
                            <input type="date" name="eventEndDate" defaultValue={event.event_end_date ?? ""} />
                          </label>
                        </div>
                        <div className="form-row-2">
                          <label>
                            Time text
                            <input name="timeText" defaultValue={event.time_text} />
                          </label>
                          <label>
                            Sort order
                            <input type="number" name="sortOrder" defaultValue={event.sort_order} />
                          </label>
                        </div>
                        <button type="submit">Save Event</button>
                      </form>
                      <form action={deleteSeasonLibraryEvent}>
                        <input type="hidden" name="seasonId" value={data.selectedSeasonId} />
                        <input type="hidden" name="eventId" value={event.id} />
                        <button type="submit">Delete Event</button>
                      </form>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="meta-text">No events yet for this season.</div>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
