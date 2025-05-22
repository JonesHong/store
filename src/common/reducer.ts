// src/common/reducer.ts
// 此檔案定義了應用程式的 Reducer 邏輯，並使用 Immutable.js 進行狀態管理。
// Reducer 負責根據接收到的 Action 來更新應用程式的狀態。
// `createReducer` 和 `on` 輔助函式用於建立型別安全的 Reducer，並整合了初步的快取淘汰策略。

import * as Immutable from 'immutable';
import { v4 as uuidV4 } from 'uuid'; // 用於產生 _currentHash
import { DateTime } from 'luxon'; // 用於記錄時間戳
import {
    Action as BaseAction,
    ActionCreator,
    ActionWithPayload,
    initial as initialActionCreator, // 用於 finalizeStateUpdate 中的比較
} from './action';
import { Logger } from './logger'; // 用於日誌記錄
import { Main } from './main';   // 用於控制日誌輸出模式
import * as _ from 'lodash';    // 保留 lodash 的 _.uniqBy 用於處理輸入的普通陣列

// #region Cache Configuration Types - 快取配置相關類型定義

/**
 * 定義支援的快取淘汰策略類型。
 * - `LRU`: Least Recently Used (最近最少使用)。當快取達到上限時，移除最近最少被存取或更新的實體。
 * - `LFU`: Least Frequently Used (最不常使用) - **目前未實現**。
 * - `TIME`: Time-based (基於時間的淘汰) - **目前未實現**。
 */
export type CacheStrategy = 'LRU' | 'LFU' | 'TIME';

/**
 * Reducer 快取配置的介面。
 * 用於定義特定 Reducer 實例的快取行為。
 */
export interface CacheConfig {
    /** 快取淘汰策略，預設為 'LRU'。 */
    strategy?: CacheStrategy;
    /** 
     * 快取的最大容量（實體數量）。
     * 僅在 `strategy` 為 'LRU' 或 'LFU' 時有效。
     * 預設為 `Infinity` (無限制)。
     */
    maxSize?: number;
    /** 
     * 實體的最大存活時間（毫秒）。
     * 僅在 `strategy` 為 'TIME' 時有效。**目前未實現**。
     */
    maxAge?: number;
}
// #endregion Cache Configuration Types

// #region Immutable EntityState Definition - Immutable 實體狀態定義

/**
 * 代表使用 Immutable.js 結構的實體狀態。
 * 狀態本身是一個 Immutable.Map，包含如 `ids`, `entities`, `_cacheMeta` 等鍵。
 * @template T 實體的原始型別。在狀態中，實體將被轉換為 `Immutable.Map<string, any>`。
 */
export type ImmutableEntityState<T> = Immutable.Map<string, any>;

/** 輔助類型：表示傳入操作函式的普通 JavaScript 實體對象，必須包含 `id`。 */
type PlainEntity<T> = T & { id: string };
/** 輔助類型：表示傳入更新操作函式的普通 JavaScript 部分實體對象，必須包含 `id`。 */
type PlainEntityUpdate<T> = Partial<T> & { id: string };

// #endregion Immutable EntityState Definition

// #region createReducer 和 on 輔助函式 - Reducer 建立工具

/**
 * Reducer 函式的內部型別，操作 Immutable 狀態。
 * @template S 狀態類型，擴展自 `ImmutableEntityState<any>`。
 * @template A Action 類型。
 */
type ReducerFn<S extends ImmutableEntityState<any>, A extends BaseAction> = (state: S, action: A) => S;

/**
 * `on` 函式的介面定義，用於將 Action Creator 與其對應的 ReducerFn 關聯起來。
 * @template S 狀態類型。
 */
interface On<S extends ImmutableEntityState<any>> {
    /**
     * 處理帶有 payload 的 Action。
     * @template AC Action Creator 的類型。
     * @param actionCreator Action Creator 函式。
     * @param reducer 對應該 Action 的 Reducer 處理函式。
     * @returns 一個包含 Action Type 和 Reducer 函式的物件，供 `createReducer` 使用。
     */
    <AC extends ActionCreator<any, any>>(actionCreator: AC, reducer: ReducerFn<S, ReturnType<AC>>): { actionType: string; reducer: ReducerFn<S, BaseAction> };
    /**
     * 處理不帶 payload 的 Action。
     * @template AC Action Creator 的類型。
     * @param actionCreator Action Creator 函式。
     * @param reducer 對應該 Action 的 Reducer 處理函式。
     * @returns 一個包含 Action Type 和 Reducer 函式的物件，供 `createReducer` 使用。
     */
    (actionCreator: ActionCreator<any, void>, reducer: ReducerFn<S, ActionWithPayload<any, void>>): { actionType: string; reducer: ReducerFn<S, BaseAction> };
}

