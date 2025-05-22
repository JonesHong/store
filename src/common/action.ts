// src/common/action.ts
// 此檔案定義了應用程式中 Action 的標準結構和建立方式。
// Action 是描述應用程式中發生事件的普通物件，例如使用者互動、API 回應或系統事件。
// `createAction` 函式提供了一種型別安全的方式來定義和建立 Action。

import { Settlement } from "./interface/store.interface"; // 用於 CompareSettlement Action

// #region Action 基礎類型定義

/**
 * Action 的基礎介面。
 * @template T Action 類型的字串常值。
 */
export interface Action<T extends string = string> {
    /** Action 的唯一類型識別碼。 */
    readonly type: T;
}

/**
 * 帶有 payload 的 Action 介面。
 * @template T Action 類型的字串常值。
 * @template P payload 的資料類型。
 */
export interface ActionWithPayload<T extends string, P> extends Action<T> {
    /** Action 攜帶的資料。 */
    readonly payload: P;
}

/**
 * Action Creator 函式的型別定義。
 * - 若 `P` (payload) 為 `void`，則 Action Creator 不需要參數。
 * - 否則，Action Creator 需要一個 `payload` 參數。
 * 每個 Action Creator 也直接附加其 `type` 屬性，方便在 Reducer 或 Effect 中直接引用 Action 型別。
 * @template T Action 類型的字串常值。
 * @template P payload 的資料類型，預設為 `void`。
 */
export type ActionCreator<T extends string, P = void> = P extends void
    ? (() => Action<T>) & { type: T } // 不需要 payload 的 Action Creator
    : ((payload: P) => ActionWithPayload<T, P>) & { type: T }; // 需要 payload 的 Action Creator

// #endregion Action 基礎類型定義

// #region createAction 函式

/**
 * 建立一個 Action Creator 函式。
 * 此函式有助於標準化 Action 的建立過程，並提供型別檢查。
 *
 * @template T Action 的唯一類型字串 (例如 `"[User] Add User"`)。
 * @template P Action payload 的類型。如果 Action 沒有 payload，則 P 應為 `void` (預設值)。
 * @param type Action 的類型字串。
 * @returns 一個 Action Creator 函式。
 *          如果 `P` 為 `void`，返回的函式不接受參數。
 *          如果 `P` 不是 `void`，返回的函式接受一個型別為 `P` 的 `payload` 參數。
 *          Action Creator 函式本身也帶有 `type` 屬性，可以直接引用 (例如 `addUser.type`)。
 * @example
 * // 不需要 payload 的 Action
 * const userLogout = createAction('[User] Logout');
 * const action = userLogout(); // action = { type: "[User] Logout" }
 *
 * // 需要 payload 的 Action
 * interface User { id: string; name: string; }
 * const addUser = createAction<"[User] Add User", User>('[User] Add User');
 * const actionWithPayload = addUser({ id: '1', name: 'John Doe' });
 * // actionWithPayload = { type: "[User] Add User", payload: { id: '1', name: 'John Doe' } }
 */
export function createAction<T extends string, P = void>(type: T): ActionCreator<T, P> {
    const actionCreator = (payload?: P) => {
        if (payload !== undefined) {
            return { type, payload };
        }
        return { type };
    };
    actionCreator.type = type; // 將 type 直接附加到 actionCreator 函式上，方便靜態引用
    return actionCreator as ActionCreator<T, P>;
}

// #endregion createAction 函式

// #region Default (System-level) Actions - 預設的系統級別 Actions

/**
 * 預設 Action 的類型常值集合。
 * 這些 Action 通常用於表示系統級別的事件。
 */
const DefaultActionTypes = {
    /** 表示系統初始化完成的 Action。 */
    SystemInitiate: "[Default] System Initiate",
    /** 表示發生錯誤時的回應 Action。 */
    ErrorResponse: "[Default] Error Response",
    /** 表示系統狀態從快取中恢復的 Action。 */
    SystemRestoreByCache: "[Default] System Restore By Cache",
    /** 表示觀察到資料包丟失的 Action (通常用於網路同步場景)。 */
    PacketLossObserved: "[Default] Packet Loss Observed",
} as const; // `as const` 用於將物件的屬性變為 readonly literal types

