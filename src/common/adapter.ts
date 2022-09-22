import * as _ from 'lodash';
// import { inspect } from "util"
import { Entity } from './entity';
import { v4 as uuidv4 } from 'uuid';
// import { RedisType, Cache } from "./cache";
import { Action } from './action';
import { Logger } from './logger';
import { envType } from './env_checker';

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

export const createEntityAdapter: <T>() => EntityAdapter<T> = function () {
  return customAdapter;
};

/**
 * 參照 ngrx的基礎 InitialState
 * @param state
 * @returns
 */
const getInitialState = (
  state = {},
  config: { useFor: 'backend' | 'frontend' | 'basic' } = { useFor: 'backend' }
) => {
  let payload = getDEVInitialState(state);
  // switch (config['useFor']) {
  //     case "backend":
  //         payload = getDEVInitialState(state);
  //         break;
  //     case "basic":
  //     case "frontend":
  //         payload = getBasicInitialState(state);
  //         break;
  //     default:
  //         payload = getDEVInitialState(state);
  //         break;
  // }

  return payload;
};
const getBasicInitialState = (state = {}) => {
  let payload = {
    ids: [],
    entities: {},
    ...state,
  };
  return payload;
};

const getDEVInitialState = (state = {}) => {
  let payload = {
    ...getBasicInitialState(state),
    _previousHash: null,
    _currentHash: `settlement-${uuidv4()}`,
    lastSettlement: {
      isChanged: false,
      actionId: null,
      dateTime: null,
      create: {},
      update: {},
      delete: {},
      // ignore: []
    },
  };
  return payload;
};

const checkEntity = function (entity) {
  if (!(entity instanceof Entity)) {
    // console.error('[Error] Entity need to be a Class.');
    let _logger = Logger.error(
      "checkEntity",
      `Entity need to be a Class.`
    );
    if (envType == "browser" && _logger['options']['isPrint']) console.error(_logger['_str']);
    return false;
  }
  return true;
};
/**
 * Clone State and Reset LastSettlement
 * @param state
 * @returns
 */
const cloneAndReset = (state, action?: Action) => {
  let newState = _.cloneDeep(state);
  // reset lastSettlement
  newState['lastSettlement'] = {
    isChanged: false,
    actionId: !!action ? action['actionId'] : null,
    dateTime: null,
    create: {},
    update: {},
    delete: {},
    // ignore: [],
  };
  return newState;
};
/**
 * 後令壓前令
 * @param entities
 */
const makeEntitiesUniqById = (entities: {[key: string]: any}[]) => {
  let uniqEntitiesObject: { [id: string]: object } = entities.reduce(
    (acc, entity) => {
      acc[entity['id']] = entity;
      return acc;
    },
    {}
  );
  return Object.values(uniqEntitiesObject);
  // let idSet = new Set();
  // return entities.reduce((newEntities, entity) => {
  //     if (idSet.has(entity['id'])) return;
  //     idSet.add(entity['id']);
  //     newEntities.push(entity)
  //     return newEntities
  // }, [])
};

/**
 * Backend Store以後外掛上 Redis加強存取、Micro-services協作
 * 只留 ids，而 entities實體存於 redis-json
 * 包裝一個 CacheService由 main註冊後，丟給 Reducer (不需經過Store也可 set)
 * 改寫 以下所有 main結合 redis-json 寫法
 * https://www.npmjs.com/package/redis-json
 */
const redisDescription = '';

const initialMain = (initialState, newState) => {
  // initalState['lastSettlement'] = newState['lastSettlement'];
  initialState['lastSettlement']['isChanged'] = true;
  newState['ids'].map((id) => {
    initialState['lastSettlement']['actionId'] =
      newState['lastSettlement']['actionId'];
    initialState['lastSettlement']['delete'][id] = id;
  });
  return initialState;
};