/**
 * `on` 函式：將一個或多個 Action Creator 與一個 Reducer 函式綁定。
 * @param actionCreator 一個或多個 Action Creator。
 * @param reducer 對應這些 Action 的 Reducer 函式。
 * @returns 一個物件，包含 Action Type 字串和 Reducer 函式，供 `createReducer` 內部使用。
 */
export const on: On<any> = (actionCreator: ActionCreator<any, any> | ActionCreator<any, void>, reducer: ReducerFn<any, any>) => {
    return { actionType: actionCreator.type, reducer };
};

/**
 * 建立一個 Reducer 函式，該函式管理一個 Immutable 的實體狀態。
 * Reducer 會根據傳入的 Action 更新狀態，並可選地應用快取淘汰策略。
 *
 * @template S 狀態的類型，必須是 `ImmutableEntityState<any>` 的子類型。
 * @param initialState Reducer 的初始狀態，應由 `getInitialEntityState` 建立。
 * @param onsAndCacheConfig 一個可變參數陣列，包含：
 *                          - 由 `on()` 函式建立的 Action 處理器物件。
 *                          - （可選）一個 `CacheConfig` 物件，用於配置此 Reducer 的快取策略。
 *                            如果提供，此配置將與 `initialState` 中的預設 `_cacheConfig` 合併。
 * @returns 一個標準的 Redux Reducer 函式 `(state: S | undefined, action: BaseAction) => S`。
 *
 * @example
 * // 假設有 User 實體和相關的 Action Creators (e.g., userActions.addOne, userActions.removeOne)
 * // const initialUserState = getInitialEntityState<User>({ customUserProp: 'defaultValue' });
 * // const userCacheConfig: CacheConfig = { strategy: 'LRU', maxSize: 100 };
 * //
 * // export const userReducer = createReducer(
 * //   initialUserState,
 * //   on(userActions.addOne, (state, action) => addOneMain(action.payload.entity, state)),
 * //   on(userActions.removeOne, (state, action) => removeOneMain(action.payload.id, state)),
 * //   userCacheConfig // 將快取配置作為最後一個參數傳入
 * // );
 */
export function createReducer<S extends ImmutableEntityState<any>>(
    initialState: S,
    ...onsAndCacheConfig: Array<{ actionType: string; reducer: ReducerFn<S, BaseAction> } | CacheConfig>
): (state: S | undefined, action: BaseAction) => S {
    const ons: { actionType: string; reducer: ReducerFn<S, BaseAction> }[] = [];
    let cacheConfig: CacheConfig | undefined = undefined;

    // 分離 on 處理器和快取配置
    onsAndCacheConfig.forEach(arg => {
        if (typeof arg === 'function' || (arg && 'actionType' in arg && 'reducer' in arg)) {
            ons.push(arg as { actionType: string; reducer: ReducerFn<S, BaseAction> });
        } else if (typeof arg === 'object' && arg !== null) { // 假設非 on 處理器的物件即為 CacheConfig
            cacheConfig = arg as CacheConfig;
        }
    });

    const reducerMap = new Map<string, ReducerFn<S, BaseAction>>();
    ons.forEach(o => reducerMap.set(o.actionType, o.reducer));

    // 合併快取配置到初始狀態
    let effectiveInitialState = initialState;
    if (cacheConfig) {
        const currentCacheConfig = initialState.get('_cacheConfig', Immutable.Map()) as Immutable.Map<string, any>;
        effectiveInitialState = initialState.set('_cacheConfig', currentCacheConfig.merge(Immutable.fromJS(cacheConfig))) as S;
        Logger.log('createReducer', `Cache configuration applied for reducer.`, { strategy: effectiveInitialState.getIn(['_cacheConfig', 'strategy']), maxSize: effectiveInitialState.getIn(['_cacheConfig', 'maxSize']) });
    }
    
    // 返回最終的 Reducer 函式
    return (state: S = effectiveInitialState, action: BaseAction): S => {
        const reducer = reducerMap.get(action.type);
        let nextState = reducer ? reducer(state, action) : state; // 執行匹配的 Action 處理器

        // 在每次狀態更新後應用快取淘汰策略
        if (nextState.has('_cacheConfig') && nextState.has('ids') && nextState.has('_cacheMeta')) {
             nextState = applyCacheEvictionStrategy(nextState as any) as S; // any 轉換是為了泛型 T
        }
        return nextState;
    };
}
// #endregion createReducer 和 on 輔助函式

