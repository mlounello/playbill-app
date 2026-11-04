# Acts & Songs builder

Development branch: `codex/flexible-acts-and-songs`.

## Existing implementation and changes

Songs already lived in `program_modules.settings.songs`. The editor, save action,
and renderer each normalized that JSON differently. In particular, the server save
normalizer omitted `singerRoleIds`, losing character selections on save. The old
renderer used billing-list HTML, whose non-wrapping dotted-leader rows were not
suited to lengthy musical credits.

The revised builder shares normalization and credit resolution in `lib/songs.ts`.
Existing camelCase and snake_case singer selections and Company/Ensemble flags
become ordered credits without changing any cast assignments. Legacy free-form
`programs.acts_songs` remains the fallback when no structured songs are present.

## Editing

Open Sections & Order, then the Songs section's content options.

- Add songs and type an act label, reusing the suggested labels where appropriate.
- Reorder songs and individual credits using Up/Down. Acts follow first appearance.
- Add cast characters, cast performers, custom characters, or editable group labels.
- Optionally link a custom character to a performer; only its character label prints.
- A new performer credit prints the performer's name. Its character-name toggle
  prints their character credit(s) instead. Imported legacy performer selections
  keep their previous character-name behavior. Display overrides take priority.
- Leave credits empty for instrumentals.
- Set short character names in the section's expandable settings. The current cast
  schema has no character short-name field; performer preferred names are different.
  These section-level names do not rename master cast records. Song-specific
  overrides take priority, then section short names, then an existing role short
  name if supplied, then the full character name.
- Select single-column dotted leaders or two-column layout. Single-column mode
  prints titles on the left and credits against the right margin, with flexible
  dotted leaders between them. Acts share the page when space permits.
  Two-column mode pairs acts in order,
  preserves left/right slots on continuation pages, and uses full width for one act.
- The inline preview shows unsaved changes. Save Sections and Order to apply them.

## Storage and deployment

No migration or production database repair is required. All additions are in
existing module settings: `songs_layout`, `song_character_names`, and each song's
`credits`. Credit rows retain stable IDs, role IDs, optional performer IDs, custom
labels, and display overrides. Legacy singer fields are retained as well.

Previously discarded character IDs cannot be reconstructed automatically. If an
older save already lost a selection, choose the character again.

## Rendering and pagination

`SongProgramPageView` renders the same generated layout in the editor, section
preview, full preview, published reader, and the existing Playwright PDF routes.
Text is escaped, wraps naturally, and uses scoped song-only styling. Other program
pages retain their margins and typography. Song pages do not flow-pack with billing
or prose pages.

Browser measurements use the same layout CSS and printable dimensions. Results
are reused within a server render; unavailable Chromium uses conservative estimates.
Pagination reserves additional space for font variations. An individual song longer
than a page or an unresolved character/performer selection produces a visible
warning. Shorten an oversized credit or choose one column before exporting.

Both layouts automatically reduce song text and spacing before adding continuation
pages. The largest fitting size is selected in steps from 100% to 85% (approximately
8pt for credits). Single-column fitting considers the combined natural width of
the title and its credits as well as total page height. Text still wraps and long
lists paginate when the readable minimum cannot fit everything. Headings and other
playbill sections retain their sizes. The editor reports the selected auto-fit size.

The app's existing emergency PDF fallback remains a simplified text summary;
visual parity depends on the normal Playwright renderer. Old exported PDFs are
not rewritten: generate a fresh export after saving changes.

## Verification and review

Run `PLAYWRIGHT_CHANNEL=chrome npm run test:songs` for a local Chrome installation,
or `npm run test:songs` with Playwright's matching Chromium installed. Tests include
RENT titles, legacy JSON roundtrips, the actual save normalizer, display-name
priority, custom performer links, ordered mixed credits, blank credits, independent
act pagination, escaping, overflow warnings, real CSS wrapping, 396 x 612pt proof
PDFs, and imposed 792 x 612pt booklet PDFs using the existing booklet spread order.

Also run the roster and list-layout regression tests and `npm run build`.
The React editor was exercised using temporary local fixture data on desktop and
390px mobile widths; that fixture route was removed after checking. Production
data and production-authenticated export/download flows were not used in QA.

Review this branch's preview with an existing playbill before merging. Check old
songs, add mixed credits, save/reopen, compare section/full/published previews, and
generate proof and imposed print exports. More than two acts are placed on the
next page pair rather than creating a third narrow column.
