// src/common/solid-integration.ts
// 此檔案提供了將 RxJS Observable 轉換為 SolidJS Signal 的工具函式和相關介面。
// 這是一個概念性的橋接，旨在展示如何在兩種響應式系統之間建立聯繫。
// 實際使用時，應依賴 SolidJS 環境提供的真實 API。

import { Observable, Subscription } from 'rxjs';

// #region SolidJS Signal 模擬介面

/**
 * 表示 SolidJS Signal 的讀取器部分 (Accessor)。
 * @template T Signal 所持有數據的類型。
 */
export type SolidAccessor<T> = () => T;

/**
 * 表示 SolidJS Signal 的寫入器部分 (Setter)。
 * @template T Signal 所持有數據的類型。
 */
export type SolidSetter<T> = (newValue: T) => void;

/**
 * 表示一個 SolidJS Signal 對，包含讀取器和寫入器。
 * @template T Signal 所持有數據的類型。
 * @remarks 在我們的場景中，從 Store 獲取的 Signal 主要是唯讀的，
 *          因此 Setter 可能是未定義的或僅用於內部更新。
 */
export type SolidSignal<T> = [SolidAccessor<T>, SolidSetter<T>];

/**
 * 一個簡化的 SolidJS `createSignal` 的模擬介面，用於函式簽名。
 * 實際使用時，應傳入 SolidJS 提供的真實 `createSignal` API。
 * @template T Signal 所持有數據的類型。
 * @param initialValue Signal 的初始值。
 * @param options 可選的 Signal 選項 (例如，用於比較的 `equals` 函式)。
 * @returns 一個 Signal 對 [getter, setter]。
 */
export interface CreateSolidSignal {
  <T>(initialValue: T, options?: { equals?: false | ((prev: T, next: T) => boolean) }): SolidSignal<T>;
}

// #endregion SolidJS Signal 模擬介面

// #region fromObservableToSolid 函式

/**
 * 將一個 RxJS Observable 轉換為一個 SolidJS Signal (Accessor)。
 *
 * 重要提示：
 * 1. 此函式提供概念性整合。在實際的 SolidJS 應用中，`createSignalFn` 應為 SolidJS 環境提供的 `createSignal` API。
 * 2. 返回的 Accessor (`getSignal`) 應在 SolidJS 的追蹤上下文中被調用以實現響應性。
 * 3. 調用者有責任管理返回的 `subscription` 的生命週期，通常在組件銷毀時取消訂閱，以避免內存洩漏。
 *
 * @template T Observable 和 Signal 所持有數據的類型。
 * @param source$ 要轉換的 RxJS Observable。
 * @param initialValue Signal 的初始值。在 Observable 發出第一個值之前，Signal 將持有此初始值。
 * @param createSignalFn SolidJS 的 `createSignal` 函式或其兼容實現。
 * @returns 一個物件，包含：
 *          - `accessor`: SolidJS Accessor (`() => T`)，用於讀取 Signal 的當前值。
 *          - `subscription`: RxJS Subscription，用於管理對 `source$` 的訂閱。
 *
 * @example
 * // 假設在 SolidJS 環境中：
 * // import { createSignal, onCleanup } from 'solid-js';
 * // import { store } from './your-store-setup'; // 你配置好的 Store 實例
 * // import { selectSomeData } from './your-selectors'; // 你的某个 Selector
 * // import { fromObservableToSolid, CreateSolidSignal } from './solid-integration';
 *
 * // // 1. 獲取 Observable 和初始值
 * // const someData$ = store.select(selectSomeData); // 假設 selectSomeData 返回 Observable<DataType>
 * // let initialData: DataType;
 * // try {
 * //   initialData = store.getState().someFeature.someData; // 嘗試從 Store 快照獲取
 * // } catch (e) {
 * //   initialData = fallbackInitialData; // 如果 Store 狀態尚未完全初始化，則使用備用初始值
 * //   console.warn("Could not get initial data from store snapshot, using fallback.");
 * // }
 *
 * // // 2. 適配 SolidJS 的 createSignal (如果需要，通常直接傳入即可)
 * // // const solidCreateSignalAdapter: CreateSolidSignal = <T,>(val: T, options?: any) => {
 * // //   const [get, set] = createSignal<T>(val, options);
 * // //   return [get, set];
 * // // };
 *
 * // // 3. 轉換 Observable 到 Signal Accessor
 * // const { accessor: someDataSignal, subscription } = fromObservableToSolid<DataType>(
 * //   someData$,
 * //   initialData,
 * //   createSignal // 直接傳入 SolidJS 的 createSignal
 * // );
 *
 * // // 4. 在 SolidJS 組件中使用 Signal Accessor
 * // // createEffect(() => {
 * // //   console.log('Data from signal:', someDataSignal());
 * // // });
 *
 * // // 5. 清理訂閱
 * // // onCleanup(() => {
 * // //   subscription.unsubscribe();
 * // //   console.log('Observable subscription cleaned up.');
 * // // });
 */
export function fromObservableToSolid<T>(
    source$: Observable<T>,
    initialValue: T,
    createSignalFn: CreateSolidSignal
): { accessor: SolidAccessor<T>; subscription: Subscription } {
    // 使用傳入的 createSignalFn 創建 SolidJS Signal
    // 注意：SolidJS 的 createSignal 可能有第二個 options 參數，這裡的介面已包含
    const [getSignal, setSignal] = createSignalFn(initialValue);

    // 訂閱 RxJS Observable
    const subscription = source$.subscribe({
        next: (value: T) => {
            // 當 Observable 發出新值時，更新 SolidJS Signal
            setSignal(value);
        },
        error: (err: any) => {
            // 在 SolidJS 環境中，可以考慮如何處理錯誤，
            // 例如設置一個錯誤狀態的 Signal，或在控制台打印。
            // 這裡僅作演示，實際錯誤處理策略取決於應用需求。
            console.error('Error in Observable source for Solid Signal:', err);
            // 可以考慮設置一個特殊的錯誤值給 Signal，如果適用：
            // setSignal(someErrorRepresentationOrFallbackValue);
        },
        // complete 回調通常不需要特別處理來更新 Signal，
        // 因為 Signal 會保持其最後一個值。
    });

    // 返回 Signal 的讀取器 (Accessor) 和 RxJS Subscription
    // 調用者需要管理 subscription 的生命週期。
    return { accessor: getSignal, subscription };
}

// #endregion fromObservableToSolid 函式
