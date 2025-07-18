import type { CalorieEntry, MealType } from '@prisma/client'
import type { Api, UUID } from '../api.js'
import type { AuthRequest } from '../middleware/auth.js'
import { Body, Controller, Delete, Get, Middlewares, Path, Post, Query, Request, Route, Security, Tags } from 'tsoa'
import { err, ok } from '../api.js'
import { cleanUpdateAttrs, db } from '../db.js'
import { roleMiddleware } from '../middleware/role.js'
import { verifiedMiddleware } from '../middleware/verified.js'
import { df, getDateOnly, nullArray, reduceAvg, reduceSum } from '../utils.js'

const apiUrl = 'https://world.openfoodfacts.org/api/v2'

interface OffBase {
  status: 0 | 1
}

interface OffProduct {
  code: string
  product_name?: string
  image_url?: string
  nutriments?: {
    'energy-kcal'?: number
    'proteins'?: number
    'carbohydrates'?: number
    'fat'?: number
    'sugars'?: number
    'sodium'?: number
  }
}

interface OffProductData extends OffBase {
  product: OffProduct
}

interface OffSearchData {
  page: number
  products: OffProduct[]
}

function getSearchUrl(terms: string) {
  return `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(terms)}&search_simple=1&action=process&json=1&page_size=10`
}

///

interface ProductData {
  code: string
  productName: string | null
  imgUrl: string | null
  energyKcal: number | null
  proteinGr: number | null
  carbohydrateGr: number | null
  fatGr: number | null
  sugarGr: number | null
  sodiumMg: number | null
}

interface SearchData {
  page: number
  products: ProductData[]
}

export interface CalorieData {
  energyKcal: number
  proteinGr: number
  carbohydrateGr: number
  fatGr: number
  sugarGr: number
  sodiumMg: number
}

interface CalorieTargetData {
  energyKcal: number
}

interface CalorieJournalData extends CalorieData {
  id?: UUID
  date: Date
  food: string
  portion: number
  mealType: MealType
}

interface DailyCalorieJournalData {
  total: CalorieData
  target: CalorieTargetData
  entries: CalorieJournalData[]
}

export interface CalorieDataWithPercentage extends CalorieData {
  proteinPercentage: number
  carbohydratePercentage: number
  fatPercentage: number
}

interface WeeklyCalorieJournalData {
  average: CalorieDataWithPercentage
  entries: (CalorieData | null)[]
}

interface CalorieJournalResultData extends CalorieJournalData {
  id: UUID
}

function clean(res: CalorieEntry) {
  const { headerId, ...rest } = cleanUpdateAttrs(res)
  return rest
}

async function getHeader(userId: UUID, date: Date, createIfMissing: boolean, includeExtra: boolean) {
  let res = await db.calorieHeader.findUnique({
    where: {
      userId_date: {
        userId,
        date,
      },
    },
    include: {
      entries: includeExtra
        ? { where: { deletedAt: null } }
        : false,
      target: includeExtra,
    },
  })

  if (!res && createIfMissing) {
    const latestTarget = await db.calorieTarget.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })

    if (!latestTarget) {
      return null
    }

    res = await db.calorieHeader.create({
      data: {
        userId,
        date,
        targetId: latestTarget.id,
      },
      include: {
        entries: includeExtra,
        target: includeExtra,
      },
    })
  }

  return res
}

export function sumCalorie(entries: CalorieEntry[]): CalorieData {
  return {
    energyKcal: reduceSum(entries, it => it.energyKcal * it.portion),
    carbohydrateGr: reduceSum(entries, it => it.carbohydrateGr * it.portion),
    proteinGr: reduceSum(entries, it => it.proteinGr * it.portion),
    fatGr: reduceSum(entries, it => it.fatGr * it.portion),
    sugarGr: reduceSum(entries, it => it.sugarGr * it.portion),
    sodiumMg: reduceSum(entries, it => it.sodiumMg * it.portion),
  }
}

export function avgCalorie(entries: CalorieData[]): CalorieDataWithPercentage {
  const average: CalorieData = {
    energyKcal: reduceAvg(entries, it => it.energyKcal),
    carbohydrateGr: reduceAvg(entries, it => it.carbohydrateGr),
    proteinGr: reduceAvg(entries, it => it.proteinGr),
    fatGr: reduceAvg(entries, it => it.fatGr),
    sugarGr: reduceAvg(entries, it => it.sugarGr),
    sodiumMg: reduceAvg(entries, it => it.sodiumMg),
  }

  return {
    ...average,
    carbohydratePercentage: average.carbohydrateGr * 4 / average.energyKcal * 100,
    proteinPercentage: average.proteinGr * 4 / average.energyKcal * 100,
    fatPercentage: average.fatGr * 9 / average.energyKcal * 100,
  }
}

@Route('calorie')
@Tags('Calorie')
@Security('auth')
@Middlewares(roleMiddleware('user'), verifiedMiddleware)
export class CalorieController extends Controller {
  /** Get calorie data from product barcode. */
  @Get('/product/code/{code}')
  public async getProductByCode(@Path() code: string): Api<ProductData> {
    const res = await fetch(`${apiUrl}/product/${code}`)
    const data = await res.json() as OffProductData

    if (data.status === 0) {
      return err(500, 'internal-server-error')
    }

    return ok({
      code: data.product.code,
      productName: data.product.product_name ?? null,
      imgUrl: data.product.image_url ?? null,
      energyKcal: data.product.nutriments?.['energy-kcal'] ?? null,
      proteinGr: data.product.nutriments?.proteins ?? null,
      carbohydrateGr: data.product.nutriments?.carbohydrates ?? null,
      fatGr: data.product.nutriments?.fat ?? null,
      sodiumMg: data.product.nutriments?.sodium ?? null,
      sugarGr: data.product.nutriments?.sugars ?? null,
    })
  }

