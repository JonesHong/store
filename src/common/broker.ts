// src/common/broker.ts
// 此檔案定義了一個 Broker (代理/中介者) 類別，用於在應用程式的不同部分之間傳遞 Action。
// Broker 維護一個基於 Action Type 的主題 (Topic) 映射，允許組件訂閱特定類型的 Action。
// 它還提供了一個廣播主題，用於分發所有 Action。

// 注意：隨著 `src/common/store.ts` 中 Store 類別的重構，Store 本身已包含強大的 Action 分發
// (通過 `dispatch` 方法) 和 Action 流訂閱 (通過 `getActionsStream()`) 功能。
// 因此，此 Broker 類別的許多原始職責可能與 Store 重疊或已可被 Store 取代。
// 在現代化的狀態管理模式下，建議直接使用 Store 提供的 Action 分發和訂閱機制。
// 此 Broker 可能適用於 Store 之外的、更通用的事件傳遞場景，或者作為一個遺留組件。

import { asapScheduler, BehaviorSubject, Observable, Subscription } from 'rxjs'; 
import { filter, take } from 'rxjs/operators'; 
import { Action as BaseAction } from './action'; 
import { v4 as uuidv4 } from 'uuid';
import { Logger } from './logger';
import { envType } from './env_checker';
import { Main } from './main'; // Main 主要用於控制日誌輸出，可考慮解耦

/**
 * @deprecated Broker 類別的功能與重構後的 Store (`src/common/store.ts`) 有顯著重疊。
 *             建議優先使用 Store 提供的 Action 分發 (`Store.dispatch()`) 和 Action 流
 *             (`Store.getActionsStream()`) 機制。此 Broker 可能適用於遺留場景或
 *             Store 範圍之外的特定事件傳遞需求。
 *
 * 事件代理抽象類別。
 * 它允許在應用程式的不同部分之間解耦地分發和訂閱 Action。
 * Broker 內部使用 RxJS BehaviorSubject 來管理每個 Action Type 的主題。
 */
export abstract class Broker {
  /** 
   * Broker 實例的唯一識別碼。
   * @protected 
   * @readonly
   */
  protected readonly _brokerId = `broker-${uuidv4()}`;

  /** 
   * BehaviorSubject，指示 Broker 是否已準備好分發 Action。
   * 當設為 `true` 時，會處理 `_eventCache` 中的暫存 Action。
   * @remarks 在重構後的 Store 中，Action 分發通常是即時的，除非由 Middleware 控制。
   *          此機制在 Broker 中的必要性降低。
   */
  public isReadyToDispatch$ = new BehaviorSubject(false);
  /** 
   * @internal 
   * 用於管理 `isReadyToDispatch$` 訂閱的 RxJS Subscription。
   */
  private _isReadyToDispatchSubscription: Subscription;

  /** 
   * @deprecated 事件日誌功能可能與更專業的日誌/追蹤工具重疊，或應在 Store 層面考慮。
   *             且 Action 結構已變更，此日誌記錄方式不再有效。
   * 用於存儲已分發 Action 的日誌 (固定大小，先進先出)。
   * @private
   */
  private _eventsLog: BaseAction[] = [];
  /** 
   * 當 `isReadyToDispatch$` 為 `false` 時，用於暫存待分發 Action 的快取。
   * @private
   */
  private _eventCache: BaseAction[] = [];

  /** 
   * 存儲 Action Type 與其對應的 BehaviorSubject (主題) 的映射。
   * 鍵為 Action Type 字串，值為該 Action Type 的 BehaviorSubject。
   * @private
   */
  private _topicMap: Map<string, BehaviorSubject<BaseAction | null>> = new Map();

  /**
   * 獲取當前所有 Action 主題的映射。
   * @returns 一個唯讀 Map，鍵為 Action Type，值為對應的 BehaviorSubject。
   */
  public get topicMap(): ReadonlyMap<string, BehaviorSubject<BaseAction | null>> { 
    return this._topicMap;
  }

