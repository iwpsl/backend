import type { UUID } from '../api.js'
import { db } from '../db.js'
import { df } from '../utils.js'

export interface JobDataMapping {
  fastingFinisher: { id: UUID, finishedAt: Date }
  log: string
}

export type JobId = keyof JobDataMapping

export interface JobInstance<Id extends JobId> {
  id: Id
  data: JobDataMapping[Id]
}

type JobHandlers = {
  [Id in JobId]: (data: JobDataMapping[Id]) => Promise<void>
}

export const jobHandlers: JobHandlers = {
  async fastingFinisher({ id, finishedAt }) {
    await db.fastingEntry.update({
      where: { id },
      data: { finishedAt },
    })
  },

  async log(msg) {
    const date = df.format(new Date(), 'yyyy-MM-dd HH:mm:ss:SSSS')
    console.log(`${date} ${msg}`)
  },
}
