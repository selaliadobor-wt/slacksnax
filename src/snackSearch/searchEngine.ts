import * as BoxedSearch from "./boxedSearch";
import * as SamsClubSearch from "./samsClubSearch";
import * as ShiptSearchEngine from "./shiptSearch";
import { flatten } from "../util";
import { compareTwoStrings } from "string-similarity";
import { logger } from "../server";
interface SnackSearchEngine {
    search(queryText: string): Promise<Snack[]>;
}

const searchEngines = [ShiptSearchEngine, BoxedSearch, SamsClubSearch];
const defaultSearchEngine = ShiptSearchEngine;

const maxSnackSimilarity = 0.8; //0 to 1 based on text similarity
async function searchAllEngines(queryText: string): Promise<Snack[]> {
    let snacks = flatten(
        await Promise.all(searchEngines.map(engine => engine.default.search(queryText)))
    );
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
                    maxSnackSimilarity;
                let alreadyCompared = comparedSnacks.some(
                    comparison => comparison.includes(snackA) && comparison.includes(snackB)
                );
                comparedSnacks.push([snackA, snackB]);
                if (areSimilar) {
                    logger.info(
                        `Snack A: ${JSON.stringify(
                            snackA.friendlyName
                        )} | Snack B: ${JSON.stringify(
                            snackB.friendlyName
                        )} | Similarity: ${compareTwoStrings(
                            snackA.friendlyName,
                            snackB.friendlyName
                        )}`
                    );
                }
                return !alreadyCompared && areSimilar;
            });
        })
        .map(snack => {
            snack.friendlyName += " | " + compareTwoStrings(snack.friendlyName, queryText);
            return snack;
        })
        .reverse();
}
export { SnackSearchEngine, searchEngines, defaultSearchEngine, searchAllEngines };