  /** Search for product. */
  @Get('/product/search')
  public async searchProduct(@Query() q: string): Api<SearchData> {
    const url = getSearchUrl(q)

    const res = await fetch(url)
    const data = await res.json() as OffSearchData

    return ok({
      page: data.page,
      products: data.products.map(it => ({
        code: it.code,
        productName: it.product_name ?? null,
        imgUrl: it.image_url ?? null,
        energyKcal: it.nutriments?.['energy-kcal'] ?? null,
        proteinGr: it.nutriments?.proteins ?? null,
        carbohydrateGr: it.nutriments?.carbohydrates ?? null,
        fatGr: it.nutriments?.fat ?? null,
        sodiumMg: it.nutriments?.sodium ?? null,
        sugarGr: it.nutriments?.sugars ?? null,
      })).filter(it => it.energyKcal),
    })
  }

  /** Create or update a journal entry. */
  @Post('/journal')
  public async postCalorieJournal(
    @Request() req: AuthRequest,
    @Body() body: CalorieJournalData,
  ): Api<CalorieJournalResultData> {
    const userId = req.user!.id
    const { id, ...data } = body

    let res: CalorieJournalResultData
    if (body.id) {
      res = await db.calorieEntry.update({
        where: { id, userId, deletedAt: null },
        data,
      })
    } else {
      const header = await getHeader(userId, getDateOnly(data.date), true, false)

      if (!header) {
        throw new Error('No target')
      }

      res = await db.calorieEntry.create({
        data: {
          userId,
          headerId: header.id,
          ...data,
        },
      })
    }

    return ok(res)
  }

  /** Delete a journal entry. */
  @Delete('/journal/id/{id}')
  public async deleteCalorieJournal(
    @Request() req: AuthRequest,
    @Path() id: UUID,
  ): Api {
    const userId = req.user!.id

    await db.calorieEntry.update({
      where: { id, userId, deletedAt: null },
      data: { deletedAt: new Date() },
    })

    return ok()
  }

  /** Get a list of journal entries. */
  @Get('/journal')
  public async getCalorieJournals(
    @Request() req: AuthRequest,
    @Query() after?: UUID,
  ): Api<CalorieJournalResultData[]> {
    const userId = req.user!.id

    const res = after
      ? await db.calorieEntry.findMany({
        take: 10,
        skip: 1,
        cursor: { id: after },
        where: { userId },
        orderBy: { createdAt: 'asc' },
      })
      : await db.calorieEntry.findMany({
        take: 10,
        where: { userId },
        orderBy: { createdAt: 'asc' },
      })

    return ok(res.map(clean))
  }

  /** Get detail of a journal entry. */
  @Get('/journal/id/{id}')
  public async getCalorieJournalById(
    @Request() req: AuthRequest,
    @Path() id: UUID,
  ): Api<CalorieJournalResultData> {
    const res = await db.calorieEntry.findUnique({
      where: {
        id,
        userId: req.user!.id,
      },
    })

    if (!res) {
      return err(404, 'not-found')
    }

    return ok(clean(res))
  }

  /** Get a list of entries by date. */
  @Get('/journal/date/{date}')
  public async getCalorieJournalsByDate(
    @Request() req: AuthRequest,
    @Path() date: Date,
  ): Api<DailyCalorieJournalData> {
    const userId = req.user!.id
    const dateOnly = getDateOnly(date)

    const res = await getHeader(userId, dateOnly, true, true)

    if (!res) {
      return ok({
        total: sumCalorie([]),
        target: { energyKcal: 0 },
        entries: [],
      })
    }

    return ok({
      total: sumCalorie(res.entries),
      target: res.target,
      entries: res.entries,
    })
  }

  /** Get weekly data. */
  @Get('/journal/weekly/{startDate}')
  public async getWeeklyCalorieJournal(
    @Request() req: AuthRequest,
    @Path() startDate: Date,
  ): Api<WeeklyCalorieJournalData> {
    const userId = req.user!.id
    const startDateOnly = getDateOnly(startDate)

    const allDateOnly = Array.from({ length: 7 }, (_v, i) => df.addDays(startDateOnly, i))
    const res = await Promise.all(allDateOnly.map(it => getHeader(userId, it, false, true)))

    const headers = nullArray<(typeof res)[0]>(7)
    for (const item of res) {
      if (!item || item.entries.length === 0) {
        continue
      }
      const index = df.differenceInDays(item.date, startDateOnly)
      if (index >= 0 && index < 7) {
        headers[index] = item
      }
    }

    const entries: (CalorieData | null)[] = headers.map(it => it
      ? sumCalorie(it.entries)
      : null)

    const nonNullableEntries = entries.filter(it => it) as CalorieData[]
    return ok({
      entries,
      average: avgCalorie(nonNullableEntries),
    })
  }

  /** Get latest target. */
  @Get('/target/latest')
  public async getLatestCalorieTarget(
    @Request() req: AuthRequest,
  ): Api<CalorieTargetData> {
    const userId = req.user!.id

    const res = await db.calorieTarget.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })

    if (!res) {
      return err(404, 'not-found')
    }

    return ok(res)
  }

  /** Insert a new target. */
  @Post('/target')
  public async createCalorieTarget(
    @Request() req: AuthRequest,
    @Body() body: CalorieTargetData,
  ): Api {
    const userId = req.user!.id

    const target = await db.calorieTarget.create({
      data: {
        userId,
        ...body,
      },
    })

    const todayHeader = await getHeader(userId, getDateOnly(new Date()), false, false)

    if (todayHeader) {
      await db.calorieHeader.update({
        where: { id: todayHeader.id },
        data: { targetId: target.id },
      })
    }

    return ok()
  }
}
