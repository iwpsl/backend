import process from 'node:process'
import { faker } from '@faker-js/faker'
import { FastingCategory, Gender, MealType } from '@prisma/client'
import { db } from '../src/db.js'
import { bcryptHash, getDateOnly } from '../src/utils.js'

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

  const password = await bcryptHash('test')

  for (const email of emails) {
    const user = await db.user.create({
      data: {
        email,
        password,
        isVerified: true,
        authType: 'email',
      },
    })

    await db.profile.create({
      data: {
        userId: user.id,
        name: faker.person.fullName(),
        dateOfBirth: faker.date.birthdate(),
        gender: faker.helpers.enumValue(Gender),
        heightCm: faker.number.int({ min: 150, max: 180 }),
        weightKg: faker.number.int({ min: 50, max: 100 }),
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

    len = faker.number.int({ min: 10, max: 20 })
    for (let i = 0; i < len; ++i) {
      const date = new Date()
      date.setDate(date.getDate() - i)

      await db.stepEntry.create({
        data: {
          userId: user.id,
          date,
          steps: faker.number.int({ min: 1000, max: 20000 }),
        },
      })
    }

    len = faker.number.int({ min: 10, max: 20 })
    for (let i = 0; i < len; ++i) {
      const date = new Date()
      date.setDate(date.getDate() - i)

      const startTime = faker.date.between({
        from: new Date(date.setHours(18, 0, 0)),
        to: new Date(date.setHours(22, 0, 0)),
      })

      const durationH = faker.number.int({ min: 12, max: 24 })
      const endTime = new Date(startTime)
      endTime.setHours(endTime.getHours() + durationH)

      await db.fastingEntry.create({
        data: {
          category: faker.helpers.enumValue(FastingCategory),
          userId: user.id,
          startTime,
          endTime,
        },
      })
    }
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
  await db.waterEntry.deleteMany()
  await db.stepEntry.deleteMany()
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