/** Action Creator: 系統初始化。 */
export const systemInitiate = createAction(DefaultActionTypes.SystemInitiate);

/**
 * Action Creator: 錯誤回應。
 * @param payload 包含錯誤詳細資訊的物件。
 * @param payload.failedAction 可選，導致錯誤的原始 Action。
 * @param payload.fromDir 可選，錯誤發生的目錄或模組。
 * @param payload.error 錯誤訊息或錯誤物件 (建議使用 string 或特定錯誤型別)。
 * @param payload.descriptions 可選，錯誤的額外描述。
 * @param payload.options 可選，其他與錯誤相關的選項。
 */
export const errorResponse = createAction<typeof DefaultActionTypes.ErrorResponse, {
    failedAction?: Action<any>;
    fromDir?: string;
    error: string; // 為了型別安全，從 any 改為 string。若需更複雜錯誤，可定義為 unknown 或特定錯誤型別。
    descriptions?: string;
    options?: any;
}>(DefaultActionTypes.ErrorResponse);

/**
 * Action Creator: 系統從快取恢復。
 * @param payload 包含從快取中恢復的 Store 狀態。
 * @param payload.storeState 恢復的 Store 狀態。
 */
export const systemRestoreByCache = createAction<typeof DefaultActionTypes.SystemRestoreByCache, {
    storeState: any; // 狀態類型應盡可能具體，這裡用 any 作為通用示例
}>(DefaultActionTypes.SystemRestoreByCache);

/**
 * Action Creator: 觀察到資料包丟失。
 * @param payload 包含資料包丟失相關資訊的物件。
 * @param payload.reducerName 發生資料包丟失的 Reducer 名稱。
 * @param payload._currentHash Reducer 當前的 hash 值。
 */
export const packetLossObserved = createAction<typeof DefaultActionTypes.PacketLossObserved, {
    reducerName: string;
    _currentHash: string;
}>(DefaultActionTypes.PacketLossObserved);

// #endregion Default (System-level) Actions

// #region Common Entity Actions - 通用的實體操作 Actions

/**
 * 通用實體 Action 的基礎類型常值集合。
 * 這些 Action 通常與特定實體 (Reducer) 的 CRUD 操作相關。
 * 實際的 Action Type 會結合 Reducer 名稱，例如 `"[User] Add One"`。
 */
const CommonActionTypes = {
    /** 初始化實體狀態。 */
    Initial: '[Default] Initial',
    /** 添加單個實體。 */
    AddOne: '[Default] Add One',
    /** 添加多個實體。 */
    AddMany: '[Default] Add Many',
    /** 設定 (添加或替換) 單個實體。 */
    SetOne: '[Default] Set One',
    /** 設定 (添加或替換) 多個實體。 */
    SetMany: '[Default] Set Many',
    /** 設定 (替換) 所有實體。 */
    SetAll: '[Default] Set All',
    /** 移除單個實體。 */
    RemoveOne: '[Default] Remove One',
    /** 移除多個實體。 */
    RemoveMany: '[Default] Remove Many',
    /** 移除所有實體。 */
    RemoveAll: '[Default] Remove All',
    /** 更新單個實體 (部分更新)。 */
    UpdateOne: '[Default] Update One',
    /** 更新多個實體 (部分更新)。 */
    UpdateMany: '[Default] Update Many',
    /** 添加或更新 (Upsert) 單個實體。 */
    UpsertOne: '[Default] Upsert One',
    /** 添加或更新 (Upsert) 多個實體。 */
    UpsertMany: '[Default] Upsert Many',
    /** 比較並同步結算狀態 (通常用於客戶端與伺服器狀態同步)。 */
    CompareSettlement: "[Default] Compare Settlement",
} as const;

/**
 * 輔助函式：產生特定於實體的 Action Type 字串。
 * 例如：`createEntityActionType('User', 'Add One')` 返回 `"[User] Add One"`。
 * 此函式取代了舊的 `replaceDefaultToEntity` 邏輯。
 * @template R Reducer 名稱的字串常值類型。
 * @template A Action 名稱的字串常值類型。
 * @param reducerName Reducer 的名稱 (例如 "User")。
 * @param actionName Action 的名稱 (例如 "Add One")。
 * @returns 格式化的 Action Type 字串，例如 `"[ReducerName] ActionName"`。
 */
