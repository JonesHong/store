

export const MapToObject = (SomeMap: Map<any, any>): {} => {
    let newObject = {};
    SomeMap.forEach((value, key) => {
        newObject[key] = value;
    })
    return newObject;
};

export const MapToString = (SomeMap: Map<any, any>): string => {
    let newObject = MapToObject(SomeMap);
    let newString = JSON.stringify(newObject);
    return newString;
}
