import * as rp from "request-promise";
import { logger } from "../server";
import SnackSearchEngine from "./searchEngine";
import { Snack } from "./snack";

const searchEndpoint = "https://www.samsclub.com/api/node/vivaldi/v1/products/search/";
const productEndpoint = "https://www.samsclub.com/api/node/vivaldi/v1/products/";
const apiUserAgent =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/71.0.3578.98 Safari/537.36";

class SamsClubSearchEngine extends SnackSearchEngine {
    engineName: String = "sams-club";

    async uncachedSearch(queryText: string): Promise<Snack[]> {
        logger.info(`Searching Sam's Club for ${queryText} at ${searchEndpoint}`);

        let response = await rp.get(searchEndpoint, {
            headers: { "User-Agent": apiUserAgent },
            json: true,
            qs: {
                sourceType: 1,
                selectedFilter: "all",
                sortKey: "relevance",
                sortOrder: 1,
                offset: 0,
                limit: 48,
                searchTerm: queryText,
                clubId: 6365,
            },
        });

        let products = <Array<any>>response["payload"]["records"];

        if (!products) {
            logger.debug(
                `Searching Sam's Club for ${queryText} at ${searchEndpoint} failed, invalid response`,
                response
            );
            return [];
        }

        logger.debug(`Searching Sam's Club for ${queryText} at ${searchEndpoint} returned ${products.length} products`);
        let snacks = await Promise.all(
            products.map(async (product: any) => {
                let productUrl = productEndpoint + product["productId"];
                let response = await rp.get(productEndpoint + product["productId"], {
                    headers: { "User-Agent": apiUserAgent },
                    json: true,
                });
                let payload = response["payload"];
                return <Snack>{
                    friendlyName: payload["productName"].split("(")[0], //Remove sizing information from names
                    brand: payload["brandName"] == null ? payload["productName"] : payload["brandName"].trim(),
                    description: payload["longDescription"] || payload["shortDescription"],
                    tags:
                        payload["keywords"] == null
                            ? [payload["productName"]]
                            : payload["keywords"].split(",").map((tag: String) => tag.trim()),
                    imageUrl: "https:" + payload["listImage"],
                    upc: payload["skuOptions"][0]["upc"],
                    productUrls: new Map([["samsClubId", payload["productId"]], ["samsClubApiUrl", productUrl]]),
                };
            })
        );
        return snacks;
    }
}

export default new SamsClubSearchEngine();