function createEntityActionType<R extends string, A extends string>(reducerName: R, actionName: A): `[${Capitalize<R>}] ${A}` {
    const capitalizedReducerName = (reducerName.charAt(0).toUpperCase() + reducerName.slice(1)) as Capitalize<R>;
    return `[${capitalizedReducerName}] ${actionName}`;
}

// 備註：以下通用 Action Creators 的設計中，`reducerName` 仍然作為 payload 的一部分。
// 這是為了與現有結構保持一致，未來在重構 Reducer 時可以考慮將 `reducerName`
// 完全整合到 Action Type 中，從而使 payload 更純粹地關注數據。
// 例如：`createAction<`[${SomeReducer}] Add One`, { entity: any }>(`[${SomeReducer}] Add One`)`

/**
 * 建立一個特定 Reducer 的 "Initial" Action Creator。
 * @template R Reducer 名稱的類型。
 * @param reducerName Reducer 的名稱。
 */
export const initial = <R extends string>(reducerName: R) =>
    createAction<`[${Capitalize<R>}] Initial`, { reducerName: R }>(createEntityActionType(reducerName, CommonActionTypes.Initial.replace('[Default] ', '')));

/**
 * 建立一個特定 Reducer 的 "AddOne" Action Creator。
 * @template R Reducer 名稱的類型。
 * @template E 實體的類型，預設為 `any`。
 * @param reducerName Reducer 的名稱。
 */
export const addOne = <R extends string, E = any>(reducerName: R) =>
    createAction<`[${Capitalize<R>}] Add One`, { reducerName: R, entity: E }>(createEntityActionType(reducerName, CommonActionTypes.AddOne.replace('[Default] ', '')));

/**
 * 建立一個特定 Reducer 的 "AddMany" Action Creator。
 * @template R Reducer 名稱的類型。
 * @template E 實體的類型，預設為 `any`。
 * @param reducerName Reducer 的名稱。
 */
export const addMany = <R extends string, E = any>(reducerName: R) =>
    createAction<`[${Capitalize<R>}] Add Many`, { reducerName: R, entities: E[] }>(createEntityActionType(reducerName, CommonActionTypes.AddMany.replace('[Default] ', '')));

/**
 * 建立一個特定 Reducer 的 "SetOne" Action Creator。
 * @template R Reducer 名稱的類型。
 * @template E 實體的類型，預設為 `any`。
 * @param reducerName Reducer 的名稱。
 */
export const setOne = <R extends string, E = any>(reducerName: R) =>
    createAction<`[${Capitalize<R>}] Set One`, { reducerName: R, entity: E }>(createEntityActionType(reducerName, CommonActionTypes.SetOne.replace('[Default] ', '')));

/**
 * 建立一個特定 Reducer 的 "SetMany" Action Creator。
 * @template R Reducer 名稱的類型。
 * @template E 實體的類型，預設為 `any`。
 * @param reducerName Reducer 的名稱。
 */
export const setMany = <R extends string, E = any>(reducerName: R) =>
    createAction<`[${Capitalize<R>}] Set Many`, { reducerName: R, entities: E[] }>(createEntityActionType(reducerName, CommonActionTypes.SetMany.replace('[Default] ', '')));

/**
 * 建立一個特定 Reducer 的 "SetAll" Action Creator。
 * @template R Reducer 名稱的類型。
 * @template E 實體的類型 (或實體集合的類型)，預設為 `any`。
 * @param reducerName Reducer 的名稱。
 */
export const setAll = <R extends string, E = any>(reducerName: R) =>
    createAction<`[${Capitalize<R>}] Set All`, { reducerName: R, entities: E }>(createEntityActionType(reducerName, CommonActionTypes.SetAll.replace('[Default] ', ''))); // entities can be an array or a map

/**
 * 建立一個特定 Reducer 的 "RemoveOne" Action Creator。
 * @template R Reducer 名稱的類型。
 * @param reducerName Reducer 的名稱。
 */
