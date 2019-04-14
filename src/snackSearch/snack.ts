export interface Snack {
    friendlyName: string;
    genericName?: string;
    tags?: string[];
    brand?: string;
    description?: string;
    imageUrl?: string;
    upc?: string;
    productUrls?: Map<string, string>;
}
