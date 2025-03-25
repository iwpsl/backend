import process from 'node:process'
import { faker } from '@faker-js/faker'
import { bcryptHash, prisma } from '../src/utils'

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
  const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']

  for (const email of emails) {
    const user = await prisma.user.create({
      data: {
        email,
        password,
        isVerified: true,
        authType: 'EMAIL',
      },
    })

    await prisma.profile.create({
      data: {
        userId: user.id,
        name: faker.person.fullName(),
        dateOfBirth: faker.date.birthdate(),
        gender: faker.person.sex(),
        heightCm: faker.number.int({ min: 150, max: 180 }),
        weightKg: faker.number.int({ min: 50, max: 100 }),
        bloodType: faker.helpers.arrayElement(bloodTypes),
      },
    })

    let len = faker.number.int({ min: 10, max: 20 })
    for (let i = 0; i < len; ++i) {
      const date = new Date()
      date.setDate(date.getDate() - i)

      await prisma.calorieEntry.create({
        data: {
          userId: user.id,
          date,
          food: faker.food.dish(),
          energyKcal: faker.number.int({ min: 100, max: 1200 }),
          carbohydrateGr: faker.number.int({ min: 10, max: 100 }),
          proteinGr: faker.number.int({ min: 5, max: 50 }),
          fatGr: faker.number.int({ min: 5, max: 60 }),
        },
      })
    }

    len = faker.number.int({ min: 10, max: 20 })
    for (let i = 0; i < len; ++i) {
      const date = new Date()
      date.setDate(date.getDate() - i)

      await prisma.waterEntry.create({
        data: {
          userId: user.id,
          date,
          amountMl: faker.number.int({ min: 500, max: 4000 }),
        },
      })
    }

    len = faker.number.int({ min: 10, max: 20 })
    for (let i = 0; i < len; ++i) {
      const date = new Date()
      date.setDate(date.getDate() - i)

      await prisma.stepEntry.create({
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

      await prisma.fastingEntry.create({
        data: {
          userId: user.id,
          startTime,
          endTime,
          durationH,
        },
      })
    }
  }

  await prisma.user.create({
    data: {
      email: 'admin@example.com',
      password: await bcryptHash('admin'),
      role: 'ADMIN',
      isVerified: true,
    },
  })
}

async function down() {
  await prisma.calorieEntry.deleteMany()
  await prisma.waterEntry.deleteMany()
  await prisma.stepEntry.deleteMany()
  await prisma.fastingEntry.deleteMany()
  await prisma.profile.deleteMany()
  await prisma.user.deleteMany()
}

async function main() {
  if (process.argv.includes('--down')) {
    await down()
  } else {
    await up()
  }
}

main()
