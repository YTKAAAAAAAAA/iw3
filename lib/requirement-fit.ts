import type { Requirement, Worker } from './types.ts'

export type RequirementAssessment = {
  blocked: string[]
  warnings: string[]
}

export function assessRequirements(requirements: Requirement[], worker: Worker): RequirementAssessment {
  const blocked: string[] = []
  const warnings: string[] = []

  for (const requirement of requirements) {
    const label = requirement.label.trim()
    if (!label) continue

    const normalized = label.toLowerCase()
    const evidence = requirement.kind === 'transport' && /car|vehicle|auto/.test(normalized)
      ? worker.hasCar
      : requirement.kind === 'document' && /vog/.test(normalized)
        ? worker.hasVog
        : null

    if (evidence === false && requirement.required) blocked.push(`${label} is required`)
    else if (evidence === false) warnings.push(`${label} preferred`)
    else if (evidence === null) warnings.push(`Verify ${label}`)
  }

  return { blocked, warnings }
}
