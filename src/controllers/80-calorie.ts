import type { CalorieEntry, MealType } from '@prisma/client'
import type { Api, UUID } from '../api.js'
import type { AuthRequest } from '../middleware/auth.js'
import { Body, Controller, Delete, Get, Middlewares, Path, Post, Query, Request, Route, Security, Tags } from 'tsoa'
import { err, ok } from '../api.js'
import { cleanUpdateAttrs, db } from '../db.js'
import { roleMiddleware } from '../middleware/role.js'
import { verifiedMiddleware } from '../middleware/verified.js'
import { getDateOnly } from '../utils.js'

const apiUrl = 'https://world.openfoodfacts.org/api/v2'

interface OffBase {
  status: 0 | 1
}

interface OffProduct {
  code: string
  product_name: string
  image_url: string
  nutriments: {
    'energy-kcal': number
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
  productName: string
  calorie: number
  imgUrl: string
}

interface SearchData {
  page: number
  products: ProductData[]
}

interface CalorieData {
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

interface CalorieJournalResultData extends CalorieJournalData {
  id: UUID
}

function clean(res: CalorieEntry) {
  const { headerId, ...rest } = cleanUpdateAttrs(res)
  return rest
}

async function getOrCreateHeader(userId: UUID, date: Date, includeExtra: boolean) {
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

  if (!res) {
    const latestTarget = await db.calorieTarget.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })

    if (!latestTarget) {
      return undefined
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

    if (data.status === 0)
      return err(500, 'internal-server-error')

    return ok({
      code: data.product.code,
      productName: data.product.product_name,
      calorie: data.product.nutriments['energy-kcal'],
      imgUrl: data.product.image_url,
    })
  }

  /** Search for product. */
  @Get('/product/search')
  public async searchProduct(@Query() q: string): Api<SearchData> {
    const url = getSearchUrl(q)
    console.log(url)

    const res = await fetch(url)
    const data = await res.json() as OffSearchData

    return ok({
      page: data.page,
      products: data.products.map(it => ({
        code: it.code,
        productName: it.product_name,
        calorie: it.nutriments['energy-kcal'],
        imgUrl: it.image_url,
      })).filter(it => it.calorie),
    })
  }

  /** Create or update a journal entry. */
  @Post('/journal')
  public async postCalorieJournal(
    @Request() req: AuthRequest,
    @Body() body: CalorieJournalData,
  ): Api {
    const userId = req.user!.id
    const { id, ...data } = body

    if (body.id) {
      await db.calorieEntry.update({
        where: { id, userId, deletedAt: null },
        data,
      })
    } else {
      const header = await getOrCreateHeader(userId, getDateOnly(data.date), false)

      if (!header)
        throw new Error('No target')

      await db.calorieEntry.create({
        data: {
          userId,
          headerId: header.id,
          ...data,
        },
      })
    }

    return ok()
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

    if (!res)
      return err(404, 'not-found')

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

    const res = await getOrCreateHeader(userId, dateOnly, true)

    if (!res) {
      return ok({
        total: { carbohydrateGr: 0, energyKcal: 0, fatGr: 0, proteinGr: 0, sodiumMg: 0, sugarGr: 0 },
        target: { energyKcal: 0 },
        entries: [],
      })
    }

    return ok({
      total: {
        energyKcal: res.entries.reduce((acc, curr) => acc + (curr.energyKcal * curr.portion), 0),
        carbohydrateGr: res.entries.reduce((acc, curr) => acc + (curr.carbohydrateGr * curr.portion), 0),
        proteinGr: res.entries.reduce((acc, curr) => acc + (curr.proteinGr * curr.portion), 0),
        fatGr: res.entries.reduce((acc, curr) => acc + (curr.fatGr * curr.portion), 0),
        sugarGr: res.entries.reduce((acc, curr) => acc + (curr.sugarGr * curr.portion), 0),
        sodiumMg: res.entries.reduce((acc, curr) => acc + (curr.sodiumMg * curr.portion), 0),
      },
      target: res.target,
      entries: res.entries,
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

    await db.calorieTarget.create({
      data: {
        userId,
        ...body,
      },
    })

    return ok()
  }
}
