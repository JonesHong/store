import { asapScheduler, BehaviorSubject, delay, mergeMap, Observable, of, Subscription, take } from 'rxjs';
import { Action } from './action';
import { Reducer } from './reducer';
import { createFeatureSelector, createRelationSelector } from './selector';
import { Store } from './store';
import { Effect } from './effect';
import { RelationshipFromJDL } from './interface/relation.interface';
import { Relation } from './relation';
import _ from 'lodash';
// import { createClient, RedisClientOptions, RedisClientType, RedisDefaultModules, RedisModules, RedisScripts } from 'redis';
// import { CacheService, RedisOptions } from "./cache";
import { Container } from 'inversify';
import { Logger } from './logger';
import { envType } from './env_checker';
import { DateTime } from 'luxon';
import { Singleton } from './decoratios/singleton';
// import 'reflect-metadata';

// export const CqrsContainer = new Container();
// CqrsContainer.bind(AppService).toSelf();

@Singleton
class _Main {
  private static instance: _Main;
  public static getInstance: () => _Main;
  private constructor() { }
  public isLogByFIle$: BehaviorSubject<boolean> = new BehaviorSubject(false);
  // public get isLogByFIleSubject() {
  //   return this._isLogByFIle$;
  // }
  // public get isLogByFIle$() {
  //   return this._isLogByFIle$.asObservable();
  // }
  // public get isLogByFIle() {
  //   return this._isLogByFIle$.value;
  // }
  // public readonly isLogByFIle: boolean = false;
  /** 
   * **detail:** log & warn & error  
   * **expectLog:** warn & error  
   * **none:** disable all print in mycena-store  
  */
  public printMode: "detail" | "expectLog" | "none" = "none";
  public isUseEffect: boolean = false;



}
export const Main = _Main.getInstance();
export class CQRS<initialState, Reducers> {
  private _Store: Store<initialState, Reducers>;
  private _container = new Container();
  private _appModule;
  private _app;
  private _appModuleType: 'nest' | 'angular' | 'unit-test' | 'no-match';

  public get container(): Container {
    return this._container;
  }
  public get appModule() {
    return this._appModule;
  }
  public get appModuleType() {
    return this._appModuleType;
  }

  public get Store(): Store<initialState, Reducers> {
    return this._Store;
  }

  public get Actions(): Observable<Action> {
    return this._Store.getBroadcast().asObservable();
  }
  private _isEffectLoadedSubscribe: Subscription;
  constructor() { }
  public get relationshipFromJDL(): RelationshipFromJDL {
    return Relation.RelationshipFromJDL;
  }
  seRelationshipFromJDL = (RelationshipFromJDL: RelationshipFromJDL): void => {
    Relation.RelationshipFromJDL = RelationshipFromJDL;
  };
  /**
   *
   * @param appModuleType
   */
  setAppModuleType(appModuleType: 'nest' | 'angular' | 'unit-test') {
    this._appModuleType = appModuleType;
    if (appModuleType == 'unit-test') {
      this.isEffectLoaded$.next(true);
    }
  }
  setAppModule = (appModule, app?: any) => {
    this._appModule = appModule;
    if (!!app) this._app = app;
    if (!this._appModuleType) {
      let _logger = Logger.warn(
        'CQRS',
        `You don't set appModuleType yet, it will auto match with appModule you provide!`,
        { isPrint: Main.printMode !== "none" }
      );
      if (envType == 'browser' && _logger['options']['isPrint'])
        console.warn(_logger['_str']);
      if (!!('injector' in appModule)) {
        this._appModuleType = 'angular';
      } else if (!!app && !!('select' in app)) {
        this._appModuleType = 'nest';
        // this.createRedis();
      } else {
        this._appModuleType = 'no-match';
        // this.isEffectLoaded$.next(true);
      }
    }
  };
  // private _Redis = CacheService.Redis;
  private _RedisOptions;
  // setRedis(options?: RedisOptions) {
  //     this._RedisOptions = options;
  //     if (this._appModuleType == "nest")
  //         this.createRedis();
  // }
  // private async createRedis() {
  //     // console.log(this._appModuleType, this.Store.reducers)
  //     if (this._appModuleType == "nest") {
  //         CacheService.createRedis(this._RedisOptions);
  //         await CacheService.Redis.json.set("test", '.', { node: 3334 });
  //         Object.values(this.Store.reducers).map(async (reducer: Reducer<any, any>) => {
  //             reducer.addService(CacheService);
  //             console.log(reducer._name)
  //             await CacheService.Redis.json.set(reducer._name, '.', {});
  //         })
  //         // }
  //         // if (!this.Store) {
  //         //     // asapScheduler.schedule(() => {
  //         //     //     this.setcreateRedisRedis();
  //         //     // }, 500)
  //         // }
  //     } else {
  //         console.error(`[Error/Main] setRedis isn't handle ${this._appModuleType}`);
  //     }
  // }
  setProviders = (providers: any[]): void => {
    providers.forEach((provider) => {
      this.container.bind<typeof provider>(provider).toSelf();
    });
  };
  forRootReducers = (reducers: Reducers): void => {
    if (typeof reducers !== 'object' || Array.isArray(reducers)) {
      // console.error(`[Error/forRootReducers] Input must be a object.`);
      let _logger = Logger.error(
        'forRootReducers', 'Input must be a object.',
        { isPrint: Main.printMode !== "none" }
      );
      if (envType == 'browser' && _logger['options']['isPrint'])
        console.error(_logger['_str']);
      return null;
    }


    let store = new Store<initialState, Reducers>();
    let reducersList: [string, Reducer<any, any>][] = Object.entries(reducers);
    let initialState: any = reducersList.reduce((res, reducerEntry) => {
      let _key = reducerEntry[0],
        _reducer = reducerEntry[1];
      res[_key] = _reducer['state'];
      return res;
    }, {});
    store.setInitial(reducers, initialState);
    store.setCQRS(this);

    reducersList.map((reducerEntry) => {
      let _key = reducerEntry[0],
        _reducer = reducerEntry[1];
      _reducer.setStore(store);
      _reducer.initialHandler();
    });
    this._Store = store;
    // this._Store = this.StoreMatchReducer(reducers);
    // this.StoreMatchReducer(reducers);
    // this._StoreClone = this.StoreMatchReducer(_.cloneDeep(reducers));

    this.AfterStoreIsInstantiated();
  };
  private AfterStoreIsInstantiated() {
    this._isEffectLoadedSubscribe = of({})
      .pipe(
        delay(1000),
        mergeMap(() => this.isEffectLoaded$)
      )
      .subscribe(
        (isEffectLoaded) => {
          !!Main.isUseEffect ?
            this._Store.isReadyToDispatch$.next(isEffectLoaded) : // 有使用 Effect
            this._Store.isReadyToDispatch$.next(true); // 沒有使用 Effect

          if (!Main.isUseEffect && !!isEffectLoaded) {
            // unsubscribe after 0.5s
            asapScheduler.schedule(() => {
              this._isEffectLoadedSubscribe.unsubscribe();
            }, 500);
          }
        }
      );
  }

