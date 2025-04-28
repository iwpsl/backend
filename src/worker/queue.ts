import type { JobDataMapping, JobId, JobInstance } from './job.js'
import { Queue } from 'bullmq'

export const workQueue = new Queue<JobInstance<JobId>>('work')

export async function enqueueWork<Id extends JobId>(at: Date, id: Id, data: JobDataMapping[Id]) {
  const delay = at.getTime() - new Date().getTime()
  await workQueue.add(id, { id, data }, { delay })
}

export async function scheduleWork<Id extends JobId>(pattern: string, id: Id) {
  await workQueue.upsertJobScheduler(id, { pattern })
}
