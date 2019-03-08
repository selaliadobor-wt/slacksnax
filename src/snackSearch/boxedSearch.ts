import * as rp from "request-promise";
import { logger } from "../server";
import { SnackSearchEngine } from "./searchEngine";

const boxedApiUrl = "https://www.boxed.com/api/search/";
const apiUserAgent =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/71.0.3578.98 Safari/537.36";

class BoxedSearch implements SnackSearchEngine {
    async search(queryText: String): Promise<Snack[] | undefined> {
        let searchUrl = boxedApiUrl + encodeURIComponent(queryText.trim());

        logger.info(`Searching Boxed for ${queryText} at ${searchUrl}`);

        let response = await rp.get(searchUrl, {
            headers: { "User-Agent": apiUserAgent },
            json: true,
        });

        let products = response["data"]["productListEntities"];

        if (!products) {
            logger.debug(
                `Searching Boxed for ${queryText} at ${searchUrl} failed, invalid response`,
                response
            );
            return undefined;
        }

        logger.debug(
            `Searching Boxed for ${queryText} at ${searchUrl} returned ${products.length} products`
        );

        return products.map((product: any) => {
            return <Snack>{
                friendlyName: product["name"],
                brand: product["variantObject"]["product"]["brand"],
                description:
                    product["variantObject"]["product"]["longDescription"] ||
                    product["variantObject"]["product"]["shortDescription"],
                tags: product["variantObject"]["product"]["keywords"],
                imageUrl: product["images"][0]["originalBase"],
                upc: product["variantObject"]["upc"],
                productUrls: new Map([["boxedId", product["variantObject"]["gid"]]]),
            };
        });
    }
}

export default new BoxedSearch();
