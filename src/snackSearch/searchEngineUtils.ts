import { flatten } from "../util";
import BoxedSearch from "./boxedSearch";
import SamsClubSearch from "./samsClubSearch";
import SnackSearchEngine from "./searchEngine";
import ShiptSearchEngine from "./shiptSearch";
import { Snack } from "./snack";

const searchEngines = [ShiptSearchEngine, BoxedSearch, SamsClubSearch];
const defaultSearchEngine = ShiptSearchEngine;

async function searchAllEngines(queryText: string): Promise<Snack[]> {
    const snacks = flatten(await Promise.all(searchEngines.map(engine => engine.search(queryText))));
    return SnackSearchEngine.sortByBestResult(queryText, snacks);
}
export { SnackSearchEngine, searchEngines, defaultSearchEngine, searchAllEngines };
