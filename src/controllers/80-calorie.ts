import type { CalorieEntry, MealType } from '@prisma/client'
import type { Api } from '../api.js'
import type { AuthRequest } from '../middleware/auth.js'
import { Body, Controller, Delete, Get, Middlewares, Path, Post, Query, Request, Route, Security, Tags } from 'tsoa'
import { err, ok } from '../api.js'
import { cleanUpdateAttrs, db } from '../db.js'
import { roleMiddleware } from '../middleware/role.js'
import { verifiedMiddleware } from '../middleware/verified.js'

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

interface CalorieJournalData {
  id?: number
  date: Date
  food: string
  mealType: MealType
  energyKcal: number
  proteinGr: number
  carbohydrateGr: number
  fatGr: number
  sugarGr: number
  sodiumMg: number
}

interface DailyCalorieJournalData {
  total: {
    energyKcal: number
    proteinGr: number
    carbohydrateGr: number
    fatGr: number
    sugarGr: number
    sodiumMg: number
  }
  entries: CalorieJournalData[]
}

interface CalorieJournalResultData extends CalorieJournalData {
  id: number
}

function clean(res: CalorieEntry) {
  const { userId, ...rest } = cleanUpdateAttrs(res)
  return rest
}

@Route('calorie')
@Tags('Calorie')
@Security('auth')
@Middlewares(roleMiddleware('USER'), verifiedMiddleware)
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
      await db.calorieEntry.create({
        data: {
          userId,
          ...data,
        },
      })
    }

    return ok()
  }

  @Delete('/journal/id/{id}')
  public async deleteCalorieJournal(
    @Request() req: AuthRequest,
    @Path() id: number,
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
    @Query() after?: number,
  ): Api<CalorieJournalResultData[]> {
    const userId = req.user!.id

    const res = after
      ? await db.calorieEntry.findMany({
        take: 10,
        skip: 1,
        cursor: { id: after },
        where: { userId },
      })
      : await db.calorieEntry.findMany({
        take: 10,
        where: { userId },
      })

    return ok(res.map(clean))
  }

  /** Get detail of a journal entry. */
  @Get('/journal/id/{id}')
  public async getCalorieJournalById(
    @Request() req: AuthRequest,
    @Path() id: number,
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
    const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)

    const res = await db.calorieEntry.findMany({
      where: {
        userId,
        date: {
          gte: startOfDay,
          lt: endOfDay,
        },
      },
    })

    return ok({
      total: {
        energyKcal: res.reduce((acc, curr) => acc + curr.energyKcal, 0),
        carbohydrateGr: res.reduce((acc, curr) => acc + curr.carbohydrateGr, 0),
        proteinGr: res.reduce((acc, curr) => acc + curr.proteinGr, 0),
        fatGr: res.reduce((acc, curr) => acc + curr.fatGr, 0),
        sugarGr: res.reduce((acc, curr) => acc + curr.sugarGr, 0),
        sodiumMg: res.reduce((acc, curr) => acc + curr.sodiumMg, 0),
      },
      entries: res.map(clean),
    })
  }
}
