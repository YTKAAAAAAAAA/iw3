# Handoff — operations workflow UI

## Session status

The operations prototype is implemented and visually verified at desktop and mobile widths. Backend/persistence remains out of scope; all prototype interactions use local component state and mock data.

The working tree also contains pre-existing changes that were preserved, including the `package-lock.json` change. Do not reset or discard unrelated changes.

## What was added

- `app/prototype/page.tsx` — dispatcher “Today” route at `/prototype`.
- `app/prototype/vacancies/[id]/page.tsx` — focused vacancy operations route at `/prototype/vacancies/v-warehouse`.
- `components/prototype-today.tsx` — Today desk with:
  - Ordered / Assigned / Confirmed / Present metrics;
  - needs-attention queue;
  - next-shift coverage summaries;
  - roster confirmation and attendance badges;
  - end-of-day checklist.
- `components/prototype-vacancy.tsx` — vacancy workflow with:
  - separate confirmation and attendance states;
  - visible coverage segments and uncovered intervals;
  - site instructions disclosure;
  - requirements and explainable candidate-fit states;
  - change history tab;
  - local confirmation action;
  - linked cover-shift drawer that preserves the original shift;
  - local add-person placeholder action.
- `app/globals.css` — focused styles for the prototype, preserving the existing theme and responsive conventions.

## Product direction

The prototype makes the operational lifecycle visible instead of replacing it with one status:

`ordered → assigned → offered → accepted/declined → confirmed → on the way → present → worked → hours closed`

The important UI distinction is between planned assignment, worker confirmation, and actual attendance.

## Verification completed

- `npx tsc --noEmit --pretty false` — passed.
- `git diff --check` — passed.
- `npm test` — 45 tests passed.
- `npm run build` — passed.
- Preview routes verified:
  - `/prototype`
  - `/prototype/vacancies/v-warehouse`
- Interactive checks completed:
  - site-instructions disclosure;
  - confirmation action and success notice;
  - first warehouse shift displays the demand’s 06:00 start;
  - mobile viewport at 375px has no horizontal document overflow.

The build reports the repository’s existing Next.js warning that the `middleware` convention is deprecated in favor of `proxy`; this was not changed because it is outside the prototype scope.

## Known prototype limitations

- The prototype vacancy route intentionally uses the warehouse scenario regardless of the dynamic `id`.
- Candidate-fit reasons are visual demonstration data, with some conditions keyed to the mock worker IDs.
- The cover demonstration starts at 12:00 to illustrate the known warehouse gap; it is not yet a generalized gap editor.
- The main production navigation remains unchanged. The prototype is intentionally reachable through its explicit route rather than becoming a permanent top-level product section.

## Suggested next pass

1. Decide whether Overview should receive a subtle link into the prototype workspace.
2. Generalize the replacement drawer’s gap start/end from attendance and coverage data.
3. Connect the “Add person” action to a local candidate picker.
4. Add keyboard focus verification for tabs, drawer close, and row actions.
5. If the prototype direction is approved, promote individual patterns into the existing vacancy schedule incrementally rather than replacing the current production UI.