// #region 初始狀態 (使用 Immutable.js) - Initial State Definition (Immutable.js)
/**
 * 獲取實體集合的標準初始 Immutable 狀態。
 * 此狀態結構包含實體本身 (`entities`)、實體 ID 列表 (`ids`)、用於同步的 hash 值 (`_previousHash`, `_currentHash`)、
 * 上次變更的詳細記錄 (`lastSettlement`)，以及用於快取管理的元數據 (`_cacheMeta`, `_cacheConfig`)。
 *
 * @template T 實體的原始型別。在狀態中，實體將被轉換為 `Immutable.Map`。
 * @param additionalState (可選) 一個物件，包含要合併到初始狀態中的額外屬性。
 *                       這些屬性將直接合併到返回的 `Immutable.Map` 的頂層。
 * @returns 一個 `ImmutableEntityState<T>`，代表特定實體集合的初始狀態。
 *
 * @example
 * // const initialUserState = getInitialEntityState<{ userNameVisible: boolean }>({ userNameVisible: true });
 * // console.log(initialUserState.get('userNameVisible')); // true
 * // console.log(initialUserState.getIn(['_cacheConfig', 'maxSize'])); // Infinity (預設值)
 */
export function getInitialEntityState<T>(additionalState: Partial<T> = {}): ImmutableEntityState<T> {
    return Immutable.Map({
        ids: Immutable.List<string>(),
        entities: Immutable.Map<string, Immutable.Map<string, any>>(), // 實體本身也存儲為 Immutable.Map
        _previousHash: null,
        _currentHash: `settlement-${uuidV4()}`, // 初始的當前 hash
        lastSettlement: Immutable.Map({ // 上次結算的詳細資訊
            isChanged: false,          // 本次操作是否改變了狀態
            actionId: null,            // 觸發變更的 Action ID (如果可用)
            dateTime: null,            // 變更發生的時間戳
            create: Immutable.Map<string, Immutable.Map<string, any>>(), // 本次新增的實體
            update: Immutable.Map<string, Immutable.Map<string, any>>(), // 本次更新的實體
            delete: Immutable.Map<string, string>(),                   // 本次刪除的實體 ID
        }),
        _cacheMeta: Immutable.Map<string, Immutable.Map<string, any>>(), // 快取元數據 (例如：lastAccessed)
        _cacheConfig: Immutable.Map({ strategy: 'LRU', maxSize: Infinity }), // 預設快取配置
        ...additionalState, // 合併任何額外的頂層狀態屬性
    });
}
// #endregion 初始狀態

// #region 快取淘汰策略 - Cache Eviction Strategy
/**
 * 內部函式：應用快取淘汰策略到給定的實體狀態。
 * 目前僅實現 LRU (Least Recently Used) 策略，基於 `_cacheConfig` 中的 `maxSize`。
 * 如果啟用了 LRU 且當前實體數量超過 `maxSize`，則會移除最近最少被存取的實體，
 * 直到數量符合 `maxSize`。被移除的實體也會在 `lastSettlement.delete` 中標記。
 *
 * @template T 實體的類型。
 * @param state 當前的 Immutable 實體狀態。
 * @returns 更新後的 Immutable 實體狀態 (可能因淘汰而改變)。
 */
function applyCacheEvictionStrategy<T>(state: ImmutableEntityState<T>): ImmutableEntityState<T> {
    const cacheConfig = state.get('_cacheConfig') as Immutable.Map<string, any>;
    const strategy = cacheConfig.get('strategy') as CacheStrategy;
    const maxSize = cacheConfig.get('maxSize') as number;

    // 僅當策略為 LRU 且 maxSize 是有效的正數時執行
    if (strategy === 'LRU' && Number.isFinite(maxSize) && maxSize > 0) {
        const ids = state.get('ids') as Immutable.List<string>;
        const cacheMeta = state.get('_cacheMeta') as Immutable.Map<string, Immutable.Map<string, any>>;

        if (ids.size > maxSize) {
            const numToEvict = ids.size - maxSize; // 需要淘汰的數量
            
            // 根據 _cacheMeta 中的 lastAccessed 時間戳排序實體 ID (升序，最早的在前)
            const sortedMeta = cacheMeta
                .filter((_meta, id) => ids.includes(id)) // 僅考慮當前 ids 列表中的實體
                .entrySeq() // 轉換為 [ [id, metaData], ... ] 格式
                .sortBy(([_id, metaData]) => metaData.get('lastAccessed') as number) // 按 lastAccessed 排序
                .map(([_id, _metaData]) => _id) // 提取 ID
                .toList();
                
            const idsToEvict = sortedMeta.slice(0, numToEvict); // 選取要淘汰的 ID

            if (idsToEvict.size > 0) {
                Logger.log('Reducer (Cache)', `LRU Eviction: Attempting to evict ${idsToEvict.size} entities.`, { maxSize, currentSize: ids.size, idsToEvict: idsToEvict.toJS() });
                // 使用 withMutations 進行批量更新以提高性能
                return state.withMutations(s => {
                    idsToEvict.forEach(idToEvict => {
                        s.update('ids', currentIds => (currentIds as Immutable.List<string>).filter(id => id !== idToEvict)) // 從 ids 移除
                         .deleteIn(['entities', idToEvict]) // 從 entities 移除
                         .deleteIn(['_cacheMeta', idToEvict]) // 從 _cacheMeta 移除
                         .setIn(['lastSettlement', 'delete', idToEvict], idToEvict) // 記錄到 settlement
                         .setIn(['lastSettlement', 'isChanged'], true); // 標記狀態已更改
                    });
                }) as ImmutableEntityState<T>;
            }
        }
    }
    return state; // 如果無需淘汰或策略不匹配，返回原狀態
}
// #endregion 快取淘汰策略

