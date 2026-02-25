# Execution Status Tracker

Last updated: 2026-02-25 (later session)

This file tracks progress against the agreed execution plan (Phase 0 through Phase 8).

## Phase Summary

| Phase | Name | Status |
| --- | --- | --- |
| 0 | Baseline + Regression Repro | Done |
| 1 | Data/Render Correctness First | Done |
| 2 | Module Behavior Model Refactor | Mostly done |
| 3 | Pagination/Stacking Engine Upgrade | Mostly done |
| 4 | People & Roles UX Overhaul | Partially done |
| 5 | Special Note Assignment System | Mostly done |
| 6 | Editor/Preview Interaction Improvements | Partially done |
| 7 | Visual/Brand Polish Pass | Mostly done |
| 8 | Deep Cleanup + Debt Removal | Not started |

## Detailed Notes

## Phase 0: Baseline + Regression Repro
- Status: Done
- Completed:
  - Baseline workflow and regression focus established.
  - Core repro paths identified for module/list rendering and submission flow consistency.

## Phase 1: Data/Render Correctness First
- Status: Done
- Completed:
  - Team list data rendering corrected from show/role data paths.
  - Overview/submissions count mismatches addressed.
  - Producing profile rendering pipeline improved for rich text output.
- Acceptance state:
  - Achieved in current working state with recent deployments.

## Phase 2: Module Behavior Model Refactor
- Status: Mostly done
- Completed:
  - Module controls simplified and clarified.
  - Confusing advanced/raw JSON exposure reduced.
  - Module title/header behavior improved.
- Remaining:
  - Final edge-case verification for all toggle combinations across preview/export parity.

## Phase 3: Pagination/Stacking Engine Upgrade
- Status: Mostly done
- Completed:
  - Multiple pagination bugs fixed.
  - Bio split behavior improved.
  - Added richer text-module pagination support when `allow_multiple_pages=true` so long note/section modules can continue across pages.
  - Tightened stack budgets and flow packing behavior for safer print-fit (fewer clipped overflows).
- Remaining:
  - Final tuning against real full-show imports for edge cases with very dense mixed modules.

## Phase 4: People & Roles UX Overhaul
- Status: Mostly done
- Completed:
  - Significant improvements to role assignment editing and category handling.
  - Stability fixes for people/roles routes and saves.
  - Consolidated management around the main people table + person edit modal with inline role add/edit/remove.
  - Removed duplicate role-assignment management surface to reduce confusion.
- Remaining:
  - Optional polish pass (column density, inline sorting/filter controls) after next live usage cycle.

## Phase 5: Special Note Assignment System
- Status: Mostly done
- Completed:
  - Special note save/read stability improved.
  - Submission-line behavior for notes improved.
  - Added reusable special note template library flow (global/show scope) with create/archive actions.
  - Added template selection directly in Special Note Assignments and persisted template metadata to submission request constraints/labels.
- Remaining:
  - Optional expansion to fully custom note *types* beyond director/dramaturg/music (larger schema/render flow change).

## Phase 6: Editor/Preview Interaction Improvements
- Status: Partially done
- Completed:
  - WYSIWYG behavior and save reliability improved.
  - Input interaction bugs reduced.
- Remaining:
  - Floating/live module preview while editing.
  - Further no-jump partial update behavior across admin forms.

## Phase 7: Visual/Brand Polish Pass
- Status: Mostly done
- Completed:
  - Broad style cleanup across major pages.
  - Better consistency in controls and loading feedback.
  - Implemented styled Season Calendar rendering with branded boxed/date-badge visual treatment.
- Remaining:
  - Final spacing/typography/microcopy consistency pass after next integrated QA round.

## Phase 8: Deep Cleanup + Debt Removal
- Status: Not started
- Planned:
  - Dead code removal, stale placeholder cleanup, migration-safe DB/table audit.
  - Logic path consolidation, test/lint/type gates, and cleanup report.

## Current Overall Estimate
- Approximate completion against this 0–8 execution plan: 72% to 82%.

## Update Rule
- Update this file at the end of each implementation batch with:
  - what changed,
  - which phase moved status,
  - what remains.
