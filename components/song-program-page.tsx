import { SONG_PAGE_CSS, renderSongPageHtml, type SongProgramPage } from "@/lib/songs";

export function SongProgramPageView({ page }: { page: SongProgramPage }) {
  return <>
    <style>{SONG_PAGE_CSS}</style>
    {page.warnings.map((warning) => <p key={warning} className="alert hide-print" role="status">{warning}</p>)}
    <article className="booklet-page songs-print-page" dangerouslySetInnerHTML={{ __html: renderSongPageHtml(page) }} />
  </>;
}