  /**
   * 獲取當前所有已註冊主題的名稱列表。
   * @returns 一個包含所有 Action Type 字串的可迭代物件。
   */
  public get topicNameList(): IterableIterator<string> {
    return this._topicMap.keys();
  }

  /**
   * 獲取當前在事件快取中等待分發的 Action 列表。
   * @returns 一個包含暫存 Action 的唯讀陣列。
   */
  public get eventCache(): ReadonlyArray<BaseAction> { 
    return this._eventCache;
  }

  constructor() {
    this._brokerInitial();
  }

  /**
   * @internal 初始化 Broker，設定廣播主題並處理初始的 Action 快取。
   * @private
   */
  private _brokerInitial(): void {
    this.topicMap.set('broadcast', new BehaviorSubject<BaseAction | null>(null));

    this._isReadyToDispatchSubscription = this.isReadyToDispatch$
      .pipe(
        filter(isReady => !!isReady), 
        take(1) 
      )
      .subscribe(
        () => { 
          if (this._eventCache.length > 0) {
            Logger.info('Broker', `Processing ${this._eventCache.length} cached actions as Broker is now ready.`, { payload: {count: this._eventCache.length} });
            const cacheToProcess = [...this._eventCache]; 
            this._eventCache = []; 
            cacheToProcess.forEach(event => this.dispatch(event));
          } else {
            Logger.info('Broker', 'Broker is ready, no cached actions to process.');
          }
        }
      );
  }

  /**
   * @deprecated 此方法依賴於 Action 實例具有 `_id` 和 `_parentId` 屬性以及 `setParent` 方法，
   *             這些在重構後的 `BaseAction` 中不存在。事件追蹤和鏈路分析應使用更通用的日誌或監控方案。
   * (舊功能) 嘗試從 `_eventsLog` 中構建事件鏈。
   * @returns 一個包含事件 ID 列表和事件對象映射的物件。
   */
  getEventChain(): { ids: string[]; events: { [key: string]: BaseAction } } {
    Logger.warn('Broker.getEventChain', 'This method is deprecated due to changes in Action structure and event logging strategy.', {isPrint: true});
    const payload: { ids: string[]; events: { [key: string]: any } } = { 
      ids: [],
      events: {},
    };
    // 由於 BaseAction 沒有 _id, _parentId, setParent, 此處邏輯已失效，僅返回空結構。
    return payload;
  }

  /**
   * 獲取廣播主題的 BehaviorSubject。
   * 所有通過 `dispatch` 分發的 Action 也會被推送到此主題。
   * @returns 廣播主題的 BehaviorSubject，或在未初始化時返回 `undefined` (理論上總是被初始化)。
   */
  getBroadcast(): BehaviorSubject<BaseAction | null> | undefined {
    return this.topicMap.get('broadcast');
  }

  /**
   * 根據 Action 的類型獲取對應的主題 BehaviorSubject。
   * @param action 要查找主題的 Action 實例。
   * @returns 對應 Action Type 的 BehaviorSubject，如果該主題不存在則返回 `undefined`。
   */
  getTopicByAction(action: BaseAction): BehaviorSubject<BaseAction | null> | undefined {
    const type = action.type;
    if (!this.topicMap.has(type)) {
      Logger.warn( 
        'Broker.getTopicByAction',
        `Topic for ActionType "${type}" does not exist. It might be created on-demand or was never registered.`,
        { payload: { actionType: type } }
      );
      return undefined;
    }
    return this.topicMap.get(type);
  }

