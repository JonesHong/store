// src/common/main.ts
// 此檔案定義了應用程式的核心協調類別 `CQRS` (現已大部分棄用) 
// 和一個用於全域配置的單例 `Main`。
// `CQRS` 類別原意是整合 Store、Reducer、Effect 等，但其許多實現細節
// 反映了舊的設計模式。隨著核心模組 (Store, Reducer, Effect, Action) 的現代化重構，
// `CQRS` 類別的大部分功能應由新的 Store API 和應用程式引導流程直接處理。

import { asapScheduler, BehaviorSubject, Observable, of, Subscription } from 'rxjs';
import { delay, mergeMap, take } from 'rxjs/operators';
import { Action as BaseAction } from './action'; 
import { Reducer as OldReducer } from './reducer'; // 仍指向舊的 Reducer 類別定義
import { createFeatureSelector, createRelationSelector } from './selector'; 
import { Store } from './store'; 
import { EffectRunner } from './effect'; 
import { RelationshipFromJDL } from './interface/relation.interface';
import { Relation } from './relation'; 
import { Container } from 'inversify'; 
import { Logger } from './logger';
import { envType } from './env_checker';
import { DateTime } from 'luxon';
import { Singleton } from './decoratios/singleton';

/**
 * `@Singleton`
 * `_Main` 類別作為一個單例，提供應用程式級別的配置。
 * 主要用於控制日誌相關的行為，例如是否啟用檔案日誌、控制台輸出的詳細程度，
 * 以及標記應用程式是否使用了 Effect 機制 (影響 Store 的 Action 分發時機)。
 *
 * @remarks
 * 實例通過 `Main` 導出。
 */
@Singleton
class _Main {
  private static instance: _Main;
  /** 獲取 `_Main` 的單例實例。由 `@Singleton` 裝飾器提供。 */
  public static getInstance: () => _Main;
  private constructor() { }

  /** 
   * 一個 BehaviorSubject，指示是否應將日誌記錄到檔案 (僅在 Node.js 環境中有效)。
   * 應用程式可以訂閱此 Observable 或直接設置其值。
   * 預設為 `false`。
   * @example
   * Main.isLogByFIle$.next(true); // 啟用檔案日誌
   */
  public isLogByFIle$: BehaviorSubject<boolean> = new BehaviorSubject(false);

  /** 
   * 控制日誌在控制台的輸出模式。
   * - `"detail"`: 輸出所有日誌 (log, warn, error)，通常包含詳細的 payload 和執行時間。
   * - `"expectLog"`: 僅輸出警告 (warn) 和錯誤 (error) 訊息。
   * - `"none"`: 禁止所有來自此函式庫的控制台輸出。
   * 預設為 `"none"`。
   * @example
   * Main.printMode = "detail";
   */
  public printMode: "detail" | "expectLog" | "none" = "none";

  /** 
   * 標記應用程式是否使用了 Effect 機制。
   * 如果為 `true`，舊的 `CQRS` 類中的 Store 會等待 Effect 初始化完成 (`isEffectLoaded$`) 後才允許 Action 分發。
   * 在新的 `Store` 實現中，此標記的直接作用已減弱，因為 Action 分發是即時的。
   * 預設為 `false`。由 `CQRS.forRootEffects` (已棄用) 設置。
   */
  public isUseEffect: boolean = false;
}

/**
 * `_Main` 類別的導出單例實例。
 * 用於訪問和修改全域日誌配置等。
 * @example
 * Main.printMode = "detail"; // 設置日誌輸出模式
 * Main.isLogByFIle$.next(true); // 啟用檔案日誌 (僅 Node.js)
 */
export const Main = _Main.getInstance();

/**
 * @deprecated `CQRS` 類別及其大部分方法反映了舊的、基於類別的 Reducer 和 Effect 設計。
 *             隨著核心模組已遷移到更現代的函式式和基於 `createXXX` 的模式，
 *             此類別的許多職責 (如 Reducer 註冊、Effect 初始化、Store 實例化) 
 *             應由新的 Store API (`Store.addReducer`, `Store.addEffects`) 
 *             和可能的應用程式引導模組 (例如，類似 Angular 的 `AppModule` 或 Redux 的 `configureStore`) 更直接地處理。
 *             **強烈建議逐步淘汰此類別**，將其功能遷移到新的 Store 和應用程式初始化流程中。
 *
 * CQRS 類別，原意是作為應用程式核心的協調器，整合 Store、Reducer、Effect 等。
 *
 * @template TStoreState 全局 Store 狀態的類型。
 * @template TReducers (已棄用) 此泛型參數在當前上下文中意義不大，因為 Reducer 的註冊方式已改變。
 */
