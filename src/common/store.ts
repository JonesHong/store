import _ from "lodash";
import { asapScheduler, BehaviorSubject, concat, EmptyError, forkJoin, from, Observable, of, pipe, Subscription, throwError } from "rxjs";
// import { addToSubscription } from "./store.interface";
import { Broker } from "./broker";
import { Action, AddMany, RemoveMany, SetMany } from "./action";
import { Reducer } from "./reducer";
import { selectRelevanceEntity } from "./selector";
import { CQRS, Main } from "./main";
import { EntityState } from "./interface/adapter.interface";
import { Settlement } from "./interface/store.interface";
import { v4 as uuidv4 } from "uuid"
import { catchError, defaultIfEmpty, delay, filter, last, map, mergeMap, tap, toArray } from "rxjs/operators";
import { SettlementChanged } from "./pipes/_some.pipe";
import { JDLObject, RelationshipConfig, RelationshipConfigTable } from "./interface/relation.interface";
import { Entity } from "./entity";
import { addMany, addOne, removeOne, setOne, upsertOne } from "./adapter";
import { camelCase, pascalCase } from "change-case";
import { Relation } from "./relation";
import { Logger } from "./logger";
import { envType } from "./env_checker";
// import { CacheService } from "./cache";


/**
 * Split of writing functionality
 * Focus on reading repositories
 * 
 * Store doesn't depend on any one.
 * 
 */
export class Store<initialState, Reducers> extends Broker {
  static isStoreCreated = false;
  // _name: string = "Store";
  _storeId = `store-${uuidv4()}`;
  private subscriptionMap: Map<string, Subscription> = new Map()
  private subscription: Subscription = new Subscription()
  // private _lastSettlement: settlement;
  private _CQRS: CQRS<initialState, Reducers>;
  private _reducers: Reducers;
  // private _withRelation: initialState;
  private _withRelation$: BehaviorSubject<initialState> = new BehaviorSubject(null);

  public get withRelation() {
    return this._withRelation$.value;
  }
  public get withRelation$() {
    return this._withRelation$.asObservable()
  }
  public get reducers() {
    return this._reducers
  }
  private _state$: BehaviorSubject<initialState>;
  public get state$() {
    return this._state$.asObservable()
  }
  public get state() {
    return this._state$.value
  }
  private _settlement$: BehaviorSubject<Settlement> = new BehaviorSubject(null);
  public get settlement$() {
    return this._settlement$.asObservable()
      .pipe(
      // SettlementChanged()
      // SettlementChanged(this._settlement$)
    );
  }
  // private _settlementsLogSize = 100;
  // private _settlementsLog = [];

  constructor() {
    super();
    this._storeInitial();
  }
  private _storeInitial(): void {
    if (!!!this._settlement$) {
      asapScheduler.schedule(() => { this._storeInitial(); }, 100)
      return;
    }
    // this.settlement$.subscribe(settlement => {
    //   this._settlementsLog.push(settlement);
    //   // if (this._settlementsLog.length > CacheService.maxConfig._settlementsLogSize) this._settlementsLog = this._settlementsLog.slice(1);
    // })
  }

