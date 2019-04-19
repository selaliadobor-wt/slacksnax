export interface Snack {
    name: string;
    genericName?: string;
    tags?: string[];
    brand?: string;
    description?: string;
    imageUrl?: string;
    upc?: string;
    productUrls?: Map<string, string>;
}