// #region 狀態操作函式 (使用 Immutable.js) - State Manipulation Functions (Immutable.js)
// 以下 `xxxMain` 函式是實際執行狀態變更的核心邏輯，它們都操作並返回 Immutable 結構。
// 外部傳入的 `entityData` 或 `entitiesData` 假定為普通 JavaScript 對象/陣列，
// 這些函式內部會使用 `Immutable.fromJS()` 將其轉換為 Immutable 結構。
// 快取元數據 (_cacheMeta.lastAccessed) 會在涉及實體新增、讀取或更新的操作中被更新。

/**
 * 內部函式：重置 `lastSettlement` 部分的狀態。
 * @param state 當前 Immutable 狀態。
 * @param action 可選的觸發 Action，用於嘗試獲取 `actionId`。
 * @returns 帶有已重置 `lastSettlement` 的新 Immutable 狀態。
 */
function resetLastSettlement<S extends ImmutableEntityState<any>>(state: S, action?: BaseAction): S {
    const actionId = action && (action as any)['actionId'] ? (action as any)['actionId'] : null;
    return state.set('lastSettlement', Immutable.Map({
        isChanged: false,
        actionId: actionId,
        dateTime: null,
        create: Immutable.Map<string, Immutable.Map<string, any>>(),
        update: Immutable.Map<string, Immutable.Map<string, any>>(),
        delete: Immutable.Map<string, string>(),
    })) as S;
}

/**
 * 內部函式：處理 "Initial" 或 "Reset" 類型的操作，清空實體並重置快取元數據。
 * @param _initialState (未使用，僅為與舊簽名兼容)
 * @param currentProcessingState 當前正在處理的狀態。
 * @returns 操作後的新 Immutable 狀態。
 */
function initialMainInternal<T>(
    _initialState: ImmutableEntityState<T>, // 實際上未使用此參數的數據，主要依賴 currentProcessingState
    currentProcessingState: ImmutableEntityState<T>
): ImmutableEntityState<T> {
    let newState = currentProcessingState;
    newState = newState.setIn(['lastSettlement', 'isChanged'], true);
    const idsToMarkDeleted = newState.get('ids') as Immutable.List<string>;
    idsToMarkDeleted.forEach(id => {
        newState = newState.setIn(['lastSettlement', 'delete', id], id);
    });
    newState = newState.set('entities', Immutable.Map<string, Immutable.Map<string, any>>());
    newState = newState.set('ids', Immutable.List<string>());
    newState = newState.set('_cacheMeta', Immutable.Map<string, Immutable.Map<string, any>>()); // 重置快取元數據
    return newState;
}

/** 內部函式：添加單個實體。 */
function addOneMain<T>(entityData: PlainEntity<T>, state: ImmutableEntityState<T>): ImmutableEntityState<T> {
    const entityId = entityData.id;
    if (state.hasIn(['entities', entityId])) {
        Logger.warn("addOneMain (Immutable)", `Entity with ID ${entityId} already exists. Ignoring add request.`, { isPrint: Main.printMode !== "none" });
        // 即使實體已存在，也更新其 lastAccessed 時間戳，因為它被 "觸摸" 了
        return state.setIn(['_cacheMeta', entityId, 'lastAccessed'], DateTime.now().valueOf()) as ImmutableEntityState<T>;
    }
    const immutableEntity = Immutable.fromJS(entityData); // 將傳入的普通對象轉換為 Immutable
    return state.withMutations(s => {
        s.update('ids', ids => (ids as Immutable.List<string>).push(entityId))
         .setIn(['entities', entityId], immutableEntity)
         .setIn(['lastSettlement', 'isChanged'], true)
         .setIn(['lastSettlement', 'create', entityId], immutableEntity)
         .setIn(['_cacheMeta', entityId], Immutable.Map({ lastAccessed: DateTime.now().valueOf() })); // 記錄訪問時間
    }) as ImmutableEntityState<T>;
}

