import BoxedSearch from "./boxedSearch";
import SamsClubSearch from "./samsClubSearch";
import ShiptSearchEngine from "./shiptSearch";
import SnackSearchEngine from "./searchEngine";
import { flatten } from "../util";

const searchEngines = [ShiptSearchEngine, BoxedSearch, SamsClubSearch];
const defaultSearchEngine = ShiptSearchEngine;

async function searchAllEngines(queryText: string): Promise<Snack[]> {
    let snacks = flatten(await Promise.all(searchEngines.map(engine => engine.search(queryText))));
    return SnackSearchEngine.sortByBestResult(queryText, snacks);
}
export { SnackSearchEngine, searchEngines, defaultSearchEngine, searchAllEngines };
