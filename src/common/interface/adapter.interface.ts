// src/common/interface/adapter.interface.ts
// 此檔案定義了與實體狀態 (EntityState) 和實體適配器 (EntityAdapter) 相關的 TypeScript 介面。
// 這些介面主要用於規範 Reducer 中實體集合的狀態結構以及對這些實體進行操作的標準模式。

// 假設 Cache 類型，若在其他地方定義，則應導入；若不再使用，則 ToRedisOptions 可能也已過時。
// interface Cache { /* ... Cache 服務的介面定義 ... */ }

/**
 * 代表一個標準化的實體狀態 (Entity State) 結構。
 * 常用於 Redux-like 的 Store 中，用於管理一組相同類型的實體數據。
 *
 * @template T 實體的類型。
 */
export interface EntityState<T> {
    /** 
     * 存儲所有實體 ID 的陣列，通常用於維持實體的順序或快速遍歷 ID。
     * @example ['id1', 'id2', 'id3']
     */
    ids: string[];

    /** 
     * 一個以實體 ID 為鍵，實體物件為值的字典 (或稱為 Map/Lookup Table)。
     * 用於快速通過 ID 查找實體。
     * @example { 'id1': user1, 'id2': user2 }
     */
    entities: { [id: string]: T }; // 使用 string 作為鍵類型，更通用

    /** 
     * 上一個狀態的校驗 hash 值。
     * 用於比較狀態是否發生變更，或在同步場景下檢測數據一致性。
     * 在 `src/common/reducer.ts` 中，此屬性已改為 `string | null` 以允許初始狀態為 null。
     */
    _previousHash: string | null; 

    /** 
     * 當前狀態的校驗 hash 值。
     * 通常在狀態變更後重新計算。
     */
    _currentHash: string;

    /** 
     * 記錄導致當前狀態的最後一次“結算”操作的詳細資訊。
     * “結算”可以理解為一次或多次連續的 Action 處理完成後，狀態達到一個新的穩定點。
     */
    lastSettlement: LastSettlement<T>;

    // 以下是被註釋掉的舊屬性，可能已不再使用或被其他機制取代。
    // entitiesList?: T[]; // 可能用於需要數組形式實體列表的場景，但通常可從 entities 和 ids 派生。
    // _hash?: string; // 可能與 _currentHash 或 _previousHash 功能重疊。

    // 在 `reducer.ts` 中，`ImmutableEntityState` 還引入了 `_cacheMeta` 和 `_cacheConfig`。
    // 如果此 `EntityState` 介面旨在描述 Reducer 狀態的純 JS 形式 (在 Immutable 轉換之前/之後)，
    // 則可以考慮是否也在此處包含它們（可能是可選的）。
    // _cacheMeta?: { [id: string]: { lastAccessed: number; /* 其他元數據 */ } };
    // _cacheConfig?: { strategy: string; maxSize: number; /* 其他配置 */ };
}

/**
 * 記錄一次“結算 (Settlement)”操作中發生的具體變更。
 * 包含了新增、更新和刪除的實體資訊。
 *
 * @template T 實體的類型。
 */
export interface LastSettlement<T> {
    /** 
     * 標記此次結算是否實際導致了狀態變更。
     * 如果為 `false`，則 `create`, `update`, `delete` 中的集合通常為空。
     */
    isChanged: boolean;

    /** 
     * 觸發此次結算的主要 Action 的 ID (如果可用)。
     * 由於 `src/common/action.ts` 中的 Action 不再預設包含 `actionId`，
     * 此欄位可能為 `null` 或來自 Action payload 中的特定識別碼。
     */
    actionId: string | null; // 改為 string | null 以適應新的 Action 設計

    /** 
     * 本次結算中新增的實體。
     * 以實體 ID 為鍵，實體物件為值。
     */
    create: { [id: string]: T };

    /** 
     * 本次結算中更新的實體。
     * 以實體 ID 為鍵，更新後的實體物件為值。
     */
    update: { [id: string]: T };

    /** 
     * 本次結算中刪除的實體的 ID。
     * 以實體 ID 為鍵，被刪除實體的 ID 為值 (或者可以是標記，如 `true`)。
     */
    delete: { [id: string]: string }; // 值通常是被刪除的 ID 本身

    /** 
     * 結算完成時的時間戳 (例如，使用 `DateTime.now().valueOf()`)。
     */
    dateTime: number | null; // 改為 number | null，初始可能為 null

    // ignore?: string[]; // 舊的可選屬性，用途不明確，可能已廢棄。
}

/**
 * @deprecated 此介面與特定的後端快取 (如 Redis) 相關，可能不再適用於通用的前端狀態管理核心。
 *             如果需要與後端同步，應考慮更通用的機制或在特定服務中定義。
 * 為需要將狀態操作結果同步到 Redis 等外部快取的函式提供的選項。
 */
export interface ToRedisOptions {
    /** Reducer 的名稱，可能用作 Redis 中的鍵前綴或分組。 */
    reducerName: string;
    /** 
     * 快取服務的實例。`Cache` 類型未在此檔案中定義，應為一個包含 Redis 操作方法的服務介面。
     * @example
     * interface Cache {
     *   json: {
     *     get: (key: string) => Promise<any>;
     *     set: (key: string, path: string, value: any) => Promise<void>;
     *     // ... 其他 Redis JSON 操作
     *   };
     *   // ... 其他快取操作
     * }
     */
    cacheService: any; // 使用 any 替代未定義的 Cache 類型
}

/**
 * @deprecated `EntityAdapter` 的概念源自 NgRx Entity 或類似模式，
 *             在當前的 `reducer.ts` 實現中，其功能已由 `xxxMain` 輔助函式
 *             和 `createReducer` 本身提供。此介面定義可能已過時。
 *             如果未來需要標準化的 Adapter 物件，應重新評估其方法和用途。
 * 實體適配器 (Entity Adapter) 的介面。
 * Entity Adapter 提供了一組用於操作標準化實體狀態 (EntityState) 的函式。
 *
 * @template T 實體的類型。
 */
export interface EntityAdapter<T> {
    /** 
     * 獲取指定實體類型的初始狀態。
     * @returns 一個符合 `EntityState<T>` 結構的初始狀態物件。
     */
    getInitialState(): EntityState<T>;
    /**
     * 獲取初始狀態，並可以選擇性地與一個已有的狀態片段合併。
     * @param state 一個物件，包含要與預設初始狀態合併的額外狀態屬性。
     * @returns 一個合併後的初始狀態物件。
     */
    getInitialState<S extends object>(state: S): EntityState<T> & S;

    // 以下是被註解掉的方法，它們代表了 Entity Adapter 模式中常見的 CRUD 操作。
    // 在當前的 `reducer.ts` (使用 Immutable.js 和 xxxMain 輔助函式) 中，
    // 這些操作的邏輯已直接整合到 Reducer 的 case handlers 中。
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
