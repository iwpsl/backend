import type { JobId, JobInstance } from './job.js'
import { Worker } from 'bullmq'
import { Redis } from 'ioredis'
import { jobHandlers } from './job.js'

const connection = new Redis({ maxRetriesPerRequest: null })

// eslint-disable-next-line unused-imports/no-unused-vars
const worker = new Worker<JobInstance<JobId>>(
  'worker',
  async j => await jobHandlers[j.data.id](j.data),
  { connection },
)