/** 內部函式：添加多個實體。 */
function addManyMain<T>(entitiesData: PlainEntity<T>[], state: ImmutableEntityState<T>): ImmutableEntityState<T> {
    const uniqueEntitiesData = _.uniqBy(entitiesData, 'id'); // 使用 Lodash 對普通對象數組去重

    return state.withMutations(s => {
        uniqueEntitiesData.forEach(entityData => {
            const entityId = entityData.id;
            if (s.hasIn(['entities', entityId])) {
                Logger.warn("addManyMain (Immutable)", `Entity with ID ${entityId} already exists during addMany. Ignoring this entity.`, { isPrint: Main.printMode !== "none" });
                s.setIn(['_cacheMeta', entityId, 'lastAccessed'], DateTime.now().valueOf()); // 更新訪問時間
            } else {
                const immutableEntity = Immutable.fromJS(entityData);
                s.update('ids', ids => (ids as Immutable.List<string>).push(entityId))
                 .setIn(['entities', entityId], immutableEntity)
                 .setIn(['lastSettlement', 'isChanged'], true)
                 .setIn(['lastSettlement', 'create', entityId], immutableEntity)
                 .setIn(['_cacheMeta', entityId], Immutable.Map({ lastAccessed: DateTime.now().valueOf() }));
            }
        });
    }) as ImmutableEntityState<T>;
}

/** 內部函式：設定 (添加或替換) 單個實體。 */
function setOneMain<T>(entityData: PlainEntity<T>, state: ImmutableEntityState<T>): ImmutableEntityState<T> {
    const entityId = entityData.id;
    const immutableEntity = Immutable.fromJS(entityData);
    const oldEntity = state.getIn(['entities', entityId]);

    let newState = state;
    if (!oldEntity || !Immutable.is(oldEntity, immutableEntity)) { // 僅當實體不存在或內容有變更時操作
        newState = state.withMutations(s => {
            s.setIn(['entities', entityId], immutableEntity)
             .setIn(['lastSettlement', 'isChanged'], true);
            if (!oldEntity) { // 如果是新實體
                if (!(s.get('ids') as Immutable.List<string>).includes(entityId)) {
                    s.update('ids', ids => (ids as Immutable.List<string>).push(entityId));
                }
                s.setIn(['lastSettlement', 'create', entityId], immutableEntity);
            } else { // 如果是更新現有實體
                s.setIn(['lastSettlement', 'update', entityId], immutableEntity);
            }
            s.deleteIn(['lastSettlement', 'delete', entityId]); // 如果之前標記為刪除，則取消
        }) as ImmutableEntityState<T>;
    }
    // 總是指更新訪問時間
    return newState.setIn(['_cacheMeta', entityId, 'lastAccessed'], DateTime.now().valueOf()) as ImmutableEntityState<T>;
}

/** 內部函式：設定 (添加或替換) 多個實體。 */
function setManyMain<T>(entitiesData: PlainEntity<T>[], state: ImmutableEntityState<T>): ImmutableEntityState<T> {
    const uniqueEntitiesData = _.uniqBy(entitiesData, 'id');

    return state.withMutations(s => {
        uniqueEntitiesData.forEach(entityData => {
            const entityId = entityData.id;
            const immutableEntity = Immutable.fromJS(entityData);
            const oldEntity = s.getIn(['entities', entityId]);

            if (!oldEntity || !Immutable.is(oldEntity, immutableEntity)) {
                 s.setIn(['entities', entityId], immutableEntity)
                 .setIn(['lastSettlement', 'isChanged'], true);

                if (!oldEntity) {
                    if (!(s.get('ids') as Immutable.List<string>).includes(entityId)) {
                        s.update('ids', ids => (ids as Immutable.List<string>).push(entityId));
                    }
                    s.setIn(['lastSettlement', 'create', entityId], immutableEntity);
                } else {
                    s.setIn(['lastSettlement', 'update', entityId], immutableEntity);
                }
                s.deleteIn(['lastSettlement', 'delete', entityId]);
            }
            s.setIn(['_cacheMeta', entityId, 'lastAccessed'], DateTime.now().valueOf());
        });
        // 可選：確保 ids 列表與 entities 的鍵同步 (取決於業務邏輯的嚴格性)
    }) as ImmutableEntityState<T>;
}