export class CQRS<TStoreState extends object, TReducers = any> {
  /** 
   * @deprecated Store 實例應直接創建和管理，而不是通過 `CQRS` 類。
   *             請直接使用 `new Store<TStoreState>(initialState, middlewares)` 創建 Store。
   */
  private _Store!: Store<TStoreState>; 
  
  /** 
   * InversifyJS 的依賴注入容器。
   * 主要用於在 'unit-test' 模式下解析 Effect 實例，或在特定框架集成中使用。
   * 在現代化重構後，應優先使用框架自身的 DI 機制。
   */
  private _container = new Container();
  
  /** 
   * @deprecated 應用程式模組 (如 Angular Module 或 NestJS Module) 的引用。
   *             與特定框架的整合應採用更鬆散耦合、更通用的方式。
   */
  private _appModule: any;
  /** 
   * @deprecated NestJS 應用程式實例的引用。
   */
  private _app: any;
  /** 
   * @deprecated 應用程式模組的類型，用於決定如何解析 Effect 實例。
   *             應由更通用的 DI 抽象或框架特定整合層處理。
   */
  private _appModuleType: 'nest' | 'angular' | 'unit-test' | 'no-match' | undefined;

  /** 獲取 InversifyJS 容器實例。 */
  public get container(): Container {
    return this._container;
  }
  /** @deprecated 請參閱對 `_appModule` 的棄用說明。 */
  public get appModule() {
    Logger.warn('CQRS.appModule Getter', 'Accessing deprecated _appModule. Framework integration should be handled differently.', {isPrint: true});
    return this._appModule;
  }
  /** @deprecated 請參閱對 `_appModuleType` 的棄用說明。 */
  public get appModuleType() {
    Logger.warn('CQRS.appModuleType Getter', 'Accessing deprecated _appModuleType. Framework integration should be handled differently.', {isPrint: true});
    return this._appModuleType;
  }

  /** 
   * @deprecated Store 實例應從創建它的地方直接訪問和管理。
   * @returns Store 實例。如果尚未初始化，則記錄錯誤。
   */
  public get Store(): Store<TStoreState> {
    if (!this._Store) {
        Logger.error('CQRS.Store Getter', 'Store has not been initialized. Call forRootReducers (deprecated) or instantiate Store directly.', { isPrint: true });
        // throw new Error('Store has not been initialized.'); // 避免拋出錯誤使應用崩潰
    }
    return this._Store;
  }

  /** 
   * @deprecated Action Observable 應通過 `Store.getActionsStream()` 獲取。
   * @returns Action 的 Observable。如果 Store 未初始化，返回一個空的 Subject。
   */
  public get Actions(): Observable<BaseAction> {
    Logger.warn('CQRS.Actions Getter', 'Accessing Actions via CQRS.Actions is deprecated. Use Store.getActionsStream() instead.', {isPrint: true});
    return this.Store ? this.Store.getActionsStream() : new Subject<BaseAction>().asObservable(); 
  }

  /** @internal 用於管理 Effect 加載狀態的訂閱，現已大部分棄用。 */
  private _isEffectLoadedSubscribe!: Subscription;

  constructor() { 
    Logger.warn('CQRS Constructor', 'CQRS class is deprecated. Consider migrating to direct Store usage and modern initialization patterns.', {isPrint: true});
  }

  /** 
   * 獲取從 JDL 解析的關聯關係配置。
   * @returns `RelationshipFromJDL` 物件或 undefined。
   * @see Relation.RelationshipFromJDL
   * @remarks 關聯配置的管理和使用已遷移到 `createRelationSelector`。
   */
  public get relationshipFromJDL(): RelationshipFromJDL | undefined {
    return Relation.RelationshipFromJDL;
  }
  /** 
   * 設定從 JDL 解析的關聯關係配置。
   * @param relationshipFromJDL `RelationshipFromJDL` 物件。
   * @remarks 關聯配置的管理和使用已遷移到 `createRelationSelector`。
   */
  setRelationshipFromJDL = (relationshipFromJDL: RelationshipFromJDL): void => {
    Relation.RelationshipFromJDL = relationshipFromJDL;
  };
  
