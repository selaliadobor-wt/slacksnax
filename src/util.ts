function flatten<T>(arr: Array<Array<T>>): Array<T> {
    return arr.reduce(function(flat: Array<T>, toFlatten) {
        return flat.concat(Array.isArray(toFlatten) ? flatten(<any>toFlatten) : toFlatten);
    }, []);
}

export { flatten };
