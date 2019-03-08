interface Snack {
    friendlyName: string;
    genericName: string | null;
    tags: string[] | null;
    brand: string | null;
    description: string | null;
    imageUrl: string | null;
    upc: string | null;
    productUrls: Map<string, string> | null;
}