export const removeOne = <R extends string>(reducerName: R) =>
    createAction<`[${Capitalize<R>}] Remove One`, { reducerName: R, id: string }>(createEntityActionType(reducerName, CommonActionTypes.RemoveOne.replace('[Default] ', '')));

/**
 * 建立一個特定 Reducer 的 "RemoveMany" Action Creator。
 * @template R Reducer 名稱的類型。
 * @param reducerName Reducer 的名稱。
 */
export const removeMany = <R extends string>(reducerName: R) =>
    createAction<`[${Capitalize<R>}] Remove Many`, { reducerName: R, ids: string[] }>(createEntityActionType(reducerName, CommonActionTypes.RemoveMany.replace('[Default] ', '')));

/**
 * 建立一個特定 Reducer 的 "RemoveAll" Action Creator。
 * @template R Reducer 名稱的類型。
 * @param reducerName Reducer 的名稱。
 */
export const removeAll = <R extends string>(reducerName: R) =>
    createAction<`[${Capitalize<R>}] Remove All`, { reducerName: R }>(createEntityActionType(reducerName, CommonActionTypes.RemoveAll.replace('[Default] ', '')));

/**
 * 建立一個特定 Reducer 的 "UpdateOne" Action Creator。
 * @template R Reducer 名稱的類型。
 * @template E 實體更新的類型 (通常是 `Partial<EntityType> & { id: string }`)，預設為 `any`。
 * @param reducerName Reducer 的名稱。
 */
export const updateOne = <R extends string, E = any>(reducerName: R) =>
    createAction<`[${Capitalize<R>}] Update One`, { reducerName: R, entity: E }>(createEntityActionType(reducerName, CommonActionTypes.UpdateOne.replace('[Default] ', '')));

/**
 * 建立一個特定 Reducer 的 "UpdateMany" Action Creator。
 * @template R Reducer 名稱的類型。
 * @template E 實體更新的類型 (通常是 `Partial<EntityType> & { id: string }`)，預設為 `any`。
 * @param reducerName Reducer 的名稱。
 */
export const updateMany = <R extends string, E = any>(reducerName: R) =>
    createAction<`[${Capitalize<R>}] Update Many`, { reducerName: R, entities: E[] }>(createEntityActionType(reducerName, CommonActionTypes.UpdateMany.replace('[Default] ', '')));

/**
 * 建立一個特定 Reducer 的 "UpsertOne" Action Creator。
 * @template R Reducer 名稱的類型。
 * @template E 實體的類型，預設為 `any`。
 * @param reducerName Reducer 的名稱。
 */
export const upsertOne = <R extends string, E = any>(reducerName: R) =>
    createAction<`[${Capitalize<R>}] Upsert One`, { reducerName: R, entity: E }>(createEntityActionType(reducerName, CommonActionTypes.UpsertOne.replace('[Default] ', '')));

/**
 * 建立一個特定 Reducer 的 "UpsertMany" Action Creator。
 * @template R Reducer 名稱的類型。
 * @template E 實體的類型，預設為 `any`。
 * @param reducerName Reducer 的名稱。
 */
export const upsertMany = <R extends string, E = any>(reducerName: R) =>
    createAction<`[${Capitalize<R>}] Upsert Many`, { reducerName: R, entities: E[] }>(createEntityActionType(reducerName, CommonActionTypes.UpsertMany.replace('[Default] ', '')));

/**
 * 建立一個特定 Reducer 的 "CompareSettlement" Action Creator。
 * @template R Reducer 名稱的類型。
 * @param reducerName Reducer 的名稱。
 */
export const compareSettlement = <R extends string>(reducerName: R) =>
    createAction<`[${Capitalize<R>}] Compare Settlement`, { reducerName: R, settlement: Settlement }>(createEntityActionType(reducerName, CommonActionTypes.CompareSettlement.replace('[Default] ', '')));

// #endregion Common Entity Actions

// 備註：舊的 CommonActionMap, transferDefaultToEntity, MethodMap, DefaultActionUnion 等輔助工具
// 已被新的 createAction 和 createEntityActionType 模式取代，故已移除。