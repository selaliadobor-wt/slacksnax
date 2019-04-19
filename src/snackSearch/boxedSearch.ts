import * as rp from "request-promise";
import { logger } from "../server";
import SnackSearchEngine from "./searchEngine";
import { Snack } from "./snack";

const boxedApiUrl = "https://www.boxed.com/api/search/";
const apiUserAgent =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/71.0.3578.98 Safari/537.36";

class BoxedSearch extends SnackSearchEngine {
    public engineName: string = "boxed";

    public async uncachedSearch(queryText: string): Promise<Snack[]> {
        const searchUrl = boxedApiUrl + encodeURIComponent(queryText.trim());

        logger.info(`Searching Boxed for ${queryText} at ${searchUrl}`);

        const response = await rp.get(searchUrl, {
            headers: { "User-Agent": apiUserAgent },
            json: true,
        });

        const products: any[] = response.data.productListEntities;

        if (!products) {
            logger.debug(`Searching Boxed for ${queryText} at ${searchUrl} failed, invalid response`, response);
            return [];
        }

        logger.debug(`Searching Boxed for ${queryText} at ${searchUrl} returned ${products.length} products`);

        return products.map(
            (product: any): Snack => {
                return {
                    name: product.name,
                    brand: product.variantObject.product.brand,
                    description:
                        product.variantObject.product.longDescription || product.variantObject.product.shortDescription,
                    tags: product.variantObject.product.keywords,
                    imageUrl: product.images[0].originalBase,
                    upc: product.variantObject.upc,
                    productUrls: new Map([["boxedId", product.variantObject.gid]]),
                };
            }
        );
    }
}

export default new BoxedSearch();
