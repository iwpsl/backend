import type { Api } from '../api'
import type { AuthRequest } from '../middleware/auth'
import { Body, Controller, Get, Middlewares, Path, Post, Query, Request, Route, Security, Tags } from 'tsoa'
import { err, ok } from '../api'
import { roleMiddleware } from '../middleware/role'
import { verifiedMiddleware } from '../middleware/verified'
import { prisma } from '../utils'

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
  energyKcal: number
  proteinGr: number
  carbohydrateGr: number
  fatGr: number
}

interface CalorieJournalResultData extends CalorieJournalData {
  id: number
}

@Route('calorie')
@Tags('Calorie')
@Security('auth')
@Middlewares(roleMiddleware('USER'), verifiedMiddleware)
export class CalorieController extends Controller {
  /** Get calorie data from product barcode. */
  @Get('/product/code/{code}')
  public async productByCode(@Path() code: string): Api<ProductData> {
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
  public async productSearch(@Query() q: string): Api<SearchData> {
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
  public async journalAdd(
    @Request() req: AuthRequest,
    @Body() body: CalorieJournalData,
  ): Api {
    const userId = req.user!.id
    const { id, ...data } = body

    if (body.id) {
      await prisma.calorieEntry.update({
        where: { id },
        data: {
          userId,
          ...data,
        },
      })
    } else {
      await prisma.calorieEntry.create({
        data: {
          userId,
          ...data,
        },
      })
    }

    return ok()
  }

  /** Get a list of journal entries. */
  @Get('/journal')
  public async journalGetMany(
    @Request() req: AuthRequest,
    @Query() after?: number,
  ): Api<CalorieJournalResultData[]> {
    const userId = req.user!.id

    const res = after
      ? await prisma.calorieEntry.findMany({
        take: 10,
        skip: 1,
        cursor: { id: after },
        where: { userId },
      })
      : await prisma.calorieEntry.findMany({
        take: 10,
        where: { userId },
      })

    return ok(res.map((it) => {
      const { userId, ...rest } = it
      return rest
    }))
  }

  /** Get detail of a journal entry. */
  @Get('/journal/{id}')
  public async journalById(
    @Request() req: AuthRequest,
    @Path() id: number,
  ): Api<CalorieJournalResultData> {
    const res = await prisma.calorieEntry.findUnique({
      where: {
        id,
        userId: req.user!.id,
      },
    })

    if (!res)
      return err(404, 'not-found')

    return ok(res)
  }
}