  setCQRS(cqrs: CQRS<initialState, Reducers>) {
    this._CQRS = cqrs;
  }
  setInitial(reducers: Reducers, initialState: initialState) {
    this._reducers = reducers;
    this._state$ = new BehaviorSubject(initialState);

    if (!this.withRelation) {
      let stateClone = _.cloneDeep(this.state);

      if (!stateClone['_']) stateClone['_'] = {};
      this._withRelation$.next(stateClone)
      this.buildRelationStore()
    }
  }
  // count = 0
  addReducer(reducer: Reducer<any, any>): void {
    let keywordToSlice = reducer?._name?.search(/Reducer/);
    // console.log(keywordToSlice, reducer)
    if (keywordToSlice == -1) {
      let _logger = Logger.error(
        'Store',
        `The reducer's name need to be includes "Reducer" .`,
        { isPrint: Main.printMode !== "none" }
      );
      if (envType == 'browser' && _logger['options']['isPrint'])
        console.error(_logger['_str']);
      return null;
    }
    let reducerName = reducer?._name?.slice(0, keywordToSlice);
    reducerName = camelCase(reducerName);
    if (!reducerName) {
      let _logger = Logger.error(
        'Store',
        `The reducer need to be an Class.`,
        { isPrint: Main.printMode !== "none" }
      );
      if (envType == 'browser' && _logger['options']['isPrint'])
        console.error(_logger['_str']);

      return null;
    }
    if (!reducer?.listen) {
      let _logger = Logger.error(
        'Store',
        `The reducer need to be an BLoC.`,
        { isPrint: Main.printMode !== "none" }
      );
      if (envType == 'browser' && _logger['options']['isPrint'])
        console.error(_logger['_str']);

      return null;
    }
    if (!reducer?.setStore) {
      let _logger = Logger.error(
        'Store',
        `The reducer need to be extends Reducer.`,
        { isPrint: Main.printMode !== "none" }
      );
      if (envType == 'browser' && _logger['options']['isPrint'])
        console.error(_logger['_str']);

      return null;
    }
    if (this.subscriptionMap.has(reducerName)) {
      let _logger = Logger.warn(
        'Store',
        `Reducer already exist.`,
        { isPrint: Main.printMode !== "none" }
      );
      if (envType == 'browser' && _logger['options']['isPrint'])
        console.warn(_logger['_str']);
      return null;
    }
    let reducer$;
    reducer$ = reducer.listen(state => {
      let newState = this.state;
      newState[reducerName] = state;
      this._state$.next(newState);
      let _settlement: Settlement = {
        reducerName,
        _previousHash: state['_previousHash'],
        _currentHash: state['_currentHash'],
        lastSettlement: state['lastSettlement']
      }
      this._settlement$.next(_settlement);
    })
    this._reducers[reducerName] = reducer;
    this.subscription.add(reducer$);
    this.subscriptionMap.set(reducerName, reducer$);
    reducer.setStore(this);
  }


  subscribe(next?: (state: initialState) => void, error?: (error: any) => void, complete?: () => void): Subscription {
    return this.state$.subscribe({ next, error, complete })
  }



