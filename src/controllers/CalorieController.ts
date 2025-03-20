import type { Api } from '../api'
import { Controller, Get, Middlewares, Path, Route, Security, Tags } from 'tsoa'
import { err, ok } from '../api'
import { roleMiddleware } from '../middleware/role'

const apiUrl = 'https://world.openfoodfacts.org/api/v2'

interface OffBase {
  status: 0 | 1
}

interface OffProductData extends OffBase {
  product: {
    product_name: string
    nutriments: {
      'energy-kcal': number
    }
  }
}

interface CalorieData {
  productName: string
  calorie: number
}

// interface SearchData {

// }

@Route('calorie')
@Tags('Calorie')
@Security('auth')
@Middlewares(roleMiddleware('USER'))
export class CalorieController extends Controller {
  /** Get calorie data from product barcode. */
  @Get('/product/{barcode}')
  public async product(@Path() barcode: string): Api<CalorieData> {
    const res = await fetch(`${apiUrl}/product/${barcode}`)
    const data = await res.json() as OffProductData

    if (data.status === 0)
      return err(500, 'Internal server error')

    return ok({
      productName: data.product.product_name,
      calorie: data.product.nutriments['energy-kcal'],
    })
  }

  // /** Search for product */
  // @Get('/search')
  // public async search(@Query() q: string): Api<SearchData> {

  // }
}
