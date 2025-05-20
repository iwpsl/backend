import type { ChallengeTask } from '@prisma/client'
import process from 'node:process'
import { faker } from '@faker-js/faker'
import { ActivityLevel, FastingCategory, Gender, MainGoal, MealType } from '@prisma/client'
import { bcryptHash } from '../src/crypto.js'
import { db } from '../src/db.js'
import { df, getDateOnly } from '../src/utils.js'

async function up() {
  faker.seed(420)

  const emails = [
    'alice@example.com',
    'deirn@bai.lol',
    'office.anggoro@gmail.com',
    'mamanjrebeng22@gmail.com',
    'segootot69@gmail.com',
    'lintangharis18@gmail.com',
  ]

  for (const email of emails) {
    const user = await db.user.create({
      data: {
        email,
        password: await bcryptHash('test'),
        isVerified: true,
        authType: 'email',
      },
    })

    await db.profile.create({
      data: {
        userId: user.id,
        name: faker.person.fullName(),
        gender: faker.helpers.enumValue(Gender),
        mainGoal: faker.helpers.enumValue(MainGoal),
        age: faker.number.int({ min: 17, max: 40 }),
        heightCm: faker.number.int({ min: 150, max: 180 }),
        weightKg: faker.number.int({ min: 50, max: 100 }),
        weightTargetKg: faker.number.int({ min: 50, max: 100 }),
        activityLevel: faker.helpers.enumValue(ActivityLevel),
      },
    })

    const calorieTarget = await db.calorieTarget.create({
      data: {
        userId: user.id,
        energyKcal: faker.number.int({ min: 1600, max: 3500 }),
      },
    })

    let len = faker.number.int({ min: 10, max: 20 })
    for (let i = 0; i < len; ++i) {
      const date = new Date()
      date.setDate(date.getDate() - i)

      const header = await db.calorieHeader.create({
        data: {
          userId: user.id,
          targetId: calorieTarget.id,
          date: getDateOnly(date),
        },
      })

      const portions = [1.0, 1.5, 2.0, 2.5, 3.0]

      await db.calorieEntry.create({
        data: {
          userId: user.id,
          headerId: header.id,
          date,
          food: faker.food.dish(),
          portion: faker.helpers.arrayElement(portions),
          mealType: faker.helpers.enumValue(MealType),
          energyKcal: faker.number.int({ min: 100, max: 1200 }),
          carbohydrateGr: faker.number.int({ min: 10, max: 100 }),
          proteinGr: faker.number.int({ min: 5, max: 50 }),
          fatGr: faker.number.int({ min: 5, max: 60 }),
          sugarGr: faker.number.int({ min: 0, max: 150 }),
          sodiumMg: faker.number.int({ min: 0, max: 6000 }),
        },
      })
    }

    const waterTarget = await db.waterTarget.create({
      data: {
        userId: user.id,
        amountMl: faker.number.int({ min: 1500, max: 5000 }),
      },
    })

    len = faker.number.int({ min: 10, max: 20 })
    for (let i = 0; i < len; ++i) {
      const date = getDateOnly(new Date())
      date.setDate(date.getDate() - i)

      await db.waterEntry.create({
        data: {
          userId: user.id,
          targetId: waterTarget.id,
          date,
          amountMl: faker.number.int({ min: 500, max: 4000 }),
        },
      })
    }

    const stepTarget = await db.stepTarget.create({
      data: {
        userId: user.id,
        steps: faker.number.int({ min: 3000, max: 12000 }),
        distanceKm: faker.number.float({ min: 0, max: 10, fractionDigits: 2 }),
      },
    })

    len = faker.number.int({ min: 10, max: 20 })
    for (let i = 0; i < len; ++i) {
      const date = getDateOnly(new Date())
      date.setDate(date.getDate() - i)

      await db.stepEntry.create({
        data: {
          userId: user.id,
          date,
          targetId: stepTarget.id,
          steps: faker.number.int({ min: 1000, max: 20000 }),
          distanceKm: faker.number.float({ min: 0, max: 10, fractionDigits: 2 }),
          activeMinutes: faker.number.int({ min: 10, max: 180 }),
        },
      })
    }

    len = faker.number.int({ min: 10, max: 20 })
    for (let i = 0; i < len; ++i) {
      const date = new Date()
      date.setDate(date.getDate() - i)

      const endTime = faker.date.between({
        from: new Date(date.setHours(18, 0, 0)),
        to: new Date(date.setHours(22, 0, 0)),
      })

      const category = faker.helpers.enumValue(FastingCategory)
      let durationH = 0
      switch (category) {
        case 'fast16eat08':
          durationH = 16
          break
        case 'fast18eat06':
          durationH = 18
          break
        case 'fast14eat10':
          durationH = 14
          break
        case 'fast12eat12':
          durationH = 12
          break
        case 'fast13eat11':
          durationH = 13
          break
        case 'fast15eat09':
          durationH = 15
          break
        case 'custom':
          durationH = faker.number.int({ min: 12, max: 24 })
          break
      }

      const startTime = df.subHours(endTime, durationH)

      await db.fastingEntry.create({
        data: {
          category,
          userId: user.id,
          startTime,
          endTime,
          finishedAt: df.addHours(startTime, 24),
        },
      })
    }
  }

  for (let i = 0; i < 3; ++i) {
    const challenge = await db.challenge.create({
      data: {
        title: faker.word.words({ count: { min: 2, max: 4 } }),
        description: faker.lorem.paragraph(),
        imageUrl: faker.image.url({ width: 200, height: 200 }),
      },
    })

    const taskPromises: Promise<ChallengeTask>[] = []
    for (let day = 0; day < 7; ++day) {
      for (let j = 0; j < 4; ++j) {
        taskPromises.push(db.challengeTask.create({
          data: {
            day,
            challengeId: challenge.id,
            description: faker.word.words({ count: { min: 3, max: 5 } }),
          },
        }))
      }
    }

    await Promise.all(taskPromises)
  }

  const users = await db.user.findMany()
  const challenges = await db.challenge.findMany({
    include: {
      tasks: {
        orderBy: { day: 'asc' },
      },
    },
  })

  for (const user of users) {
    const userChallenge = faker.helpers.arrayElement(challenges)
    const sub = await db.challengeSubscription.create({
      data: {
        userId: user.id,
        challengeId: userChallenge.id,
        startDate: getDateOnly(new Date()),
      },
    })

    await db.finishedChallengeTask.create({
      data: {
        subId: sub.id,
        taskId: userChallenge.tasks[0].id,
      },
    })
  }

  await db.user.create({
    data: {
      email: 'admin@example.com',
      password: await bcryptHash('admin'),
      role: 'admin',
      authType: 'email',
      isVerified: true,
    },
  })
}

async function down() {
  await db.calorieEntry.deleteMany()
  await db.calorieHeader.deleteMany()
  await db.calorieTarget.deleteMany()
  await db.waterEntry.deleteMany()
  await db.waterTarget.deleteMany()
  await db.stepEntry.deleteMany()
  await db.stepTarget.deleteMany()
  await db.fastingEntry.deleteMany()
  await db.profile.deleteMany()
  await db.user.deleteMany()
}

async function main() {
  if (process.argv.includes('--down')) {
    await down()
  } else {
    await up()
  }
}

main()
