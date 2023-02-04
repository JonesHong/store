import { asapScheduler, BehaviorSubject, delay, mergeMap, Observable, of, Subscription, take } from 'rxjs';
import { Action } from './action';
import { Reducer } from './reducer';
import { createFeatureSelector } from './selector';
import { Store } from './store';
import { Effect } from './effect';
import { IEntityRelationConfig, RelationshipByType, RelationshipFromJDL, RelationshipConfigTable } from './interface/relation.interface';
import { Relation } from './relation';
import * as _ from 'lodash';
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
  private _isLogByFIle$: BehaviorSubject<boolean> = new BehaviorSubject(false);
  public get isLogByFIle$() {
    return this._isLogByFIle$.asObservable();
  }
  public get isLogByFIle() {
    return this._isLogByFIle$.value;
  }
  // public readonly isLogByFIle: boolean = false;
  public printMode: "dev" | "prod" = "dev";
  public isUseEffect: boolean = false;



}
export const Main = _Main.getInstance();
export class CQRS<initialState, Reducers> {
  // private _StoreState$: BehaviorSubject<initialState> = new BehaviorSubject(null);
  private _Store: Store<initialState, Reducers>;
  private _StoreRelationSubs;
  // private _Actions$: BehaviorSubject<Action> = new BehaviorSubject(null);
  private _StoreWithRelation$: BehaviorSubject<initialState> = new BehaviorSubject(null);
  private _StoreClone: Store<initialState, Reducers>;
  private _container = new Container();
  private _appModule;
  private _app;
  private _appModuleType: 'nest' | 'angular' | 'unit-test' | 'no-match';

  // private _eventsCache: Action[] = [];
  // private _relationConfig: IEntityRelationConfig;
  // private _relationshipByType: RelationshipByType = {
  //   OneToOne: new Set(),
  //   OneToMany: new Set(),
  //   ManyToOne: new Set(),
  //   ManyToMany: new Set(),
  // };
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

  // public get StoreSate(): Observable<initialState> {
  //   return this._StoreState$;
  // }

  public get StoreWithRelation() {
    return this._StoreWithRelation$;
  }

