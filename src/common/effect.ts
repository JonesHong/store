// src/common/effect.ts
// 此檔案定義了 Effect 相關的工具函式，主要用於處理副作用，
// 例如 API 請求、Web Socket 通信、或任何需要在 Action 分發流程之外執行的非同步操作。
// Effect 通常會監聽特定的 Action，執行某些操作，然後可能分發新的 Action。

import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators'; // mergeMap 和 from (fromArray) 將在 ofType 中使用
import { Action as BaseAction, ActionCreator, ActionWithPayload } from './action'; // 從已重構的 action.ts 引入

// EffectRunner 是 Store 中 addEffects 需要的類型
// 它是一個函式，當被調用時，返回一個會發出 BaseAction 的 Observable。
export type EffectRunner = () => Observable<BaseAction>;

/**
 * 建立一個 Effect Runner。
 * @param actions$ Store 提供的 Action 流 (Observable)。
 * @param sourceFunction 開發者提供的函式，它接收 actions$，並返回一個新的 Observable (通常是會發出 Action 的 Observable)。
 * @returns EffectRunner 函式，Store 將調用此函式來執行 Effect。
 */
export function createEffect(
    actions$: Observable<BaseAction>,
    sourceFunction: (actions$: Observable<BaseAction>) => Observable<BaseAction>
): EffectRunner {
    return () => sourceFunction(actions$);
}

// ofType Operator: 用於從 Action 流中過濾特定型別的 Action。
// 提供多載以改善使用 ActionCreator 時的型別推斷。

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function ofType<AC extends ActionCreator<any, any>>(actionCreator: AC): (source$: Observable<BaseAction>) => Observable<ReturnType<AC>>;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function ofType<AC extends ActionCreator<any, void>>(actionCreator: AC): (source$: Observable<BaseAction>) => Observable<ReturnType<AC>>;
// Note: The above overloads help with type inference for a single ActionCreator.
// The implementation uses a more general approach for multiple creators.
// For precise type inference with multiple creators, a more complex type signature or individual `ofType` calls combined with `merge` might be needed.

/**
 * RxJS Operator，用於從 Action 流中過濾出指定 ActionCreator 建立的 Action。
 * @param allowedCreators 一個或多個 ActionCreator。
 * @returns 一個 RxJS Operator，可應用於 Action Observable。
 */
export function ofType(...allowedCreators: ActionCreator<any, any>[]) {
    return (source$: Observable<BaseAction>): Observable<BaseAction> => // 返回的 Action 型別是泛化的 BaseAction
        source$.pipe(
            filter(action =>
                allowedCreators.some(creator => creator.type === action.type)
            )
            // 如果需要更精確的型別，開發者可能需要在後續的 map/mergeMap 中自行進行型別斷言，
            // 或者 ofType 的實現/簽名需要更複雜。
            // 例如: map(action => action as ActionWithPayload<P>)
            // 但這超出了目前簡化版 ofType 的範疇。
        );
}

// 舊的 Effect 型別和 Config 介面已移除。
// 舊的 createEffect 實現已由新的、接收 actions$ 的版本取代。