// - - - - - - - - - - - - -  - - - - - -
// |           ADD part start           |
// - - - - - - - - - - - - -  - - - - - -
const addMain = function (entity: Entity, newState) {
  let entityId = entity['id'];
  if (!!newState['entities'] && !!newState['entities'][entityId]) {
    // console.warn(`[Warning/addMain] Already exist. Ignore add request in ${entity._name}`);
    let _logger = Logger.warn(
      "addMain",
      `Already exist. Ignore add request in ${entity._name}`,
      { 'isPrint': false }
    );
    if (envType == "browser" && _logger['options']['isPrint']) console.warn(_logger['_str']);
    return newState;
  }
  newState['ids'].push(entityId);
  newState['entities'][entityId] = entity;
  newState['lastSettlement']['isChanged'] = true;
  newState['lastSettlement']['create'][entityId] = entity;
  return newState;
};
// const addToRedis = async (entity: {}, newState, { reducerName, cacheService }: ToRedisOptions) => {
//     console.log("addToRedis", reducerName)
//     let entityId = entity['id'];
//     let _theEntity = await cacheService.Redis.json.get(entityId);
//     if (!!_theEntity) {
//         // console.warn(`[Warning/addMain] Already exist. Ignore add request in ${entity._name}`);
//         return newState;
//     }
//     newState['ids'].push(entityId);
//     await cacheService.Redis.json.set(reducerName, entityId, entity);
//     console.log(
//         await cacheService.Redis.json.get(reducerName)
//     )
//     newState['lastSettlement']['isChanged'] = true;
//     newState['lastSettlement']['create'][entityId] = entity;
//     return newState;
// }
/**
 * Add one entity to the collection.
 */
const addOne = function (entity: Entity, newState, options?: ToRedisOptions) {
  if (Array.isArray(entity)) {
    // console.error(`[Error/addOne] AddOne ids need to be Object`);
    let _logger = Logger.error(
      "addOne",
      `AddOne ids need to be Object`
    );
    if (envType == "browser" && _logger['options']['isPrint']) console.error(_logger['_str']);
    return newState;
  }
  newState = addMain(entity, newState);
  return newState;
};
/**
 * Add multiple entities to the collection.
 */
const addMany = function (entities: Entity[], newState, options?: ToRedisOptions) {
  if (!Array.isArray(entities)) {
    // console.error(`[Error/addMany] AddMany ids need to be Array`);
    let _logger = Logger.error(
      "addMany",
      `AddMany ids need to be Array.`
    );
    if (envType == "browser" && _logger['options']['isPrint']) console.error(_logger['_str']);
    return newState;
  }
  // let newState = cloneAndReset(state);
  // await Promise.all(
  makeEntitiesUniqById(entities).map((entity: Entity, index) => {
    // if (!!options) newState = addToRedis(entity, newState, options);
    // else
    newState = addMain(entity, newState);
    // if (index == entities.length - 1) { }
  });
  // );
  return newState;
};
// - - - - - - - - - - - - -  - - - - - -
// |           ADD part end             |
// - - - - - - - - - - - - -  - - - - - -

// - - - - - - - - - - - - -  - - - - - -
// |           Set part start           |
// - - - - - - - - - - - - -  - - - - - -
const setMain = function (entity: object, newState) {
  let entityId = entity['id'];
  let oldEntity = newState['entities'][entityId],
    newEntity: any = entity;

  if (!!oldEntity && 'toObject' in oldEntity) oldEntity = oldEntity.toObject();
  if ('toObject' in newEntity) newEntity = newEntity.toObject();
  // let oldEntity = newState['entities'][entityId].toObject(),
  //     newEntity = entity.toObject();
  if (_.isEqual(oldEntity, newEntity) == false) {
    if (!!!oldEntity) {
      newState['ids'].push(entityId);
      newState['lastSettlement']['create'][entityId] = entity;
    }
    else { 
      newState['lastSettlement']['update'][entityId] = entity;
    }
    // 舊的跟新的不一樣時，就以新的覆蓋舊的過去
    newState['entities'][entityId] = entity;
    newState['lastSettlement']['isChanged'] = true;
    delete newState['lastSettlement']['delete'][entityId];
  } else {
    // 沒有不同，覆不覆蓋沒差
  }
  return newState;
};
// const setToRedis = async (entity: object, newState, { reducerName, cacheService }: ToRedisOptions) => {
//     let entityId = entity['id'];
//     let oldEntity = await cacheService.Redis.json.get(entityId),
//         newEntity: any = entity;
//     if (_.isEqual(oldEntity, newEntity) == false) {
//         // 舊的跟新的不一樣時，就以新的覆蓋舊的過去
//         await cacheService.Redis.json.set(reducerName, entityId, entity);
//         newState['lastSettlement']['isChanged'] = true;
//         newState['lastSettlement']['update'][entityId] = entity;
//     } else {
//         // 沒有不同，覆不覆蓋沒差
//     }
//     return newState
// }
/**
 * Add or Replace one entity in the collection.
 */