  /**
   * @deprecated 應用程式模組類型的設定應在更通用的框架整合層處理。
   * 設定應用程式模組的類型。
   * @param appModuleType 模組類型：'nest', 'angular', 或 'unit-test'。
   */
  setAppModuleType(appModuleType: 'nest' | 'angular' | 'unit-test'): void {
    Logger.warn('CQRS.setAppModuleType', 'Method is deprecated. Framework-specific setup should be handled externally.', {isPrint: true});
    this._appModuleType = appModuleType;
    if (appModuleType === 'unit-test') {
      this.isEffectLoaded$.next(true); 
    }
  }

  /**
   * @deprecated 應用程式模組的設定應在更通用的框架整合層處理。
   * 設定應用程式的主模組和可選的應用程式實例 (主要用於 NestJS)。
   * @param appModule 應用程式的主模組實例。
   * @param app (可選) 應用程式實例 (例如 NestJS 的 `INestApplication`）。
   */
  setAppModule = (appModule: any, app?: any): void => {
    Logger.warn('CQRS.setAppModule', 'Method is deprecated. Framework-specific setup should be handled externally.', {isPrint: true});
    this._appModule = appModule;
    if (app) this._app = app;
    if (!this._appModuleType) { 
      Logger.warn(
        'CQRS.setAppModule',
        `AppModuleType not set. Attempting to auto-detect. It's recommended to set AppModuleType explicitly.`,
        { isPrint: Main.printMode !== "none" }
      );
      if (appModule && typeof appModule.injector?.get === 'function') { 
        this._appModuleType = 'angular';
      } else if (app && typeof app.select === 'function' && typeof appModule === 'function') { 
        this._appModuleType = 'nest';
      } else {
        this._appModuleType = 'no-match';
        Logger.warn('CQRS.setAppModule', `Could not auto-detect AppModuleType. Effects requiring DI might not work.`, {isPrint: true});
      }
    }
  };

  /**
   * @deprecated 依賴注入應由應用程式框架或專用的 DI 容器配置處理。
   * 向內部 InversifyJS 容器註冊 Providers (主要用於 'unit-test' 模式下的 Effect 解析)。
   * @param providers 要註冊的 Provider 類別數組。
   */
  setProviders = (providers: any[]): void => {
    Logger.warn('CQRS.setProviders', 'Method is deprecated. Dependency injection should be managed by the application framework or a dedicated DI setup.', {isPrint: true});
    providers.forEach((provider) => {
      if (typeof provider === 'function' && provider.prototype && provider.prototype.constructor === provider) {
        this.container.bind<typeof provider>(provider).toSelf().inSingletonScope(); 
      } else {
        Logger.warn('CQRS.setProviders', `Item is not a valid injectable class: ${provider}`, { isPrint: true });
      }
    });
  };

