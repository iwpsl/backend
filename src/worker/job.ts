import type { UUID } from '../api.js'
import { db } from '../db.js'

export interface JobDataMapping {
  fastingFinisher: { id: UUID, finishedAt: Date }
}

export type JobId = keyof JobDataMapping

export interface JobInstance<Id extends JobId> {
  id: Id
  data: JobDataMapping[Id]
}

type JobHandlers = {
  [Id in JobId]: (instance: JobInstance<Id>) => Promise<void>
}

export const jobHandlers: JobHandlers = {
  async fastingFinisher({ data }) {
    await db.fastingEntry.update({
      where: { id: data.id },
      data: { finishedAt: data.finishedAt },
    })
  },
}
