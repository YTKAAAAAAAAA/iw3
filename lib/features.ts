/**
 * Feature switches for the operations rework (September 2026).
 *
 * Every change proposed in that round is gated here so it can be judged — and
 * dropped — on its own. Set a flag to false and that feature disappears from
 * the UI without touching anything else; the code it guards is listed beside
 * it, so deleting the feature for good is a mechanical job.
 *
 * Nothing else in the app should read process.env or invent its own toggle.
 */
export const FEATURES = {
  /** F1 — Trim the people list: no phone column, no email under the name.
   *  Both are one click away in the worker card.
   *  Code: components/workforce-views.tsx → PeopleTable */
  leanPeopleList: true,

  /** F2 — Shifts carry a start and an end time instead of a flat day.
   *  Lets two people split one slot, and makes "left at 10:00, cover arrived
   *  at 12:00" expressible. Conflicts become overlapping times rather than
   *  "already has a shift that date".
   *  Code: lib/types.ts (RosterEntry.start/end), lib/derive.ts → shiftsOverlap,
   *  workerDayShifts, coverageGaps */
  timedShifts: true,

  /** F3 — Client demand per day and sub-object, separate from who is placed.
   *  "They asked for two on Tuesday and one again on Wednesday" is a fact
   *  about the order, not about staffing, and the gap between the two is the
   *  thing the office actually manages.
   *  Code: lib/types.ts → Demand, lib/derive.ts → coverageFor, DispatchView */
  demandPlanning: true,

  /** F4 — What actually happened to a shift: planned / confirmed / worked /
   *  no-show / left early / cancelled, plus which shift a replacement covers.
   *  Code: lib/types.ts → ShiftOutcome, DispatchView, VacancyView */
  shiftOutcomes: true,

  /** F5 — Dispatch board: one day across every object and sub-object, with
   *  requested vs covered and the timeline of each slot.
   *  Code: app/dispatch/page.tsx, components/dispatch-view.tsx */
  dispatchBoard: false,   // retired: schedule now lives inside the vacancy

  /** F7 — Schedule pattern on the vacancy: which weekdays, how much of the
   *  clock it keeps (a window, a start only, or no times at all), how many
   *  people and who plans it. One shape covers Ziggo Dome, the warehouse and
   *  the two-hour evening jobs.
   *  Code: lib/types.ts → SchedulePattern, lib/derive.ts → describeSchedule /
   *  plannedSlotsFor / generateDemand, Schedule panel in VacancyView */
  schedulePattern: true,

  /** F8 — Week planner at /planner: the order for a whole week, per place and
   *  per day, with "fill from pattern" for the routine days.
   *  Code: components/week-planner.tsx, app/planner/, Planner nav entry,
   *  the F8 block in app/globals.css */
  weekPlanner: false,   // retired: schedule now lives inside the vacancy

  /** F9 — Real map: Leaflet over OpenStreetMap, markers on actual addresses,
   *  and a radius measured in DRIVING kilometres rather than straight lines.
   *  Distances come from a frozen OSRM matrix, because travel money is paid on
   *  them and a number that drifts rewrites past compensation.
   *  Code: components/map-view.tsx, lib/travel.ts, lib/travel-cache.ts,
   *  app/map/page.tsx, the map block in app/globals.css */
  realMap: true,

  /** F6 — Copy a day's plan onto another date, because demand repeats.
   *  Code: components/dispatch-view.tsx → copy day action */
  copyDay: false,   // retired: schedule now lives inside the vacancy
} as const

export type FeatureName = keyof typeof FEATURES