const setOne = function (entity: object, newState) {
  if (Array.isArray(entity)) {
    // console.error(`[Error/setMain] SetOne ids need to be Object`);
    let _logger = Logger.error(
      "setOne",
      `SetOne ids need to be Object.`
    );
    if (envType == "browser" && _logger['options']['isPrint']) console.error(_logger['_str']);
    return newState;
  }

  newState = setMain(entity, newState);
  return newState;
};
/**
 * Add or Replace multiple entities in the collection.
 */
const setMany = function (entities: object[], newState) {
  if (!Array.isArray(entities)) {
    // console.error(`[Error/setMany] SetMany ids need to be Array`);
    let _logger = Logger.error(
      "setMany",
      `SetMany ids need to be Array.`
    );
    if (envType == "browser" && _logger['options']['isPrint']) console.error(_logger['_str']);
    return newState;
  }
  makeEntitiesUniqById(entities).map((entity, index) => {
    newState = setMain(entity, newState);
  });
  return newState;
};
/**
 * Replace current collection with provided collection.
 */
const setAll = function (entities: object[], newState) {
  if (!Array.isArray(entities)) {
    // console.error(`[Error/setAll] SetAll ids need to be Array`);
    let _logger = Logger.error(
      "setAll",
      `SetAll ids need to be Array.`
    );
    if (envType == "browser" && _logger['options']['isPrint']) console.error(_logger['_str']);
    return newState;
  }
  newState = removeAll(newState);

  // await Promise.all(
  makeEntitiesUniqById(entities).map((entity) => {
    newState = setMain(entity, newState);
  });
  // );
  return newState;
};
// - - - - - - - - - - - - -  - - - - - -
// |           Set part end             |
// - - - - - - - - - - - - -  - - - - - -

// - - - - - - - - - - - - -  - - - - - -
// |          Remove part start         |
// - - - - - - - - - - - - -  - - - - - -
const removeMain = function (id: string, newState) {
  let _theEntity: object = newState['entities'][id];
  if (!!_theEntity) {
    delete newState['entities'][id];
    newState['ids'] = Object.keys(newState['entities']);
    newState['lastSettlement']['isChanged'] = true;
    newState['lastSettlement']['delete'][id] = id;
  } else {
    // it didn't exist.
  }
  return newState;
};
/**
 * Remove one entity from the collection.
 */
const removeOne = function (id: string, newState) {
  if (Array.isArray(id)) {
    // console.error(`[Error/removeOne] RemoveOne ids need to be String`);
    let _logger = Logger.error(
      "removeOne",
      `RemoveOne ids need to be String.`
    );
    if (envType == "browser" && _logger['options']['isPrint']) console.error(_logger['_str']);
    return newState;
  }
  // let newState = cloneAndReset(state);
  newState = removeMain(id, newState);
  return newState;
};
/**
 * Remove multiple entities from the collection, by id or by predicate.
 */
const removeMany = function (ids: string[], newState) {
  if (!Array.isArray(ids)) {
    // console.error(`[Error] RemoveMany ids need to be Array`);
    let _logger = Logger.error(
      "removeMany",
      `RemoveMany ids need to be Array.`
    );
    if (envType == "browser" && _logger['options']['isPrint']) console.error(_logger['_str']);
    return newState;
  }
  // let newState = cloneAndReset(state);
  // await Promise.all(
  ids.map((id, index) => {
    newState = removeMain(id, newState);
    // if (index == ids.length - 1) { }
  });
  // );
  return newState;
};
/**
 * Clear entity collection.
 */
