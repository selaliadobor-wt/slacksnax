import * as BoxedSearch from "./boxedSearch";
import * as SamsClubSearch from "./samsClubSearch";
import * as ShiptSearchEngine from "./shiptSearch";
interface SnackSearchEngine {
    search(queryText: String): Promise<Snack[] | undefined>;
}

const searchEngines = [ShiptSearchEngine, BoxedSearch, SamsClubSearch];
const defaultSearchEngine = ShiptSearchEngine;

export { SnackSearchEngine, searchEngines, defaultSearchEngine };
