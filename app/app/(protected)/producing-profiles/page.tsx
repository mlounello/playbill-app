import Link from "next/link";
import { FlashToast } from "@/components/flash-toast";
import { RichTextField } from "@/components/rich-text-field";
import {
  createProducingProfile,
  deleteProducingProfile,
  getProducingProfileLibrary,
  updateProducingProfile
} from "@/lib/departments";

export default async function ProducingProfilesPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { error, success } = await searchParams;
  const profiles = await getProducingProfileLibrary();

  return (
    <main>
      <div className="container container-wide page-shell">
        <div className="title-row">
          <h1>Producing Department / Company Profiles</h1>
          <Link className="button-link" href="/app/shows">
            Back to Shows
          </Link>
        </div>

        <FlashToast message={error} tone="error" />
        <FlashToast message={success} tone="success" />

        <section className="card stack-sm">
          <strong>Create Profile</strong>
          <form action={createProducingProfile} className="stack-sm">
            <label>
              Producing department / company name
              <input name="name" required placeholder="Siena University Creative Arts Department" />
            </label>
            <RichTextField
              name="description"
              label="Overview / leadership / mission"
              placeholder="Chair, faculty, mission statement, and program details..."
              draftNamespace="producing-profiles:create"
            />
            <div className="form-row-2">
              <label>
                Website
                <input name="website" placeholder="https://..." />
              </label>
              <label>
                Contact Email
                <input name="contactEmail" type="email" placeholder="creativearts@siena.edu" />
              </label>
            </div>
            <label>
              Contact Phone
              <input name="contactPhone" placeholder="(518) 555-1234" />
            </label>
            <button type="submit">Create Profile</button>
          </form>
        </section>

        <section className="card stack-sm">
          <strong>Profile Library</strong>
          {profiles.length === 0 ? (
            <div className="meta-text">No profiles yet.</div>
          ) : (
            <div className="stack-sm">
              {profiles.map((profile) => (
                <article key={profile.id} className="card card-soft stack-sm">
                  <form action={updateProducingProfile} className="stack-sm">
                    <input type="hidden" name="id" value={profile.id} />
                    <label>
                      Name
                      <input name="name" defaultValue={profile.name} required />
                    </label>
                    <RichTextField
                      name="description"
                      label="Description"
                      initialValue={profile.description}
                      draftNamespace={`producing-profiles:${profile.id}`}
                    />
                    <div className="form-row-2">
                      <label>
                        Website
                        <input name="website" defaultValue={profile.website} />
                      </label>
                      <label>
                        Contact Email
                        <input name="contactEmail" type="email" defaultValue={profile.contact_email} />
                      </label>
                    </div>
                    <label>
                      Contact Phone
                      <input name="contactPhone" defaultValue={profile.contact_phone} />
                    </label>
                    <button type="submit">Save Profile</button>
                  </form>
                  <form action={deleteProducingProfile}>
                    <input type="hidden" name="id" value={profile.id} />
                    <button type="submit">Delete Profile</button>
                  </form>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