/** 內部函式：替換所有實體。 */
function setAllMain<T>(entitiesData: PlainEntity<T>[], state: ImmutableEntityState<T>): ImmutableEntityState<T> {
    return state.withMutations(s => {
        // 標記舊實體為刪除 (在 settlement 中)
        (s.get('ids') as Immutable.List<string>).forEach(id => {
            s.setIn(['lastSettlement', 'delete', id], id);
        });
        // 清空當前實體、ID 列表和快取元數據
        s.set('entities', Immutable.Map<string, Immutable.Map<string, any>>())
         .set('ids', Immutable.List<string>())
         .set('_cacheMeta', Immutable.Map<string, Immutable.Map<string, any>>()) 
         .setIn(['lastSettlement', 'isChanged'], true);

        // 添加新實體
        const uniqueEntitiesData = _.uniqBy(entitiesData, 'id');
        uniqueEntitiesData.forEach(entityData => {
            const entityId = entityData.id;
            const immutableEntity = Immutable.fromJS(entityData);
            s.update('ids', ids => (ids as Immutable.List<string>).push(entityId))
             .setIn(['entities', entityId], immutableEntity)
             .setIn(['lastSettlement', 'create', entityId], immutableEntity) // 所有新實體都記錄為 create
             .setIn(['_cacheMeta', entityId], Immutable.Map({ lastAccessed: DateTime.now().valueOf() }))
             .deleteIn(['lastSettlement', 'delete', entityId]); // 如果新實體ID與舊ID衝突，從delete中移除
        });
    }) as ImmutableEntityState<T>;
}

/** 內部函式：移除單個實體。 */
function removeOneMain<T>(idToRemove: string, state: ImmutableEntityState<T>): ImmutableEntityState<T> {
    if (!state.hasIn(['entities', idToRemove])) {
        return state; // 如果實體不存在，直接返回原狀態
    }
    return state.withMutations(s => {
        s.deleteIn(['entities', idToRemove])
         .update('ids', ids => (ids as Immutable.List<string>).filter(id => id !== idToRemove))
         .deleteIn(['_cacheMeta', idToRemove]) // 同時從快取元數據中移除
         .setIn(['lastSettlement', 'isChanged'], true)
         .setIn(['lastSettlement', 'delete', idToRemove], idToRemove);
    }) as ImmutableEntityState<T>;
}

/** 內部函式：移除多個實體。 */
function removeManyMain<T>(idsToRemove: string[], state: ImmutableEntityState<T>): ImmutableEntityState<T> {
    const uniqueIdsToRemove = _.uniq(idsToRemove);

    return state.withMutations(s => {
        uniqueIdsToRemove.forEach(id => {
            if (s.hasIn(['entities', id])) {
                s.deleteIn(['entities', id])
                 .deleteIn(['_cacheMeta', id]) 
                 .setIn(['lastSettlement', 'isChanged'], true)
                 .setIn(['lastSettlement', 'delete', id], id);
            }
        });
        s.update('ids', ids => (ids as Immutable.List<string>).filter(id => !uniqueIdsToRemove.includes(id)));
    }) as ImmutableEntityState<T>;
}

/** 內部函式：移除所有實體。 */
function removeAllMain<T>(state: ImmutableEntityState<T>): ImmutableEntityState<T> {
    if ((state.get('ids') as Immutable.List<string>).isEmpty() && (state.get('entities') as Immutable.Map<string, any>).isEmpty()) {
        return state; // 如果已經為空，無需操作
    }
    return state.withMutations(s => {
        (s.get('ids') as Immutable.List<string>).forEach(id => {
            s.setIn(['lastSettlement', 'delete', id], id);
        });
        s.set('entities', Immutable.Map<string, Immutable.Map<string, any>>())
         .set('ids', Immutable.List<string>())
         .set('_cacheMeta', Immutable.Map<string, Immutable.Map<string, any>>()) 
         .setIn(['lastSettlement', 'isChanged'], true);
    }) as ImmutableEntityState<T>;
}

