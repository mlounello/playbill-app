import { sanitizeRichText } from "@/lib/rich-text";
import type { ProgramPage } from "@/lib/programs";

export function ProgramPagePreviewCard({ page }: { page: ProgramPage | null }) {
  if (!page) {
    return <div className="meta-text">Select a module to see its first rendered page preview.</div>;
  }

  if (page.type === "poster") {
    return (
      <article className="booklet-page poster-page">
        <img src={page.imageUrl} alt={page.title} className="poster-image" />
      </article>
    );
  }

  if (page.type === "image") {
    const imagePageClassName = page.title ? "booklet-page image-page" : "booklet-page image-page image-page-full";
    return (
      <article className={imagePageClassName}>
        {page.title ? <h2 className="section-title playbill-title">{page.title}</h2> : null}
        <img src={page.imageUrl} alt={page.title || "Module preview"} className="full-page-image" />
      </article>
    );
  }

  if (page.type === "photo_grid") {
    return (
      <article className="booklet-page">
        {page.title ? <h2 className="section-title playbill-title">{page.title}</h2> : null}
        <div className="photo-grid">
          {page.photos.slice(0, 6).map((photo, index) => (
            <img key={`${photo}-${index}`} src={photo} alt={`Preview ${index + 1}`} className="photo-grid-item" />
          ))}
        </div>
      </article>
    );
  }

  if (page.type === "bios") {
    return (
      <article className="booklet-page">
        {page.title ? <h2 className="section-title playbill-title">{page.title}</h2> : null}
        <div className="bios-list">
          {page.people.slice(0, 3).map((person) => (
            <section key={person.id} className="bio-row">
              {page.showHeadshots !== false && person.headshot_url ? (
                <img src={person.headshot_url} alt={person.full_name} className="headshot" />
              ) : null}
              <div>
                <div className="bio-name">
                  {person.full_name}
                  {person.role_title?.trim() ? <span className="bio-role-inline"> ({person.role_title})</span> : null}
                </div>
                <div className="page-body rich-render bio-body" dangerouslySetInnerHTML={{ __html: sanitizeRichText(person.bio) }} />
              </div>
            </section>
          ))}
        </div>
      </article>
    );
  }

  if (page.type === "stacked") {
    return (
      <article className="booklet-page">
        <div className="stacked-sections">
          {page.sections.map((section, index) => (
            <section key={`${page.id}-${index}`} className="stacked-section">
              {section.title.trim() ? <h3 className="playbill-title stacked-section-title">{section.title}</h3> : null}
              <div className="page-body rich-render" dangerouslySetInnerHTML={{ __html: sanitizeRichText(section.body) }} />
            </section>
          ))}
        </div>
      </article>
    );
  }

  return (
    <article className="booklet-page">
      {page.title ? <h2 className="section-title playbill-title">{page.title}</h2> : null}
      <div className="page-body rich-render" dangerouslySetInnerHTML={{ __html: sanitizeRichText(page.body) }} />
    </article>
  );
}