const removeAll = function (newState) {
  // let newState = cloneAndReset(newState);
  newState['ids'].map((id, index) => {
    newState = removeMain(id, newState);
    // if (index == ids.length - 1) { }
  });
  // console.log(`[Experiment/removeAll] You can use the adapter.initalState as input`)
  return newState;
};
// - - - - - - - - - - - - -  - - - - - -
// |           Remove part End          |
// - - - - - - - - - - - - -  - - - - - -

// - - - - - - - - - - - - -  - - - - - -
// |          Update part start         |
// - - - - - - - - - - - - -  - - - - - -
const updateMain = function (entity: Entity, newState) {
  let entityId = entity['id'];
  if (!!newState['entities'] && !newState['entities'][entityId]) {
    // console.warn(`[Warning/updateMain] Data isn't exist. Ignore update request:\n${entity.toObject()['id']}\n`);
    let _logger = Logger.warn(
      "updateMain",
      `Data isn't exist. Ignore update request:\n${entity.toObject()['id']}\n`,
      { "isPrint": false }
    );
    if (envType == "browser" && _logger['options']['isPrint']) console.warn(_logger['_str']);

    return newState;
  }
  let theEntity = newState['entities'][entityId];

  // 與 set不同的是舊有的 property不會去做改變跟影響
  // await Promise.all(
  Object.entries(entity).map((entry) => {
    let _key = entry[0],
      _val = entry[1];
    if (typeof _val == 'function') return;
    if (_.isEqual(theEntity[_key], _val) == false) {
      theEntity[_key] = _val;
      newState['lastSettlement']['isChanged'] = true;
      newState['lastSettlement']['update'][entityId] = theEntity;
    }
  });
  // )
  return newState;
};
/**
 * Update one entity in the collection. Supports partial updates.
 */
const updateOne = function (entity: Entity, newState) {
  if (Array.isArray(entity)) {
    // console.error(`[Error/updateOne] UpdateOne ids need to be Object`);
    let _logger = Logger.error(
      "updateOne",
      `UpdateOne ids need to be Object`
    );
    if (envType == "browser" && _logger['options']['isPrint']) console.error(_logger['_str']);

    return newState;
  }
  // let newState = cloneAndReset(state);
  newState = updateMain(entity, newState);
  return newState;
};
/**
 * Update multiple entities in the collection. Supports partial updates.
 */
const updateMany = function (entities: Entity[], newState) {
  if (!Array.isArray(entities)) {
    // console.error(`[Error] UpdateMany ids need to be Array`);
    let _logger = Logger.error(
      "updateMany",
      `UpdateMany ids need to be Array.`
    );
    if (envType == "browser" && _logger['options']['isPrint']) console.error(_logger['_str']);
    return newState;
  }
  // let newState = cloneAndReset(state);
  // await Promise.all(
  makeEntitiesUniqById(entities).map((entity: Entity, index) => {
    newState = updateMain(entity, newState);
    // if (index == entities.length - 1) { }
  });
  // );
  return newState;
};
// - - - - - - - - - - - - -  - - - - - -
// |           Update part end          |
// - - - - - - - - - - - - -  - - - - - -

