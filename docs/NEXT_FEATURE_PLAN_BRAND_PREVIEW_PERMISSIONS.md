# Next Feature Plan: Brand, Preview, and Permissions

Branch: `playbill-brand-preview-permissions`

This plan captures the next larger feature set after the playbill UX cleanup. Do not begin implementation until we explicitly resume this work.

## Phase 1: Brand and Styling

### Phase 1A: Per-playbill styling controls

- Add playbill-level styling settings while keeping the current formatting as the default.
- Keep the first version intentionally simple and production-friendly.
- Suggested controls:
  - Title font and color
  - Header font and color
  - Subheading font and color
  - Body font and color
  - Accent color
  - Page/background color if useful
- Apply settings consistently across preview, public program, and export paths.
- Existing playbills must continue using the current default style unless changed.

### Phase 1B: Saved brand presets

- Add reusable brand kits that can be applied to future playbills.
- Presets should save the selected fonts and colors from Phase 1A.
- Applying a preset should copy settings onto a playbill, not silently change old shows later unless we explicitly add linked presets.
- Keep a built-in default brand matching the current app formatting.

### Phase 1C: Curated Google Fonts

- Use a curated Google Fonts dropdown instead of custom font uploads.
- Load only selected font families.
- Avoid font-file uploads for now to reduce storage, licensing, and rendering complexity.
- Leave room for future custom uploads only if truly needed later.

## Phase 2: Public Watermarked Preview

- Add an admin-controlled public preview link per playbill.
- Anyone with the URL can view it when enabled.
- Admins must be able to enable or disable the link.
- Render the real program pages with a transparent but visible watermark, such as `Preview - Not For Printing`.
- Default behavior should include all currently visible pages.
- Optional later improvement: per-section public preview toggles, if the default-all behavior feels too broad.
- The public preview should not become the final print/export route.

## Phase 3: User and Admin Management

- Treat this as a security/auth project, not only a UI feature.
- Authentication and permissions must work through the existing shared database setup.
- Do not create a separate app database.
- Support platform-level admins.
- Support playbill-level collaborators/managers.
- Add scoped permissions, likely including:
  - Manage playbill settings
  - Manage people and roles
  - Review submissions
  - Send reminders
  - Manage program sections/order
  - Export/publish
  - Manage collaborators
- Include an invite/approval flow compatible with the current Supabase auth setup.
- Before implementation, do a focused security and data-flow review to avoid permission loopholes.

## Implementation Notes

- Work in careful phases and keep the app functional after each phase.
- Avoid schema changes until the exact migration is reviewed.
- Any database changes must be backward-compatible and safe for the shared database.
- Preserve current formatting, preview behavior, and auth behavior as defaults.
