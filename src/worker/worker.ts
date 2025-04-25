import type { JobId, JobInstance } from './job.js'
import { Worker } from 'bullmq'
import { Redis } from 'ioredis'
import { jobHandlers } from './job.js'

const connection = new Redis({ maxRetriesPerRequest: null })

const worker = new Worker<JobInstance<JobId>>(
  'work',
  async j => await jobHandlers[j.data.id](j.data.data as any),
  { connection },
)

worker.on('completed', (job) => {
  console.log(`[ SUCCESS ] Finished running ${job.data.id}`)
})

worker.on('failed', (job, err) => {
  console.error(`[ FAILURE ] Error running ${job?.data.id}: ${err.message}\n\t${err.stack}`)
})

console.log('Worker running.')
