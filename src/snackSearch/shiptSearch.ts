import * as rp from "request-promise";
import { logger } from "../server";
import SnackSearchEngine from "./searchEngine";
import { Snack } from "./snack";

const searchEndpoint = "https://api.shipt.com/search/v2/search/";
const apiUserAgent =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/71.0.3578.98 Safari/537.36";

class ShiptSearchEngine extends SnackSearchEngine {
    public engineName: string = "Shipt";

    public async uncachedSearch(queryText: string): Promise<Snack[]> {
        logger.info(`Searching Shipt for ${queryText} at ${searchEndpoint}`);

        const response = await rp.post(searchEndpoint, {
            headers: { "User-Agent": apiUserAgent },
            json: true,
            qs: {
                bucket_number: 13,
                white_label_key: "shipt",
            },
            // Maps to Harris Teeter nearest to Durham, NC
            body: {
                user_id: 2168807,
                store_id: 6,
                metro_id: 31,
                store_location_id: 1235,
                query: queryText,
                featured: true,
                section_id: 1,
            },
        });

        const products = response.hits as any[];

        if (!products) {
            logger.debug(`Searching Shipt for ${queryText} at ${searchEndpoint} failed, invalid response`, response);
            return [];
        }

        logger.debug(`Searching Shipt for ${queryText} at ${searchEndpoint} returned ${products.length} products`);
        const snacks = await Promise.all(
            products.map<Promise<Snack>>(async (product: any) => {
                return {
                    name: product.display_name || product.name,
                    brand: product.brand_name,
                    description: product.description,
                    genericName: product.name || product.display_name,
                    tags: []
                        .concat(product.keywords)
                        .concat(product.categories.map((category: any) => category.name))
                        .filter(tag => tag !== null),
                    imageUrl: product.image.url,
                    upc: product.upcs[0],
                    productUrls: { shiptId: product.product_id },
                };
            })
        );
        return snacks;
    }
}

export default new ShiptSearchEngine();
