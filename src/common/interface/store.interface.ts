// src/common/interface/store.interface.ts
// 此檔案定義了與 Store 內部狀態同步和結算相關的介面。

import { LastSettlement } from "./adapter.interface";

/**
 * 表示一次狀態結算的資訊。
 * "結算 (Settlement)" 是指在一次或多次 Action 處理後，某個 Reducer 的狀態達到一個穩定點，
 * 並記錄下相關的變更摘要和校驗資訊 (如 hash)。
 * 這通常用於需要與外部（如伺服器或其他客戶端）同步狀態，或在狀態歷史中追蹤重要變更點的場景。
 *
 * @template T 實體的類型，通常用於 `lastSettlement` 中的 `create` 和 `update`。
 *           在 `Settlement` 類型中，由於 `lastSettlement` 可能來自不同的 Reducer，
 *           其泛型 `T` 通常設為 `any`，具體類型由使用時的上下文確定。
 */
export type Settlement = {
    /** 
     * 產生此次結算的 Reducer 的名稱。
     * 用於標識此結算資訊屬於哪個狀態片段。
     */
    reducerName: string;

    /** 
     * 此 Reducer 在此次結算前的狀態 hash 值。
     * 用於與新的 hash 值比較，以快速檢測狀態是否實際發生了變更，或用於資料一致性校驗。
     */
    _previousHash: string | null; // 允許初始狀態時為 null

    /** 
     * 此 Reducer 在此次結算後的當前狀態 hash 值。
     * 用於後續的狀態比較或版本控制。
     */
    _currentHash: string;

    /** 
     * 上一次結算的詳細資訊，記錄了導致當前狀態的具體變更。
     * 參考 `adapter.interface.ts` 中的 `LastSettlement<T>` 定義。
     * 這裡使用 `LastSettlement<any>` 是因為 Settlement 可能涉及不同 Reducer 的不同實體類型。
     */
    lastSettlement: LastSettlement<any>;
};