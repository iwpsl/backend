import type { UUID } from '../api.js'
import { db } from '../db.js'

export interface JobDataMapping {
  fastingFinisher: UUID
}

export type JobId = keyof JobDataMapping

export interface JobInstance<Id extends JobId> {
  id: Id
  at: Date
  data: JobDataMapping[Id]
}

type JobHandlers = {
  [Id in JobId]: (instance: JobInstance<Id>) => Promise<void>
}

export const jobHandlers: JobHandlers = {
  async fastingFinisher({ at, data }) {
    await db.fastingEntry.update({
      where: { id: data },
      data: { finishedAt: at },
    })
  },
}
