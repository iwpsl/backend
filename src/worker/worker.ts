import type { JobDataMapping, JobId, JobInstance } from './job.js'
import { Worker } from 'bullmq'
import { Redis } from 'ioredis'
import { db } from '../db.js'
import { df, getDateOnly } from '../utils.js'
import { workerName } from './job.js'

type JobHandlers = {
  [Id in JobId]: (data: JobDataMapping[Id]) => Promise<void>
}

const jobHandlers: JobHandlers = {
  async fastingFinisher({ id, finishedAt }) {
    await db.fastingEntry.updateMany({
      where: { id, finishedAt: null },
      data: { finishedAt },
    })
  },

  async challengeFinisher({ id }) {
    await db.challengeSubscription.updateMany({
      where: { id, finishedAt: null },
      data: { finishedAt: getDateOnly(new Date()) },
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

  async cleanupStepTarget() {
    await db.stepTarget.deleteMany({
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
  workerName,
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