/** 內部函式：更新單個實體 (部分更新)。 */
function updateOneMain<T>(entityUpdateData: PlainEntityUpdate<T>, state: ImmutableEntityState<T>): ImmutableEntityState<T> {
    const entityId = entityUpdateData.id;
    if (!state.hasIn(['entities', entityId])) {
        Logger.warn("updateOneMain (Immutable)", `Entity with ID ${entityId} not found. Ignoring update request.`, { isPrint: Main.printMode !== "none" });
        return state;
    }
    // 排除 'id' 屬性進行 merge，因為 id 不應被修改
    const updatePayload = Immutable.fromJS(Object.assign({}, entityUpdateData, { id: undefined })); 
    
    const oldEntity = state.getIn(['entities', entityId]) as Immutable.Map<string, any>;
    // 僅當 merge 後的實體與原實體不同時才執行更新
    const mergedEntityPreview = oldEntity.merge(updatePayload);

    let newState = state;
    if (!Immutable.is(oldEntity, mergedEntityPreview)) {
        newState = state.withMutations(s => {
            s.updateIn(['entities', entityId], entity => (entity as Immutable.Map<string, any>).merge(updatePayload))
             .setIn(['lastSettlement', 'isChanged'], true)
             .setIn(['lastSettlement', 'update', entityId], s.getIn(['entities', entityId])); // 記錄更新後的實體
        }) as ImmutableEntityState<T>;
    }
    // 總是指更新訪問時間
    return newState.setIn(['_cacheMeta', entityId, 'lastAccessed'], DateTime.now().valueOf()) as ImmutableEntityState<T>;
}

/** 內部函式：更新多個實體 (部分更新)。 */
function updateManyMain<T>(entityUpdatesData: PlainEntityUpdate<T>[], state: ImmutableEntityState<T>): ImmutableEntityState<T> {
    const uniqueEntityUpdatesData = _.uniqBy(entityUpdatesData, 'id');

    return state.withMutations(s => {
        uniqueEntityUpdatesData.forEach(updateData => {
            const entityId = updateData.id;
            if (!s.hasIn(['entities', entityId])) {
                Logger.warn("updateManyMain (Immutable)", `Entity with ID ${entityId} not found during updateMany. Ignoring this update.`, { isPrint: Main.printMode !== "none" });
                return; // 跳過不存在的實體
            }
            const updatePayload = Immutable.fromJS(Object.assign({}, updateData, { id: undefined }));
            const oldEntity = s.getIn(['entities', entityId]) as Immutable.Map<string, any>;
            const mergedEntityPreview = oldEntity.merge(updatePayload);

            if (!Immutable.is(oldEntity, mergedEntityPreview)) { // 僅在有實際變更時操作
                 s.updateIn(['entities', entityId], entity => (entity as Immutable.Map<string, any>).merge(updatePayload))
                 .setIn(['lastSettlement', 'isChanged'], true)
                 .setIn(['lastSettlement', 'update', entityId], s.getIn(['entities', entityId]));
            }
            s.setIn(['_cacheMeta', entityId, 'lastAccessed'], DateTime.now().valueOf()); // 更新訪問時間
        });
    }) as ImmutableEntityState<T>;
}

/** 內部函式：添加或更新 (Upsert) 單個實體。 */
function upsertOneMain<T>(entityData: PlainEntity<T>, state: ImmutableEntityState<T>): ImmutableEntityState<T> {
    const entityId = entityData.id;
    const immutableEntity = Immutable.fromJS(entityData);
    const existingEntity = state.getIn(['entities', entityId]) as Immutable.Map<string, any> | undefined;

    let newState = state;
    if (existingEntity) { // 如果實體已存在，則為更新操作
        if (!Immutable.is(existingEntity, immutableEntity)) { // 僅在內容有變更時更新
            newState = state.withMutations(s => {
                s.setIn(['entities', entityId], immutableEntity)
                 .setIn(['lastSettlement', 'isChanged'], true)
                 .setIn(['lastSettlement', 'update', entityId], immutableEntity)
                 .deleteIn(['lastSettlement', 'create', entityId]) // 如果在同一次結算中先 create 後 update
                 .deleteIn(['lastSettlement', 'delete', entityId]); // 如果之前標記為刪除，則取消
            }) as ImmutableEntityState<T>;
        }
    } else { // 如果實體不存在，則為添加操作
        newState = state.withMutations(s => {
            if (!(s.get('ids') as Immutable.List<string>).includes(entityId)) { // 避免 ids 重複
                s.update('ids', ids => (ids as Immutable.List<string>).push(entityId));
            }
            s.setIn(['entities', entityId], immutableEntity)
             .setIn(['lastSettlement', 'isChanged'], true)
             .setIn(['lastSettlement', 'create', entityId], immutableEntity)
             .deleteIn(['lastSettlement', 'delete', entityId]);
        }) as ImmutableEntityState<T>;
    }
    // 更新訪問時間
    return newState.setIn(['_cacheMeta', entityId, 'lastAccessed'], DateTime.now().valueOf()) as ImmutableEntityState<T>;
}

