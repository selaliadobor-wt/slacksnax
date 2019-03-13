import * as rp from "request-promise";
import { logger } from "../server";
import { SnackSearchEngine } from "./searchEngine";

const searchEndpoint = "https://api.shipt.com/search/v2/search/";
const apiUserAgent =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/71.0.3578.98 Safari/537.36";

class ShiptSearchEngine implements SnackSearchEngine {
    async search(queryText: string): Promise<Snack[]> {
        logger.info(`Searching Shipt for ${queryText} at ${searchEndpoint}`);

        let response = await rp.post(searchEndpoint, {
            headers: { "User-Agent": apiUserAgent },
            json: true,
            qs: {
                bucket_number: 13,
                white_label_key: "shipt",
            },
            //Maps to Harris Teeter nearest to Durham, NC
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

        let products = <Array<any>>response["hits"];

        if (!products) {
            logger.debug(
                `Searching Shipt for ${queryText} at ${searchEndpoint} failed, invalid response`,
                response
            );
            return [];
        }

        logger.debug(
            `Searching Shipt for ${queryText} at ${searchEndpoint} returned ${
                products.length
            } products`
        );
        let snacks = await Promise.all(
            products.map(async (product: any) => {
                return <Snack>{
                    friendlyName: product["display_name"] || product["name"],
                    brand: product["brand_name"],
                    description: product["description"],
                    genericName: product["name"] || product["display_name"],
                    tags: []
                        .concat(product["keywords"])
                        .concat(product["categories"].map((category: any) => category["name"]))
                        .filter(tag => tag != null),
                    imageUrl: product["image"]["url"],
                    upc: product["upcs"][0],
                    productUrls: new Map([["shiptId", product["product_id"]]]),
                };
            })
        );
        return snacks;
    }
}

export default new ShiptSearchEngine();
