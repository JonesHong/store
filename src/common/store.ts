// src/common/store.ts
// Store 的核心職責是作為狀態容器、Action 分發器以及 Reducer 和 Effect 的協調器。
// 它維護應用程式的整體狀態，處理 Action 的分發，並將 Action 傳遞給已註冊的 Reducer 來更新狀態，
// 同時也將 Action 提供給 Effect 進行副作用處理。
// Middleware 機制允許在 Action 到達 Reducer 之前對其進行攔截、修改或執行其他操作。

import _ from "lodash"; // Lodash 暫時保留，主要用於 _.cloneDeep 在 getState 中
import { BehaviorSubject, Observable, Subscription, Subject } from "rxjs";
import { distinctUntilChanged, map as rxMap, shareReplay } from "rxjs/operators";
import { Action as BaseAction } from "./action";
import { v4 as uuidv4 } from "uuid";
import { Logger } from "./logger";

// #region Middleware API 類型定義

/**
 * StoreAPI 暴露給 Middleware，使其可以 dispatch 新的 Action 或獲取當前狀態。
 * @template State Store 管理的狀態類型。
 * @template A Action 的基礎類型，預設為 BaseAction。
 */
export interface StoreAPI<State, A extends BaseAction = BaseAction> {
    /** 獲取當前狀態的快照。 */
    getState: () => State;
    /** 
     * 分發一個 Action。Middleware dispatch 的 Action 應該返回被 dispatch 的 Action。
     * Action 將通過整個 Middleware 鏈（包括觸發此 dispatch 的 Middleware 之後的 Middleware）
     * 以及最終的核心 dispatch 邏輯。
     */
    dispatch: (action: A) => A;
}

/**
 * Middleware 函式類型。
 * Middleware 是一個高階函式，它接收 StoreAPI，返回一個接收下一個 dispatch 函式的函式，
 * 最終返回一個處理 Action 的函式。
 * @template State Store 管理的狀態類型。
 * @template A Action 的基礎類型，預設為 BaseAction。
 * @param storeApi 提供 getState 和 dispatch 方法的 Store API。
 * @returns 一個函式，該函式接收下一個 Middleware (或核心 dispatch)。
 *          @param next 在 Middleware 鏈中的下一個 dispatch 函式。
 *          @returns 一個函式，該函式接收當前 Action 並返回處理後（或原樣）的 Action。
 *                   @param action 當前正在處理的 Action。
 *                   @returns 處理後的 Action。
 */
export type Middleware<State, A extends BaseAction = BaseAction> =
    (storeApi: StoreAPI<State, A>) =>
    (next: (action: A) => A) =>
    (action: A) => A;

// #endregion Middleware API 類型定義


// 定義 Reducer 函式的型別
type ReducerFn<S, A extends BaseAction = BaseAction> = (state: S, action: A) => S;

// 狀態選擇器函式的型別
type SelectorFn<State, Result> = (state: State) => Result;

// Effect 執行器的型別
type EffectRunner = () => Observable<BaseAction>;

export class Store<State extends object> {
  private _storeId = `store-${uuidv4()}`;

  // 狀態管理
  private _state$: BehaviorSubject<State>;

  // Action 分發
  private _actions$ = new Subject<BaseAction>(); // 用於廣播 Action 給 Effect
  private _dispatchChain!: (action: BaseAction) => BaseAction; // Middleware 增強後的 dispatch

  // Reducer 註冊
  private _reducersMap = new Map<string, ReducerFn<any, BaseAction>>();
  private _featureStates = new Map<string, any>(); // 使用 Map 儲存各 feature 的狀態

  // Effect 註冊
  private _effectSubscriptions = new Subscription();

  // Middleware
  private _middlewares: Middleware<State, BaseAction>[] = [];

  constructor(initialState: State, middlewares: Middleware<State, BaseAction>[] = []) {
    this._state$ = new BehaviorSubject(_.cloneDeep(initialState)); // 深拷貝初始狀態
    this._middlewares = middlewares;
    this.initializeMiddleware(); // 初始化 Middleware 鏈
    Logger.log('Store', `Store initialized with ID: ${this._storeId}`, { initialState, middlewareCount: middlewares.length });
  }

  /**
   * 初始化 Middleware 鏈。
   * 將傳入的 Middleware 數組與核心 dispatch 邏輯組合成一個單一的 dispatch 鏈。
   */
  private initializeMiddleware(): void {
    // 核心的 dispatch 邏輯，將 action 送到 reducer 和 _actions$
    const coreDispatch = (action: BaseAction): BaseAction => {
        let stateChanged = false;
        const currentStateSnapshot = this._state$.value; // 獲取當前全局狀態快照
        let nextGlobalState: State = currentStateSnapshot; // 初始化 nextGlobalState

        this._reducersMap.forEach((reducerFn, featureKey) => {
            const previousFeatureState = this._featureStates.get(featureKey);
            const newFeatureState = reducerFn(previousFeatureState, action);
            if (previousFeatureState !== newFeatureState) {
                this._featureStates.set(featureKey, newFeatureState);
                stateChanged = true;
            }
        });

        if (stateChanged) {
            // 如果任何 feature state 發生變化，則基於更新的 _featureStates 重建全局狀態
            // 確保 nextGlobalState 是一個新對象，即使只有一個 feature state 改變
            nextGlobalState = { ...currentStateSnapshot }; // 從快照開始，以防多個 reducer 修改同一個 feature（雖然不推薦）
            this._featureStates.forEach((featureState, featureKey) => {
                // @ts-ignore - 動態賦值
                nextGlobalState[featureKey as keyof State] = featureState;
            });
            this._state$.next(nextGlobalState);
            Logger.log('Store', `State updated by coreDispatch after action: ${action.type}`, { nextGlobalState });
        }
        
        this._actions$.next(action); // 將 action 送給 effects
        return action;
    };

    // 使用 reduceRight 將 middlewares 組合成一個調用鏈
    // Middleware 的執行順序與它們在數組中的順序一致（第一個 Middleware 最先執行）
    this._dispatchChain = this._middlewares.reduceRight(
        (nextInChain, currentMiddleware) => {
            const storeApi: StoreAPI<State, BaseAction> = {
                getState: this.getState.bind(this),
                // Middleware 內部 dispatch 時，action 會重新進入整個 Middleware 鏈的頭部
                dispatch: (act: BaseAction) => this.dispatch(act) 
            };
            return currentMiddleware(storeApi)(nextInChain);
        },
        coreDispatch // 最內層是核心的 dispatch
    );
  }


