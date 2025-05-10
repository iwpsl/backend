import type { Prisma } from '@prisma/client'
import { PrismaClient } from '@prisma/client'

const softDeleteModels: Prisma.ModelName[] = [
  'CalorieHeader',
  'CalorieEntry',
  'FastingEntry',
  'StepEntry',
  'WaterEntry',
]

export const db = new PrismaClient().$extends({
  query: {
    $allModels: {
      async findUnique({ args, model, query }) {
        if (softDeleteModels.includes(model)) {
          args.where = { ...args.where, deletedAt: null }
        }
        return query(args)
      },

      async findMany({ args, model, query }) {
        if (softDeleteModels.includes(model)) {
          args.where = { ...args.where, deletedAt: null }
        }
        return query(args)
      },
    },
  },
})

interface CanUpdate {
  createdAt: Date
  updatedAt: Date
  deletedAt?: Date | null
}

export function cleanUpdateAttrs<T extends CanUpdate>(data: T) {
  const { createdAt, updatedAt, deletedAt, ...rest } = data
  return rest
}