  private effectRetryCount = 0;
  private effectRetryInterval = 100;
  private isEffectLoaded$ = new BehaviorSubject(false);
  private timeLabelSet = new Set([]);
  forRootEffects = (effects: any[]): void => {
    Main.isUseEffect = true;
    let _beforeExec = DateTime.now();
    if (!!!this._appModule && this._appModuleType !== 'unit-test') {
      // if AppModule is not ready, retry 0.1s later.
      this.effectRetryCount += 1;
      asapScheduler.schedule(() => {
        this.forRootEffects(effects);
      }, this.effectRetryInterval);
      return null;
    }
    {
      let _logger = Logger.log(
        'forRootEffects',
        `forRootEffects is loaded successfully in ${this.effectRetryCount} times.`,
        { isPrint: Main.printMode == "detail" }
      );
      if (envType == 'browser' && _logger['options']['isPrint'])
        console.log(_logger['_str']);
    }
    this.isEffectLoaded$.next(true);
    if (typeof effects !== 'object' || !Array.isArray(effects)) {
      let _logger = Logger.error(
        'forRootEffects', 'Input must be an array.',
        { isPrint: Main.printMode !== "none" }
      );
      if (envType == 'browser' && _logger['options']['isPrint'])
        console.error(_logger['_str']);
      return null;
    }

    effects.map((effect) => {
      let effectInstance;
      switch (this._appModuleType) {
        case 'angular':
          effectInstance = this._appModule.injector.get(effect);
          break;
        case 'nest':
          effectInstance = this._app.select(this._appModule).get(effect);
          break;
        case 'unit-test':
          this.container.bind<typeof effect>(effect).toSelf();
          effectInstance = this.container.resolve(effect);
          break;
        default:
          let _logger = Logger.error(
            'forRootEffects',
            'Please check AppModule.',
            { isPrint: Main.printMode !== "none" }
          );
          if (envType == 'browser' && _logger['options']['isPrint'])
            console.error(_logger['_str']);
          break;
      }
      let effectName = effectInstance['constructor']['name'],
        effectInstanceEntries: [string, any][] = Object.entries(effectInstance);

      effectInstanceEntries.map((entry) => {
        let _effectPropsName = entry[0],
          _effectPropsValue: Effect = entry[1];
        if (!!_effectPropsValue.subscribe) {

          _effectPropsValue?.subscribe((res) => {
            if (res['config']['dispatch'] == true) {
              // res['result']?.addTraversal(
              //   `${effectName}.${_effectPropsName}`
              // );

              if (Array.isArray(res['result'])) {
                this._Store.dispatches(res['result']);
              } else {
                this._Store.dispatch(res['result']);
              }
            } else {
              // console.log(`It won't dispatch:`, res)
            }
          });
        }
      });
    });
    let _afterExec = DateTime.now();
    let execTime = _afterExec.diff(_beforeExec, 'milliseconds').toMillis();
    {
      let _logger = Logger.log(
        'forRootEffects',
        `forRootEffects loaded successfully.`,
        { execTime, isPrint: Main.printMode == "detail" }
      );
      if (envType == 'browser' && _logger['options']['isPrint'])
        console.log(_logger['_str']);
    }
  };

  createFeatureSelector = createFeatureSelector;
  createRelationSelector = createRelationSelector;
}



// console.error("Hello world!!! 2034/04/12");