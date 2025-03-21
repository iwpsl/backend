import type { Api } from '../api'
import { Controller, Get, Middlewares, Path, Query, Route, Security, Tags } from 'tsoa'
import { err, ok } from '../api'
import { roleMiddleware } from '../middleware/role'

const apiUrl = 'https://world.openfoodfacts.org/api/v2'

interface OffBase {
  status: 0 | 1
}

interface OffProduct {
  code: string
  product_name: string
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
}

interface SearchData {
  page: number
  products: ProductData[]
}

@Route('calorie')
@Tags('Calorie')
@Security('auth')
@Middlewares(roleMiddleware('USER'))
export class CalorieController extends Controller {
  /** Get calorie data from product barcode. */
  @Get('/product/code/{code}')
  public async productByCode(@Path() code: string): Api<ProductData> {
    const res = await fetch(`${apiUrl}/product/${code}`)
    const data = await res.json() as OffProductData

    if (data.status === 0)
      return err(500, 'Internal server error')

    return ok({
      code: data.product.code,
      productName: data.product.product_name,
      calorie: data.product.nutriments['energy-kcal'],
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
      })).filter(it => it.calorie),
    })
  }
}
