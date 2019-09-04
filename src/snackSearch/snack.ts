export interface Snack {
    name: string;
    genericName?: string | null;
    tags?: string[] | null;
    brand?: string | null;
    description?: string | null;
    imageUrl?: string | null;
    upc?: string | null;
    productUrls?: { [source: string]: string | null };
    searchEngineSource?: string | null;
}
