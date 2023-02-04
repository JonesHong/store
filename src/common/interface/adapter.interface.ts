
export interface EntityState<T> {
    ids: string[];
    entities: { [key: string]: T };
    _previousHash: string;
    _currentHash: string;
    lastSettlement: LastSettlement<T>;
    // entitiesList: T[];
    // _hash: string;
}
// export interface DevEntityState<T> extends EntityState<T> {
//     _previousHash: string,
//     _currentHash: string,
//     lastSettlement: LastSettlement<T>
// }
export interface LastSettlement<T> {
    isChanged: boolean;
    actionId: string;
    create: { [id: string]: T };
    update: { [id: string]: T };
    delete: { [id: string]: string };
    dateTime: number;
    // ignore: string[];
}

export interface ToRedisOptions {
    reducerName: string;
    cacheService: Cache;
}

export interface EntityAdapter<T> {
    getInitialState(): EntityState<T>;
    getInitialState<S extends object>(state: S): EntityState<T> & S;
    // upsertReducerState<S extends object,>(action: S, state: EntityState<T>);
    // addOne<S extends object,>(entity: S, state: EntityState<T>);
    // addMany<S extends object,>(entities: S, state: EntityState<T>);
    // setOne<S extends object,>(entity: S, state: EntityState<T>);
    // setMany<S extends object,>(entities: S, state: EntityState<T>);
    // setAll<S extends object,>(entities: S, state: EntityState<T>);
    // removeOne<S extends object,>(id: S, state: EntityState<T>);
    // removeMany<S extends object,>(ids: S, state: EntityState<T>);
    // removeAll(state: EntityState<T>);
    // updateOne<S extends object,>(entity: S, state: EntityState<T>);
    // updateMany<S extends object,>(entities: S, state: EntityState<T>);
    // upsertOne<S extends object,>(entity: S, state: EntityState<T>);
    // upsertMany<S extends object,>(entities: S, state: EntityState<T>);
}
