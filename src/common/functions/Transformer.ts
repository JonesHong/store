export const MapToObject = (SomeMap: Map<any, any>): {} => {
  const newObject = {};
  SomeMap.forEach((value, key) => {
    newObject[key] = value;
  });
  return newObject;
};

export const MapToString = (SomeMap: Map<any, any>): string => {
  const newObject = MapToObject(SomeMap);
  const newString = JSON.stringify(newObject);
  return newString;
};
