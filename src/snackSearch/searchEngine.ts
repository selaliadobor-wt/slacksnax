import * as BoxedSearch from "./boxedSearch";
import * as SamsClubSearch from "./samsClubSearch";

interface SnackSearchEngine {
    search(queryText: String): Promise<Snack[] | undefined>;
}

const searchEngines = [BoxedSearch, SamsClubSearch];
const defaultSearchEngine = SamsClubSearch;

export { SnackSearchEngine, searchEngines, defaultSearchEngine };
