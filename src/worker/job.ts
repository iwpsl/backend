import type { UUID } from '../api.js'

export const workerName = 'worker'

export interface JobDataMapping {
  fastingFinisher: { id: UUID, finishedAt: Date }
  log: string

  // Cron
  cleanupCalorieTarget: void
  cleanupCalorieHeader: void
  cleanupStepTarget: void
  cleanupWaterTarget: void
}

export type JobId = keyof JobDataMapping

export interface JobInstance<Id extends JobId> {
  id: Id
  data: JobDataMapping[Id]
}