  /**
   * 為指定的 Action Type 添加一個新的主題 (BehaviorSubject)。
   * 如果該 Action Type 的主題已存在，則記錄警告並返回現有主題的引用。
   * @param actionType 要為其創建主題的 Action Type 字串。
   * @returns 新創建的或已存在的 BehaviorSubject。
   */
  addTopicByActionType(actionType: string): BehaviorSubject<BaseAction | null> {
    if (this._topicMap.has(actionType)) {
      Logger.warn( 
        'Broker.addTopicByActionType',
        `Topic <${actionType}> already exists. Returning existing topic.`,
        { payload: { actionType } }
      );
      return this._topicMap.get(actionType)!; 
    }
    const newTopic$ = new BehaviorSubject<BaseAction | null>(null); 
    this._topicMap.set(actionType, newTopic$);
    Logger.info('Broker.addTopicByActionType', `Topic <${actionType}> created.`, { payload: { actionType } });
    return newTopic$;
  }

  /**
   * 根據 Action Type 字串陣列批量添加主題。
   * @param actionTypeList 一個包含多個 Action Type 字串的陣列。
   * @returns 一個包含為每個 Action Type 創建 (或獲取) 的 BehaviorSubject 的陣列。
   */
  addTopicsByActionTypeList = (
    actionTypeList: string[]
  ): BehaviorSubject<BaseAction | null>[] => {
    if (!Array.isArray(actionTypeList)) {
      Logger.error(
        'Broker.addTopicsByActionTypeList',
        `Input must be an array of ActionType strings. Received: ${typeof actionTypeList}`,
        { isPrint: true }
      );
      return [];
    }
    return actionTypeList.map(actionType => this.addTopicByActionType(actionType));
  };

  /**
   * 分發一個 Action。
   * Action 會被推送到其對應類型的主題 (如果存在) 以及廣播主題。
   * 如果 Broker 尚未準備好 (`isReadyToDispatch$` 為 `false`)，Action 會被暫存。
   * @param action 要分發的 Action。
   * @remarks 
   * - 建議使用 `Store.dispatch()` 作為主要的 Action 分發機制。
   */
  dispatch(action: BaseAction): void {
    if (!this.isReadyToDispatch$.value) {
      Logger.info(
        'Broker.dispatch',
        `Broker is not ready. Action (${action.type}) cached. It will be re-dispatched later.`,
        { payload: { actionType: action.type } }
      );
      this._eventCache.push(action);
      return;
    }
    if (!action || !action.type) { 
        Logger.warn('Broker.dispatch', 'Attempted to dispatch an invalid or typeless action.', { payload: action, isPrint: true });
        return;
    }

    const type = action.type;
    const specificTopic = this.topicMap.get(type);
    if (specificTopic) {
      specificTopic.next(action);
    } else {
      Logger.warn(
        'Broker.dispatch',
        `No specific topic for ActionType "${type}". Action will only be broadcasted. Consider adding the topic if specific listeners are expected.`,
        { payload: action }
      );
    }

    const broadcastTopic = this.topicMap.get('broadcast');
    broadcastTopic?.next(action); 
  }

  /**
   * 分發一個 Action 陣列。
   * @param actions 要分發的 Action 陣列。
   */
  dispatches(actions: BaseAction[]): void {
    if (!Array.isArray(actions)) {
        Logger.error('Broker.dispatches', 'Input must be an array of Actions.', {isPrint: true});
        return;
    }
    actions.forEach(action => this.dispatch(action));
  }

  /**
   * 清理 Broker 資源，主要是取消 `isReadyToDispatch$` 的訂閱。
   * @remarks 如果 Broker 實例不再使用，應調用此方法以防止內存洩漏。
   */
  public destroy(): void {
    if (this._isReadyToDispatchSubscription && !this._isReadyToDispatchSubscription.closed) {
      this._isReadyToDispatchSubscription.unsubscribe();
    }
    this._topicMap.forEach(subject => subject.complete()); // 完成所有主題
    this._topicMap.clear();
    this._eventCache = [];
    this._eventsLog = []; // 清理日誌，雖然已棄用
    Logger.info('Broker', `Broker instance ${this._brokerId} destroyed.`);
  }
}