  /**
   * 如果直接 cloneDeep(Store) 的話，每次更新都要重新綁全部的邏輯  
   * 所以根據 settlement 的結果修正 RelationStore中的 state  
   * 然後只重新綁訂有更新部分的關係，以達到最小消耗
   */
  private buildRelationStore = () => {
    // let { relationshipConfigTable } = this._CQRS;
    // if (!this._withRelation) this._withRelation = _.cloneDeep(this.state);
    let StateClone: initialState = this._withRelation$.value,
      theReducer: Reducer<any, any>,
      theState: EntityState<any>;
    let JDLObject: JDLObject,
      RelationshipConfigTable: RelationshipConfigTable,
      SettlementClone: Settlement,
      LastSettlementToValues: { create: any[]; update: any[]; delete: string[] },
      theConfig: RelationshipConfig,
      LastSettlementToEntity: { create: Entity[]; update: Entity[] } = { create: [], update: [] };
    this.settlement$
      .pipe(
        // tap(settlement => console.log(8928038, settlement)),
        filter((settlement) => !!settlement && !!StateClone && !!Relation.RelationshipConfigTable),
        map(settlement => {
          // 這個 operator 的目的是；整理最新 settlement 的結果   
          RelationshipConfigTable = Relation.RelationshipConfigTable;
          SettlementClone = _.cloneDeep(settlement);
          let { lastSettlement } = SettlementClone;
          let { reducerName } = SettlementClone;

          // StateClone['_']['settlement'] = SettlementClone;
          theReducer = this.reducers[reducerName]; // e.g. group
          theState = StateClone[reducerName];
          theState['lastSettlement'] = lastSettlement;
          theState['_currentHash'] = SettlementClone['_currentHash'];
          theState['_previousHash'] = SettlementClone['_previousHash'];

          LastSettlementToValues = {
            // create: Object.keys(lastSettlement['create']).map((key) => lastSettlement['create'][key]),
            // update: Object.keys(lastSettlement['update']).map((key) => lastSettlement['update'][key]),
            // delete: Object.keys(lastSettlement['delete']).map((key) => lastSettlement['delete'][key]),
            create: Object.values(lastSettlement['create']),
            update: Object.values(lastSettlement['update']),
            delete: Object.values(lastSettlement['delete']),
          };
          LastSettlementToEntity = { create: [], update: [] }; // new! 需要歸零否則會一直累進 -20230715
          if (LastSettlementToValues['create'].length !== 0) {
            LastSettlementToEntity['create'] = theReducer.createEntities(LastSettlementToValues['create']);
            theState = addMany(LastSettlementToEntity['create'], theState);
          }
          if (LastSettlementToValues['update'].length !== 0) {
            Array.from(LastSettlementToValues['update'])
              .map((entityData) => {
                let theEntity: Entity = theState['entities'][entityData['id']];
                // 斷開所有連結，稍後會重建
                // theEntity.breakAllEntityRelationships();
                // let newEntity = theReducer.createEntity(entityData);

                // 斷開所有連結
                theEntity.killItSelf(false);
                let newEntity = theEntity.upsertData(entityData);
                LastSettlementToEntity['update'].push(newEntity);
                // theState = setOne(newEntity, theState);
                return entityData;
              })
          };
          if (LastSettlementToValues['delete'].length !== 0) {
            Array.from(LastSettlementToValues['delete'])
              .map((id: string) => {
                let theEntity: Entity = theState['entities'][id];
                // 斷開所有連結
                theEntity.killItSelf();
                // 從 state中刪除
                theState = removeOne(id, theState);
              })
          }
          StateClone[reducerName] = theState;
          // if (reducerName == "user") {
          //   console.log(theState.ids)
          // }
          return { SettlementClone, reducerName };
        }),
        // delay(50),
        mergeMap(({ SettlementClone, reducerName }) => {
          // 這個 operator 的目的是；針對 settlement 中的 create, update 的部分重建關係
          // SettlementClone.reducerName
          let { lastSettlement } = SettlementClone;
          let isCreateLengthBeZero = lastSettlement['create'].length == 0,
            isUpdateLengthBeZero = lastSettlement['create'].length == 0;
          const RelationBuilderObservable = (EntityList: Entity[]) => {

            theConfig = RelationshipConfigTable[pascalCase(reducerName)]; // e.g. Group
            // console.log('EntityList: ', EntityList, theConfig)
            // 遍歷所有的 Entity
            return from(EntityList)
              .pipe(
                mergeMap((entity: Entity) => {
                  if (!theConfig || theConfig['_relationshipOptions'].length == 0) {
                    // 如果這個 Entity 並未設定關係的話跳過
                    return of(null)
                  }
                  // 遍歷這個 Entity 所有的 relationConfig

                  // entity = entity.breakAllEntityRelationships();
                  return from(theConfig['_relationshipOptions'])
                    .pipe(
                      map((relationshipOption) => {
                        // 根據 relationOption 的 input
                        // 去找尋它現在在 State 的狀況
                        // 找到跟我有關的所有 Entities去建立關係

                        let thisEntityName = camelCase(relationshipOption.thisEntityOptions.entity); // e.g. billOfMaterials
                        let inputEntityName = camelCase(relationshipOption.inputEntityOptions.entity); // e.g. subTask

                        const findRelevanceAndBuildUp = (ForeignKey: string, ForeignKeyValue: string) => {
                          // let inputReducerState = StateClone[inputEntityName];
                          let relevanceEntities = selectRelevanceEntity(
                            StateClone[inputEntityName],
                            {
                              key: ForeignKey,
                              value: ForeignKeyValue // string
                            }
                          );
                          // console.log(8930223, JSON.stringify({ inputEntityName, ForeignKey, ForeignKeyValue }));
                          // console.log('relevanceEntities: ', relevanceEntities);
                          if (relevanceEntities.length !== 0) {
                            for (const relevanceEntity of relevanceEntities) {
                              entity.buildRelationship(
                                relevanceEntity,
                                relationshipOption
                              )
                            }
                          }
                        }

                        // let ForeignKey = relationshipOption['inputEntityOptions']['displayField'],
                        // ForeignKeyValue = entity[relationshipOption['thisEntityOptions']['displayField']];
                        // // 目前想到有三種可能: string. string[], Relationship[]

                        switch (relationshipOption.RelationType) {
                          case "OneToOne":
                          case "OneToMany":
                          case "ManyToOne": {
                            // 拿自己 displayField的值，去對方的 displayField想找關練值 ForeignKey

                            // let inputReducerState = StateClone[inputEntityName];
                            let ForeignKey = relationshipOption['inputEntityOptions']['displayField'],
                              ForeignKeyValue = entity[relationshipOption['thisEntityOptions']['displayField']];
                            findRelevanceAndBuildUp(ForeignKey, ForeignKeyValue);
                            break;
                          }
                          case "ManyToMany": {
                            // 拿自己 displayField[]的值，去對方的 displayField想找關練值 ForeignKey[]
                            let defaultRelationKey = 'id';
                            let ForeignKeyValues: any[] = entity[relationshipOption['thisEntityOptions']['displayField']];
                            if (!!!ForeignKeyValues || ForeignKeyValues.length == 0) break;  // new! 考慮到 non-sql，忽略空值不綁關係 -20230715
                            for (const ForeignKeyValue of ForeignKeyValues) {
                              // 有兩種可能 string[] or Relationship[]
                              switch (typeof ForeignKeyValues) {
                                case "string": {
                                  // 是 string[]
                                  findRelevanceAndBuildUp(defaultRelationKey, ForeignKeyValue);
                                  break;
                                }
                                case "object": {
                                  // 是 RelationShip[]
                                  findRelevanceAndBuildUp(defaultRelationKey, ForeignKeyValue[defaultRelationKey]);
                                  break;
                                }
                                default: {
                                  let _logger = Logger.error(
                                    'Store',
                                    `buildRelationStore.RelationBuilderObservable RelationValue type is not supported!`,
                                    { isPrint: Main.printMode !== "none" }
                                  );
                                  if (envType == 'browser' && _logger['options']['isPrint'])
                                    console.error(_logger['_str']);
                                  break;
                                }
                              }

                            }
                            // let inputReducerState = StateClone[inputEntityName];

                            break;
                          }
                        }
                      })
                    )
                })
              )
          }
          let create$ = RelationBuilderObservable(LastSettlementToEntity['create']),
            update$ = RelationBuilderObservable(LastSettlementToEntity['update']);
          return concat(
            isCreateLengthBeZero ? of(null) : create$,
            isUpdateLengthBeZero ? of(null) : update$
          ).pipe(
            // last(),
            toArray(),
          )
        }),
        map(() => StateClone),
        catchError(error => {
          if (error instanceof EmptyError) {
            // 执行一些处理
            console.log('Settlement$ 已经空了，這不應該發生。');
            return of(StateClone);
          } else {
            console.error(error);
            return throwError(() => new Error('test'));
          }
        }),
      )
      .subscribe(
        {
          next: (val) => {
            // console.log('Observable next')
            this._withRelation$.next(val);
          },
          error: (err) => {

          },
          complete: () => console.log('Settlement$ 完成了，這不應該發生，RelationStore會壞掉')
        }
      );
  }


}

