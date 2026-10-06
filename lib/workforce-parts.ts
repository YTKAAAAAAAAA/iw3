/** The optional parts of a page's data. Kept out of the 'use client' context
 *  module: on the server an import from there is only a client reference, not
 *  this array, and `/api/workforce?include=…` failed with "includes is not a
 *  function" — every page, once the frontend runs apart from the backend. */
export const WORKFORCE_PARTS = ['schedule', 'leaves', 'hours', 'travel'] as const
export type WorkforcePart = (typeof WORKFORCE_PARTS)[number]
