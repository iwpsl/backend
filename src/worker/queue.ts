import type { JobDataMapping, JobId, JobInstance } from './job.js'
import { Queue } from 'bullmq'
import { workerName } from './job.js'

export const workQueue = new Queue<JobInstance<JobId>>(workerName)

type DataArgs<Id extends JobId> = JobDataMapping[Id] extends void ? [] : [data: JobDataMapping[Id]]

export async function enqueueWork<Id extends JobId>(at: Date, id: Id, ...data: DataArgs<Id>) {
  const delay = at.getTime() - new Date().getTime()
  await workQueue.add(id, { id, data: data[0] }, { delay })
}

export async function scheduleWork<Id extends JobId>(pattern: string, id: Id, ...data: DataArgs<Id>) {
  await workQueue.upsertJobScheduler(id, { pattern }, { data: { id, data: data[0] } })
}