// interface StoreMain<initialState, Reducers> {
//   forRoot<initialState, Reducers>(reducers: Reducers): _Store<initialState, Reducers>;
//   // _Store:S

// }

export const settlementToObject = () => {
  return pipe(
    map((settlement: Settlement) => {
      let _payload = [],
        _create = Object.values(settlement.lastSettlement['create']),
        _update = Object.values(settlement.lastSettlement['update']),
        _delete = Object.values(settlement.lastSettlement['delete']);

      // _create = Object.keys(settlement.lastSettlement['create']).map((key) => settlement.lastSettlement['create'][key]),
      // _update = Object.keys(settlement.lastSettlement['update']).map((key) => settlement.lastSettlement['update'][key]),
      // _delete = Object.keys(settlement.lastSettlement['delete']).map((key) => settlement.lastSettlement['delete'][key]);
      if (_create.length !== 0) {
        _payload.push(
          new AddMany(
            settlement.reducerName,
            _create
          ).toObject()
        )
      }
      if (_update.length !== 0) {
        _payload.push(
          new SetMany(
            settlement.reducerName,
            _update
          ).toObject()
        )
      } if (_delete.length !== 0) {
        _payload.push(
          new RemoveMany(
            settlement.reducerName,
            _delete
          ).toObject()
        )
      }
      return _payload;
    })
  )
}