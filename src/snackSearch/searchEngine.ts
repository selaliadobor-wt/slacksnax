import { compareTwoStrings } from "string-similarity";
import { logger } from "../server";
import { redis } from "../redis";

abstract class SnackSearchEngine {
    private static searchCacheTtl = 60 * 60 * 10; //Seconds * Minutes * Hours

    private static maxSnackSimilarity = 0.8; //0 to 1 based on text similarity

    abstract get engineName(): String;
    protected abstract async uncachedSearch(queryText: string): Promise<Snack[]>;
    static sortByBestResult(queryText: string, snacks: Snack[]) {
        let comparedSnacks: Array<Snack[]> = [];

        return snacks
            .sort(
                (snackA, snackB) =>
                    compareTwoStrings(snackB.friendlyName, queryText) -
                    compareTwoStrings(snackA.friendlyName, queryText)
            )
            .reverse()
            .filter(snackA => {
                return !snacks.some(snackB => {
                    if (snackA.friendlyName == snackB.friendlyName) {
                        return false;
                    }
                    let areSimilar =
                        compareTwoStrings(snackA.friendlyName, snackB.friendlyName) >
                        SnackSearchEngine.maxSnackSimilarity;
                    let alreadyCompared = comparedSnacks.some(
                        comparison => comparison.includes(snackA) && comparison.includes(snackB)
                    );
                    comparedSnacks.push([snackA, snackB]);

                    return !alreadyCompared && areSimilar;
                });
            })
            .reverse();
    }

    async search(queryText: string): Promise<Snack[]> {
        let searchCacheKey = `snack-search:${this.engineName}:${queryText}`;

        try {
            let cachedSnacks = await redis.get(searchCacheKey);
            if (cachedSnacks != null) {
                logger.info(
                    `Returning results for "${queryText}" from cache key "${searchCacheKey}"`
                );
                return SnackSearchEngine.sortByBestResult(queryText, JSON.parse(cachedSnacks));
            }
        } catch (err) {
            logger.error(
                `Failed to get results for "${queryText}" from cache key "${searchCacheKey}"`,
                err
            );
        }

        let snacks = await this.uncachedSearch(queryText);
        try {
            await redis.set(
                searchCacheKey,
                JSON.stringify(snacks),
                "ex",
                SnackSearchEngine.searchCacheTtl
            );
            logger.info(`Wrote key "${searchCacheKey}" for "${queryText}" to Redis`);
        } catch (err) {
            logger.error(
                `Failed to write key "${searchCacheKey}" for "${queryText}" to Redis`,
                err
            );
        }

        return SnackSearchEngine.sortByBestResult(queryText, snacks);
    }
}

export default SnackSearchEngine;