/** 內部函式：添加或更新 (Upsert) 多個實體。 */
function upsertManyMain<T>(entitiesData: PlainEntity<T>[], state: ImmutableEntityState<T>): ImmutableEntityState<T> {
    const uniqueEntitiesData = _.uniqBy(entitiesData, 'id'); // 先對傳入的普通對象數組去重
    
    return state.withMutations(s => {
        uniqueEntitiesData.forEach(entityData => {
            const entityId = entityData.id;
            const immutableEntity = Immutable.fromJS(entityData);
            const existingEntity = s.getIn(['entities', entityId]) as Immutable.Map<string, any> | undefined;

            if (existingEntity) { 
                if (!Immutable.is(existingEntity, immutableEntity)) { // 僅在內容有變更時更新
                    s.setIn(['entities', entityId], immutableEntity)
                     .setIn(['lastSettlement', 'isChanged'], true)
                     .setIn(['lastSettlement', 'update', entityId], immutableEntity)
                     .deleteIn(['lastSettlement', 'create', entityId])
                     .deleteIn(['lastSettlement', 'delete', entityId]);
                }
            } else { 
                if (!(s.get('ids') as Immutable.List<string>).includes(entityId)) {
                    s.update('ids', ids => (ids as Immutable.List<string>).push(entityId));
                }
                s.setIn(['entities', entityId], immutableEntity)
                 .setIn(['lastSettlement', 'isChanged'], true)
                 .setIn(['lastSettlement', 'create', entityId], immutableEntity)
                 .deleteIn(['lastSettlement', 'delete', entityId]);
            }
            s.setIn(['_cacheMeta', entityId, 'lastAccessed'], DateTime.now().valueOf()); // 更新訪問時間
        });
    }) as ImmutableEntityState<T>;
}

/**
 * 內部輔助函式：在狀態更新後完成收尾工作。
 * 包括更新 hash 值、記錄 Action ID 和時間戳到 `lastSettlement`，以及日誌記錄。
 * @param newState 更新後的 Immutable 狀態。
 * @param oldState 更新前的 Immutable 狀態。
 * @param action 觸發更新的 Action。
 * @returns 最終的 Immutable 狀態。
 */
function finalizeStateUpdate<S extends ImmutableEntityState<any>>(
    newState: S,
    oldState: S, 
    action: BaseAction
): S {
    // 如果 lastSettlement.isChanged 為 false，表示本次操作未實際改變狀態，直接返回舊狀態
    if (!newState.getIn(['lastSettlement', 'isChanged'])) {
        Logger.log(
            'Reducer (Immutable)',
            `No change after action(${action.type}):`,
            { isPrint: Main.printMode === "detail", payload: action.payload } 
        );
        return oldState; 
    }

    let finalState = newState;
    // 如果不是 Initial Action (通常 Initial Action 不應觸發 hash 變更，除非是首次加載)
    // 這裡使用 'anyReducerNameForComparison' 作為佔位符，實際比較應基於 Action Type 本身
    if (action.type !== initialActionCreator('anyReducerNameForComparison').type) {
        finalState = finalState.set('_previousHash', finalState.get('_currentHash') || null)
                               .set('_currentHash', `settlement-${uuidV4()}`) as S;
    }
    
    // 嘗試從 action 中獲取 actionId (如果有的話)，否則保留 lastSettlement 中可能已存在的 actionId
    const actionId = action && (action as any)['actionId'] ? (action as any)['actionId'] : finalState.getIn(['lastSettlement', 'actionId']);
    
    finalState = finalState.setIn(['lastSettlement', 'actionId'], actionId)
                           .setIn(['lastSettlement', 'dateTime'], DateTime.now().valueOf()) as S;

    Logger.log('Reducer (Immutable)', `State updated for action ${action.type}.`, {
        execTime: finalState.getIn(['lastSettlement', 'dateTime']), // 記錄執行時間戳
        isPrint: Main.printMode === "detail"
    });
    return finalState;
}

// #endregion 狀態操作函式

// 備註：Lodash (_.uniqBy) 仍然用於在將普通 JavaScript 對象數組傳遞給
// `xxxManyMain` 函式之前進行預處理（去重）。這是因為這些數據來自外部，
// 在轉換為 Immutable 結構之前確保其唯一性是合理的。
// 如果輸入數據本身已是 Immutable.List，則需要使用 Immutable.js 的去重方法。