// - - - - - - - - - - - - -  - - - - - -
// |          Upsert part start         |
// - - - - - - - - - - - - -  - - - - - -
const upsertMain = function (entity: Entity, newState) {
  newState = updateMain(entity, newState);
  newState = addMain(entity, newState);
  // let entityId = entity['id'];
  // if (!!newState['entities'] && !!newState['entities'][entityId]) {
  //     let theEntity = newState['entities'][entityId];

  //     // 與 set不同的是舊有的 property不會去做改變跟影響
  //     // await Promise.all(
  //     Object.entries(entity).map(entry => {
  //         let _key = entry[0], _val = entry[1];
  //         if (typeof (_val) == "function") return;
  //         if (_.isEqual(theEntity[_key], _val) == false) {
  //             theEntity[_key] = _val;
  //             newState['lastSettlement']['isChanged'] = true;
  //         }
  //     })
  //     // )
  //     if (!!newState['lastSettlement']['isChanged']) {
  //         newState['lastSettlement']['update'][entityId] = theEntity;
  //     }
  //     return newState;
  // }
  // else if (!!newState['entities'] && !newState['entities'][entityId]) {
  //     newState['ids'].push(entityId);
  //     newState['entities'][entityId] = entity;
  //     newState['lastSettlement']['isChanged'] = true;
  //     newState['lastSettlement']['create'][entityId] = entity;
  // }
  return newState;
};
/**
 * Add or Update one entity in the collection.
 */
const upsertOne = function (entity: Entity, newState) {
  if (Array.isArray(entity)) {
    // console.error(`[Error/upsertOne] UpsertOne ids need to be Object`);
    let _logger = Logger.error(
      "upsertOne",
      `UpsertOne ids need to be Object.`
    );
    if (envType == "browser" && _logger['options']['isPrint']) console.error(_logger['_str']);
    return newState;
  }
  // let newState = cloneAndReset(state);
  newState = upsertMain(entity, newState);

  return newState;
};
/**
 * Add or Update multiple entities in the collection.
 */
const upsertMany = function (entities: Entity[], newState) {
  if (!Array.isArray(entities)) {
    // console.error(`[Error/upsertMany] UpsertMany ids need to be Array`);
    let _logger = Logger.error(
      "upsertMany",
      `UpsertMany ids need to be Array.`
    );
    if (envType == "browser" && _logger['options']['isPrint']) console.error(_logger['_str']);
    return newState;
  }
  // let newState = cloneAndReset(state);
  // await Promise.all(
  makeEntitiesUniqById(entities).map((entity: Entity, index) => {
    newState = upsertMain(entity, newState);
    // if (index == entities.length - 1) { }
  });
  // );
  // console.log(2890238, newState)
  return newState;
};
// /**
//  * Add or Update multiple entities in the collection.
//  */
// const upsertOnePartRelation = function (entities: {}, newState) {
//   if (Array.isArray(entities)) {
//     console.error(
//       `[Error/upsertMany] UpsertOnePartRelation ids need to be Object`
//     );
//     return newState;
//   }
//   newState = upsertMain(entity, newState);
//   return newState;
// };
// - - - - - - - - - - - - -  - - - - - -
// |           Upsert part end          |
// - - - - - - - - - - - - -  - - - - - -

/**
 * The entity adapter also provides methods for operations against an entity.
 * These methods can change one to many records at a time.
 * Each method returns the newly modified state if changes were made and the same state if no changes were made.
 * * addOne: Add one entity to the collection.
 * * addMany: Add multiple entities to the collection.
 * * setAll: Replace current collection with provided collection.
 * * setOne: Add or Replace one entity in the collection.
 * * setMany: Add or Replace multiple entities in the collection.
 * * removeOne: Remove one entity from the collection.
 * * removeMany: Remove multiple entities from the collection, by id or by predicate.
 * * removeAll: Clear entity collection.
 * * updateOne: Update one entity in the collection. Supports partial updates.
 * * updateMany: Update multiple entities in the collection. Supports partial updates.
 * * upsertOne: Add or Update one entity in the collection.
 * * upsertMany: Add or Update multiple entities in the collection.
 * * mapOne: Update one entity in the collection by defining a map function.
 * * map: Update multiple entities in the collection by defining a map function, similar to Array.map.
 */
export {
  cloneAndReset,
  initialMain,
  addOne,
  addMany,
  setOne,
  setMany,
  setAll,
  removeOne,
  removeMany,
  removeAll,
  updateOne,
  updateMany,
  upsertOne,
  upsertMany,
};

const customAdapter = {
  getInitialState,
  // getDEVInitialState,
};
// interface customAdapter<T> {
//     upsertReducer<S extends object, R extends object>(state: S, action: R): S
// }
// export const customAdapter = { superUpsertMany }