  /**
   * @deprecated 此方法使用了舊的 Reducer 註冊和 Store 初始化方式。
   *             應改為直接創建 `Store` 實例 (傳入完整的初始狀態和可選的 Middleware)，
   *             並使用 `Store.addReducer(featureKey, reducerFn)` 註冊由 `createReducer()` 建立的 Reducer 函式。
   * 初始化 Store 並註冊 Reducers (舊模式)。
   * @param reducersMap 一個物件，其鍵為 feature 名稱，值為舊版 Reducer 類別的實例。
   */
  forRootReducers = (reducersMap: TReducers): void => {
    Logger.warn('CQRS.forRootReducers', 'Method is deprecated. Instantiate Store directly and use Store.addReducer() with reducers created by createReducer().', {isPrint: true});
    if (typeof reducersMap !== 'object' || reducersMap === null || Array.isArray(reducersMap)) {
      Logger.error('CQRS.forRootReducers', 'Input `reducersMap` must be an object mapping feature keys to reducer instances.', { isPrint: true });
      return;
    }

    const initialStatesFromReducers: Partial<TStoreState> = {};
    Object.entries(reducersMap as any).forEach(([key, reducerInstance]: [string, OldReducer<any, any>]) => {
      if (reducerInstance && typeof reducerInstance.state !== 'undefined') {
        initialStatesFromReducers[key as keyof TStoreState] = reducerInstance.state;
      } else {
        Logger.warn('CQRS.forRootReducers', `Reducer for key "${key}" does not have a 'state' property or is undefined. Initial state for this feature might be missing.`, {isPrint: true});
      }
    });
    
    this._Store = new Store<TStoreState>(initialStatesFromReducers as TStoreState); // 假設 TStoreState 是聚合後的類型

    Object.entries(reducersMap as any).forEach(([key, reducerInstance]: [string, OldReducer<any, any>]) => {
      if (reducerInstance && typeof (reducerInstance as any).mapEventToState === 'function') {
            const featureKey = key;
            const reducerFn = (state: any, action: BaseAction) => (reducerInstance as any).mapEventToState(action, state);
            this._Store.addReducer(featureKey, reducerFn); // 使用新的 Store API
             Logger.log('CQRS.forRootReducers', `Adapted and registered legacy reducer for feature: ${featureKey}. Consider migrating to createReducer.`, {isPrint: Main.printMode === "detail"});
        } else {
         Logger.error('CQRS.forRootReducers', `Reducer for key "${key}" is not a valid legacy Reducer instance or lacks mapEventToState. Cannot adapt to new Store.addReducer().`, {isPrint: true});
      }
    });

    this.afterStoreIsInstantiated();
  };

  /**
   * @internal Store 實例化後執行的邏輯，主要用於設定 Store 的 Action 分發時機 (與 Effect 加載狀態相關)。
   *           此邏輯在新 Store 模型下可能需要調整或移除，因為 Store 的 Action 分發不再有 `isReadyToDispatch$` 控制。
   */
  private afterStoreIsInstantiated(): void {
    if (!this.Store) {
        Logger.error('CQRS.afterStoreIsInstantiated', 'Store is not available. Cannot proceed.', {isPrint: true});
        return;
    }
    this._isEffectLoadedSubscribe = of({}) 
      .pipe(
        delay(100), 
        mergeMap(() => this.isEffectLoaded$)
      )
      .subscribe(
        (isEffectLoaded) => {
          // Logger.log('CQRS.afterStoreIsInstantiated', `Effect loaded status: ${isEffectLoaded}. Main.isUseEffect: ${Main.isUseEffect}. Store readiness (conceptual) updated.`, {isPrint: Main.printMode === "detail"});
          // 新的 Store 沒有 isReadyToDispatch$ 屬性，此部分邏輯可能不再適用或需要其他方式實現應用就緒狀態。
          if (!Main.isUseEffect && isEffectLoaded && this._isEffectLoadedSubscribe && !this._isEffectLoadedSubscribe.closed) {
            asapScheduler.schedule(() => {
              if (this._isEffectLoadedSubscribe && !this._isEffectLoadedSubscribe.closed) {
                this._isEffectLoadedSubscribe.unsubscribe();
              }
            }, 500);
          }
        }
      );
  }

  /** @internal 用於重試 Effect 初始化的計數器。 */
  private effectRetryCount = 0;
  /** @internal 重試 Effect 初始化的間隔時間 (毫秒)。 */
  private readonly effectRetryInterval = 200;
  /** @internal BehaviorSubject，標記所有 Effects 是否已加載和註冊。 */
  private isEffectLoaded$ = new BehaviorSubject(false);

