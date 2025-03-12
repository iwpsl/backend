import { Prisma } from '@prisma/client'
import { bcryptHash, prisma } from '../src/utils'

async function createUser(user: Prisma.UserCreateInput, profile?: Omit<Prisma.ProfileCreateInput, 'userId' | 'user'>) {
  user.password = await bcryptHash(user.password)
  const res = await prisma.user.create({ data: user })
  if (profile) {
    await prisma.profile.create({
      data: {
        userId: res.id,
        ...profile
      }
    })
  }
}

async function up() {
  await createUser(
    {
      email: 'alice@example.com',
      password: 'test'
    },
    {
      name: 'Alice Smith',
      dateOfBirth: new Date('1999-01-23'),
      bloodType: 'O+',
      gender: 'female',
      heightCm: 165,
      weightKg: 60,
    }
  )

  await createUser(
    {
      email: 'deirn@bai.lol',
      password: 'test'
    },
    {
      name: 'Homer Simpson',
      dateOfBirth: new Date('1999-01-23'),
      bloodType: 'AB-',
      gender: 'male',
      heightCm: 180,
      weightKg: 100,
    }
  )

  await createUser(
    {
      email: 'office.anggoro@gmail.com',
      password: 'test'
    },
    {
      name: 'Loli Anggoro',
      dateOfBirth: new Date('1999-01-23'),
      bloodType: 'AB-',
      gender: 'male',
      heightCm: 180,
      weightKg: 100,
    }
  )

  await createUser(
    {
      email: 'mamanjrebeng22@gmail.com',
      password: 'test'
    },
    {
      name: 'Maman UwU',
      dateOfBirth: new Date('1999-01-23'),
      bloodType: 'AB-',
      gender: 'male',
      heightCm: 180,
      weightKg: 100,
    }
  )

  await createUser(
    {
      email: 'segootot69@gmail.com',
      password: 'test'
    },
    {
      name: 'Sego Otot',
      dateOfBirth: new Date('1999-01-23'),
      bloodType: 'AB-',
      gender: 'male',
      heightCm: 180,
      weightKg: 100,
    }
  )

  await createUser(
    {
      email: 'admin@example.com',
      password: 'admin',
      role: 'ADMIN'
    }
  )
}

async function down() {
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
