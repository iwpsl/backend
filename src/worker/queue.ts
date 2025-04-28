import type { JobDataMapping, JobId, JobInstance } from './job.js'
import { Queue } from 'bullmq'

const queue = new Queue<JobInstance<JobId>>('work')

export async function enqueueWork<Id extends JobId>(at: Date, id: Id, data: JobDataMapping[Id]) {
  const delay = at.getTime() - new Date().getTime()
  await queue.add(id, { id, data }, { delay })
}

export async function scheduleWork<Id extends JobId>(every: number, id: Id) {
  await queue.upsertJobScheduler(id, { every })
}