  /**
   * @deprecated 此方法使用了舊的 Effect 註冊方式和 DI 解析邏輯。
   *             應改為使用 `Store.addEffects()` 並傳入由 `createEffect()` 建立的 `EffectRunner`。
   *             DI 解析應由應用程式框架處理。
   * 初始化並註冊 Effects。
   * @param effects Effect 類別的數組。
   */
  forRootEffects = (effects: any[]): void => {
    Main.isUseEffect = true; 
    const startTime = DateTime.now();

    if (!this._appModule && this._appModuleType !== 'unit-test') {
      this.effectRetryCount++;
      Logger.warn('CQRS.forRootEffects', `AppModule not yet available for Effect DI. Retrying in ${this.effectRetryInterval}ms (Attempt ${this.effectRetryCount})...`, { isPrint: Main.printMode !== "none" });
      asapScheduler.schedule(() => this.forRootEffects(effects), this.effectRetryInterval);
      return;
    }
    
    if (this.effectRetryCount > 0) {
        Logger.log('CQRS.forRootEffects', `AppModule became available after ${this.effectRetryCount} retries. Proceeding with Effect initialization.`, { isPrint: Main.printMode === "detail" });
    }

    if (!Array.isArray(effects)) {
      Logger.error('CQRS.forRootEffects', 'Input `effects` must be an array of Effect classes.', { isPrint: true });
      return;
    }

    const effectRunners: EffectRunner[] = [];

    effects.forEach((effectClass) => {
      let effectInstance: any;
      try {
        switch (this._appModuleType) {
          case 'angular':
            effectInstance = this._appModule.injector.get(effectClass);
            break;
          case 'nest':
            effectInstance = this._app?.select(this._appModule)?.get(effectClass);
            if (!effectInstance) throw new Error(`Could not get instance of ${effectClass.name} from Nest module.`);
            break;
          case 'unit-test':
            if (!this.container.isBound(effectClass)) {
                 this.container.bind<typeof effectClass>(effectClass).toSelf().inSingletonScope();
            }
            effectInstance = this.container.resolve(effectClass);
            break;
          default:
            throw new Error(`Unsupported AppModuleType "${this._appModuleType}" or AppModule not correctly configured for Effect DI.`);
        }
      } catch (e: any) {
        Logger.error('CQRS.forRootEffects', `Failed to resolve Effect instance for ${effectClass.name}: ${e.message}`, { isPrint: true, payload: e });
        return; 
      }

      Object.keys(effectInstance).forEach(propName => {
        const propValue = effectInstance[propName];
        if (propValue instanceof Observable) {
          // 舊 Effect 返回 { result: Action | Action[], config: { dispatch: boolean } }
          // 新 EffectRunner 直接返回 Observable<BaseAction>
          // 此處嘗試適配舊的 Effect 結構到新的 EffectRunner
          const runner: EffectRunner = () => (propValue as Observable<any>).pipe(
            mergeMap(res => {
              // 檢查是否為舊的 Effect 格式
              if (res && typeof res === 'object' && res.hasOwnProperty('config') && res.hasOwnProperty('result')) {
                if (res.config.dispatch === true) {
                  return Array.isArray(res.result) ? of(...res.result) : of(res.result);
                }
                return of(); // 如果 config.dispatch 為 false，則不發出 Action
              }
              // 假設如果不是舊格式，則它已經是 Observable<BaseAction>
              return of(res as BaseAction); 
            })
          ) as Observable<BaseAction>;
          effectRunners.push(runner);
          Logger.log('CQRS.forRootEffects', `Prepared EffectRunner (possibly adapted from legacy Effect) from ${effectClass.name}.${propName}`, {isPrint: Main.printMode === "detail"});
        }
      });
    });

    if (effectRunners.length > 0 && this.Store) {
        this.Store.addEffects(...effectRunners);
    }
    
    this.isEffectLoaded$.next(true); 
    this.isEffectLoaded$.complete(); 

    const endTime = DateTime.now();
    const execTime = endTime.diff(startTime, 'milliseconds').toMillis();
    Logger.log('CQRS.forRootEffects', `Effects processing completed. ${effectRunners.length} EffectRunners prepared.`, { execTime, isPrint: Main.printMode === "detail" });
  };

  /** 
   * @deprecated `createFeatureSelector` 已移至 `selector.ts` 並採用新的 Store API (`Store.select`)。
   *             此處的賦值是為了向後兼容舊的用法，但不推薦。
   */
  createFeatureSelector = createFeatureSelector;
  /** 
   * @deprecated `createRelationSelector` 已移至 `selector.ts` 並採用新的 Store API (`Store.select` 配合 `createRelationSelector`)。
   *             此處的賦值是為了向後兼容舊的用法，但不推薦。
   */
  createRelationSelector = createRelationSelector;
}
