import type { JobDataMapping, JobId, JobInstance } from './job.js'
import { Worker } from 'bullmq'
import { Redis } from 'ioredis'
import { db } from '../db.js'
import { df } from '../utils.js'

type JobHandlers = {
  [Id in JobId]: (data: JobDataMapping[Id]) => Promise<void>
}

const jobHandlers: JobHandlers = {
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

  async cleanupCalorieTarget() {
    await db.calorieTarget.deleteMany({
      where: { headers: { none: {} } },
    })
  },

  async cleanupCalorieHeader() {
    await db.calorieHeader.deleteMany({
      where: { entries: { none: {} } },
    })
  },

  async cleanupWaterTarget() {
    await db.waterTarget.deleteMany({
      where: { entries: { none: {} } },
    })
  },
}

const connection = new Redis({ maxRetriesPerRequest: null })
const worker = new Worker<JobInstance<JobId>>(
  'work',
  async (job) => {
    console.log(`[  INFO!  ] Running ${job.data.id}`)
    await jobHandlers[job.data.id](job.data.data as never /* gonna give you up */)
  },
  {
    connection,
    concurrency: 5,
  },
)

worker.on('completed', (job) => {
  console.log(`[ SUCCESS ] Finished running ${job.data.id}`)
})

worker.on('failed', (job, err) => {
  console.error(`[ FAILURE ] Error running ${job?.data.id}: ${err.message}\n\t${err.stack}`)
})

console.log('Worker running.')
