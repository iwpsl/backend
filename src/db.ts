import type { FastingCategory as DbFastingCategory, Gender as DbGender, Role as DbRole, Prisma } from '@prisma/client'
import { PrismaClient } from '@prisma/client'

/** @tsoaModel */
export type Gender = DbGender

/** @tsoaModel */
export type Role = DbRole

/** @tsoaModel */
export type FastingCategory = DbFastingCategory

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
