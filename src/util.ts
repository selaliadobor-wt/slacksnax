function flatten<T>(arr: T[][]): T[] {
    return arr.reduce((flat: T[], toFlatten) => {
        return flat.concat(Array.isArray(toFlatten) ? flatten(toFlatten as any) : toFlatten);
    }, []);
}

export { flatten };
