import * as BoxedSearch from "./boxedSearch";
import * as SamsClubSearch from "./samsClubSearch";
import * as ShiptSearchEngine from "./shiptSearch";
import { flatten } from "../util";
import { compareTwoStrings } from "string-similarity";
interface SnackSearchEngine {
    search(queryText: string): Promise<Snack[]>;
}

const searchEngines = [ShiptSearchEngine, BoxedSearch, SamsClubSearch];
const defaultSearchEngine = ShiptSearchEngine;

async function searchAllEngines(queryText: string): Promise<Snack[]> {
    let snacks = flatten(
        await Promise.all(searchEngines.map(engine => engine.default.search(queryText)))
    );
    return snacks.sort(
        (snackA, snackB) =>
            compareTwoStrings(snackB.friendlyName, queryText) -
            compareTwoStrings(snackA.friendlyName, queryText)
    );
}
export { SnackSearchEngine, searchEngines, defaultSearchEngine, searchAllEngines };