  /**
   * 獲取當前狀態的快照。
   * @returns 當前狀態物件。
   */
  public getState(): State {
    // 注意：如果狀態是 Immutable.js 結構，則不需要深拷貝。
    // 由於目前 State 泛型是 object，為安全起見，返回深拷貝。
    return _.cloneDeep(this._state$.value);
  }

  /**
   * 選擇狀態的特定部分並返回其 Observable。
   * @param selectorFn 一個函式，接收當前狀態並返回狀態的選定部分。
   * @returns 一個 Observable，發布選定狀態部分的變更。
   */
  public select<Result>(selectorFn: SelectorFn<State, Result>): Observable<Result> {
    return this._state$.asObservable().pipe(
      rxMap(state => selectorFn(state)),
      distinctUntilChanged(),
      shareReplay(1)
    );
  }

  /**
   * 註冊一個 Feature Reducer。
   * @param featureKey 此 Feature 在全局狀態樹中的鍵名。
   * @param reducerFn 由 createReducer 建立的 Reducer 函式。
   */
  public addReducer<FeatureState>(
    featureKey: string,
    reducerFn: ReducerFn<FeatureState, BaseAction>
  ): void {
    if (this._reducersMap.has(featureKey)) {
      Logger.warn('Store', `Reducer for feature key "${featureKey}" already exists. Overwriting.`, { featureKey });
    }
    this._reducersMap.set(featureKey, reducerFn);

    // 初始化 feature state
    const initialGlobalStateSnap = this._state$.value; // 使用當前值，而不是 getState() 以避免額外 clone
    // @ts-ignore
    const existingFeatureState = initialGlobalStateSnap[featureKey];
    const initialFeatureState = existingFeatureState !== undefined 
      ? existingFeatureState
      // @ts-ignore - __INIT__ is a conceptual action for reducers to return their initial state
      : reducerFn(undefined, { type: '__INIT__' } as BaseAction);
      
    this._featureStates.set(featureKey, initialFeatureState);

    // 更新全局狀態以包含新的 feature state (如果它之前不存在)
    // @ts-ignore
    if (initialGlobalStateSnap[featureKey] === undefined) {
        const newState = {
            ...initialGlobalStateSnap,
            [featureKey]: initialFeatureState,
        };
        this._state$.next(newState as State);
    }
    Logger.log('Store', `Reducer added for feature key: "${featureKey}"`, { featureKey });
  }

  /**
   * 註冊一個或多個 Effect。
   * @param effectRunners 一個或多個 EffectRunner 函式。
   */
  public addEffects(...effectRunners: EffectRunner[]): void {
    const actionsStream = this.getActionsStream(); // 傳遞給 Effect 的是同一個 Action Stream
    effectRunners.forEach(runner => {
      // 注意：EffectRunner 的實現應接收 actions$
      // const effectSubscription = runner(actionsStream).subscribe(action => {
      // 假設 EffectRunner 內部已處理 actions$ 的訂閱，或 createEffect 會處理
      const effectSubscription = runner().subscribe(action => { 
        this.dispatch(action);
      });
      this._effectSubscriptions.add(effectSubscription);
    });
    Logger.log('Store', `Added ${effectRunners.length} effect(s).`);
  }

  /**
   * 分發一個 Action。
   * Action 將通過 Middleware 鏈，然後被傳遞給所有已註冊的 Reducer，並提供給 Effect。
   * @param action 要分發的 Action。
   * @returns 處理後的 Action (可能被 Middleware 修改)。
   */
  public dispatch(action: BaseAction): BaseAction {
    Logger.log('Store', `Dispatching action via middleware chain: ${action.type}`, { action });
    return this._dispatchChain(action);
  }
  
  /**
   * 獲取 Action Stream，Effect 可以訂閱此流以響應 Action。
   * @returns Action 的 Observable。
   */
  public getActionsStream(): Observable<BaseAction> {
    return this._actions$.asObservable();
  }


  /**
   * 訂閱整個狀態樹的變更。
   * @param next 當狀態變更時執行的回調函式。
   * @param error 發生錯誤時執行的回調函式。
   * @param complete Observable 完成時執行的回調函式。
   * @returns RxJS Subscription 物件。
   */
  public subscribe(
    next?: (state: State) => void,
    error?: (error: any) => void,
    complete?: () => void
  ): Subscription {
    return this._state$.subscribe({ next, error, complete });
  }

  /**
   * 清理 Store，取消所有 Effect 的訂閱。
   */
  public destroy(): void {
    this._effectSubscriptions.unsubscribe();
    this._actions$.complete();
    this._state$.complete();
    Logger.log('Store', `Store ${this._storeId} destroyed.`);
  }
}