  private StoreWithRelationSubs(): void {
    // if (!this._Store) {
    //     console.error("[Error/StoreWithRelation] Store doesn't exist.")
    //     return null
    // }
    // if (!this._relationConfig) {
    //     console.error("[Error/StoreWithRelation] RelationConfig doesn't exist.")
    //     return null
    // }
    if (!!this._Store && !!this.relationshipFromJDL && !this._StoreRelationSubs) {
      // this._StoreRelationSubs = Relation.StoreRelation<initialState, Reducers>(this._Store, this.relationshipFromJDL).subscribe((data: initialState) => {
      //   this._StoreWithRelation$.next(data);
      // });
    }
    // let _Relation = Relation.getInstance()
    // console.log(328023098, this._Store)
    // return RelationManager.getStoreWithRelation_v1<initialState, Reducers>(this._Store, { config: this._relationConfig });
    // this._Store.settlement$.pipe(
    //     // tap(res=>{console.log(32023879923,res)}),
    //     RelationManager.StoreRelation<initialState, Reducers>(this._Store, this._relationConfig),
    //     // tap(res=>{console.log(80982309,res)}),
    // )
  }
  public get Actions(): Observable<Action> {
    return this._Store.getBroadcast().asObservable();
  }
  private _isEffectLoadedSubscribe: Subscription;
  constructor() { }
  public get relationshipConfigTable(): RelationshipConfigTable {
    return Relation.RelationshipConfigTable;
  }
  public get relationshipFromJDL(): RelationshipFromJDL {
    return Relation.RelationshipFromJDL;
  }
  // setRelationshipConfigTable = (RelationshipConfigTable: RelationshipConfigTable): void => {
  //   Relation.RelationshipConfigTable = RelationshipConfigTable;
  // };
  seRelationshipFromJDL = (RelationshipFromJDL: RelationshipFromJDL): void => {
    Relation.RelationshipFromJDL = RelationshipFromJDL;
    // this.Store.withRelation
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
      // console.warn(
      //   `[Warning/CqrsMain] You don't set appModuleType yet, it will auto match with appModule you provide!`
      // );
      let _logger = Logger.warn(
        'CqrsMain',
        `You don't set appModuleType yet, it will auto match with appModule you provide!`
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
    // console.log("_appModuleType", this._appModuleType)
    // console.log("appModule", appModule)
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
      let _logger = Logger.error('forRootReducers', 'Input must be a object.');
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
    store.setMain(this);

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
    // asapScheduler.schedule(() => {
    // this._Store.subscribe((res) => {
    //   // this._StoreState$.next(res);
    // });
    this.StoreWithRelationSubs();
    // }, 1000)
    this._isEffectLoadedSubscribe = of({})
      .pipe(
        delay(1000),
        mergeMap(() => this.isEffectLoaded$)
      )
      .subscribe(
        (isEffectLoaded) => {
          !!Main.isUseEffect ?
            this._Store.isReadyToDispatch$.next(isEffectLoaded) : // 有使用 Effect
            this._Store.isReadyToDispatch$.next(true);
          // this._Store.getBroadcast().subscribe(res => {
          //     this._Actions$.next(res);
          // });
          // this._StoreClone.isReadyToDispatch$.next(isEffectLoaded);

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
    // let _timeLabel = '[Loaded] forRootEffects successfully.';
    // if (!this.timeLableSet.has(_timeLabel)) {
    //   this.timeLableSet.add(_timeLabel);
    //   console.time(_timeLabel);
    // }
    // let container = new Container();
    // console.log(444, effects)
    // asapScheduler.schedule(() => {
    if (!!!this._appModule && this._appModuleType !== 'unit-test') {
      // if AppModule is not ready, retry 0.1s later.
      this.effectRetryCount += 1;
      asapScheduler.schedule(() => {
        // console.log(99999, effects)
        this.forRootEffects(effects);
      }, this.effectRetryInterval);
      return null;
    }
    // console.log(
    //   `[Log/forRootEffects] forRootEffects is loaded successfully in ${this.effectRetryCount} times.`
    // );
    {
      let _logger = Logger.log(
        'forRootEffects',
        `forRootEffects is loaded successfully in ${this.effectRetryCount} times.`
      );
      if (envType == 'browser' && _logger['options']['isPrint'])
        console.log(_logger['_str']);
    }
    this.isEffectLoaded$.next(true);
    if (typeof effects !== 'object' || !Array.isArray(effects)) {
      // console.error(`[Error/forRootEffects] Input must be an array.`);
      let _logger = Logger.error('forRootEffects', 'Input must be an array.');
      if (envType == 'browser' && _logger['options']['isPrint'])
        console.error(_logger['_str']);
      return null;
    }
    // console.log(88888, effects)
    // await Promise.all(
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
          // console.log(33333, effectInstance)
          this.container.bind<typeof effect>(effect).toSelf();
          effectInstance = this.container.resolve(effect);
          // let effectInstance = new effect();
          break;
        default:
          // console.error('[Error/forRootEffects] Please check AppModule.');
          let _logger = Logger.error(
            'forRootEffects',
            'Please check AppModule.'
          );
          if (envType == 'browser' && _logger['options']['isPrint'])
            console.error(_logger['_str']);
          break;
      }
      let effectName = effectInstance['constructor']['name'],
        effectInstanceEntries: [string, any][] = Object.entries(effectInstance);
      // await Promise.all(
      effectInstanceEntries.map((entry) => {
        let _effectPropsName = entry[0],
          _effectPropsValue: Effect = entry[1];
        // console.log(888, _effectPropsName, _effectPropsValue)
        if (!!_effectPropsValue.subscribe) {
          // console.log(444)
          _effectPropsValue?.subscribe((res) => {
            // if (_effectPropsName == "test$") console.log(888, res)
            // console.log(92830238, _effectPropsName)
            if (res['config']['dispatch'] == true) {
              res['sourceFun']?.addTraversal(
                `${effectName}.${_effectPropsName}`
              );
              // console.log(`It will dispatch:`, res)
              this._Store.dispatch(res['sourceFun']);
            } else {
              // console.log(`It won't dispatch:`, res)
            }
          });
        }
      });
      // )
    });
    // )
    let _afterExec = DateTime.now();
    let execTime = _afterExec.diff(_beforeExec, 'milliseconds').toMillis();
    {
      let _logger = Logger.log(
        'forRootEffects',
        `forRootEffects loaded successfully.`,
        { execTime }
      );
      if (envType == 'browser' && _logger['options']['isPrint'])
        console.log(_logger['_str']);
    }
    // }, 3000)
  };

  createFeatureSelector = createFeatureSelector;
}

// require("../example/index")
// import { ReducerPaginationPipe } from "./pipes/pagination.pipe";
// ReducerPaginationPipe({ "limit": 111 })

// Logger.log('Dev', '124');
// Logger.log('Dev', '5678', { isPrint: false });
// var getStackTrace = function () {
//   var obj = {};
//   Error.captureStackTrace(obj, getStackTrace);
//   return obj['stack'];
// };
// Logger.log('Dev', '999999');

// https://stackoverflow.com/questions/52595559/how-to-log-js-stack-trace-with-console-trace-but-keep-it-collapsed
// console.groupCollapsed();
// Logger.log("Dev", "8888")
// console.trace();
// console.groupEnd();
// let testLogger = Logger.log

// testLogger("Dev", "123")
