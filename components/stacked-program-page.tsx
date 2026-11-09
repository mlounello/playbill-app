import type { ProgramPage } from "@/lib/programs";
import { sanitizeRichText } from "@/lib/rich-text";

export function StackedProgramPage({ page }: { page: Extract<ProgramPage, { type: "stacked" }> }) {
  return (
    <article className="booklet-page">
      <div className="stacked-sections">
        {page.sections.map((section, index) => (
          <section key={index} className={`stacked-section text-fit-${section.textFit ?? "normal"}`}>
            {section.title.trim() ? <h3 className="playbill-title stacked-section-title">{section.title}</h3> : null}
            {section.bios ? (
              <div className="bios-list">
                {section.bios.map((person, personIndex) => (
                  <section key={personIndex} className="bio-row">
                    {section.showHeadshots !== false && person.headshot_url ? (
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
            ) : (
              <div className="page-body rich-render" dangerouslySetInnerHTML={{ __html: sanitizeRichText(section.body) }} />
            )}
          </section>
        ))}
      </div>
    </article>
  );
}
