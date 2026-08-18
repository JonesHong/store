export const MapToObject = (SomeMap: Map<string, unknown>): {} => {
  const newObject = {};
  SomeMap.forEach((value, key) => {
    newObject[key] = value;
  });
  return newObject;
};

export const MapToString = (SomeMap: Map<string, unknown>): string => {
  const newObject = MapToObject(SomeMap);
  const newString = JSON.stringify(newObject);
  return newString;
};
