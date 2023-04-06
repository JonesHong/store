import * as _ from "lodash";
import { asapScheduler, BehaviorSubject, concat, from, Observable, of, pipe, Subscription } from "rxjs";
// import { addToSubscription } from "./store.interface";
import { Broker } from "./broker";
import { Action, AddMany, RemoveMany, SetMany } from "./action";
import { Reducer } from "./reducer";
import { selectRelevanceEntity } from "./selector";
import { CQRS, Main } from "./main";
import { EntityState } from "./interface/adapter.interface";
import { Settlement } from "./interface/store.interface";
import { v4 as uuidv4 } from "uuid"
import { catchError, filter, last, map, mergeMap, tap } from "rxjs/operators";
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
  public get withRelation$(): BehaviorSubject<initialState> {
    return this._withRelation$
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
        SettlementChanged()
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
    let StateClone = this._withRelation$.value,
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
        // tap(settlement => console.log),
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
          theConfig = RelationshipConfigTable[pascalCase(reducerName)]; // e.g. Group

          LastSettlementToValues = {
            create: Object.values(lastSettlement['create']),
            update: Object.values(lastSettlement['update']),
            delete: Object.values(lastSettlement['delete']),
          };
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
                theEntity.breakAllEntityRelationships();
                // 從 state中刪除
                theState = removeOne(id, theState);
              })
          }
          StateClone[reducerName] = theState;
          return { SettlementClone, reducerName };
        }),
        mergeMap(({ SettlementClone, reducerName }) => {
          // 這個 operator 的目的是；針對 settlement 中的 create, update 的部分重建關係

          let { lastSettlement } = SettlementClone;
          let isCreateLengthBeZero = lastSettlement['create'].length == 0,
            isUpdateLengthBeZero = lastSettlement['create'].length == 0;
          const RelationBuilderObservable = (EntityList: Entity[]) => {
            // 遍歷所有的 Entity
            return from(EntityList)
              .pipe(
                mergeMap((entity: Entity) => {
                  if (!theConfig || theConfig['_relationshipOptions'].length == 0) {
                    // 如果這個 Entity 並未設定關係的話跳過
                    return of(null)
                  }
                  // 遍歷這個 Entity 所有的 relationConfig

                  entity.breakAllEntityRelationships();
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
                            // console.log(entity, relationshipOption['thisEntityOptions']['displayField'], ForeignKeyValues)
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
                        // switch (typeof ForeignKeyValue) {
                        //   case "string": {
                        //     // OneToOne, OneToMany, ManyToOne
                        //     // 通常直接記得關聯方的 foreign key
                        //     findRelevanceAndBuildUp(ForeignKey, ForeignKeyValue);
                        //     break;
                        //   }
                        //   case "object": {
                        //     if (Array.isArray(ForeignKeyValue)) {
                        //       // ManyToMany
                        //       for (const RelationValue of ForeignKeyValue) {
                        //         let defaultRelationKey = 'id';
                        //         switch (typeof RelationValue) {
                        //           case "string": {
                        //             // 這代表 Neo4J的線 Relation的部分將關聯對方的 id匯集起來記在這裡
                        //             findRelevanceAndBuildUp(defaultRelationKey, RelationValue);
                        //             break;
                        //           }
                        //           case "object": {
                        //             // 這代表 Neo4J的線 Relation的部分將關聯對方的 id加上 Relation的其他 Property匯集起來記在這裡
                        //             console.log(`RelationValue[defaultRelationKey]: ${RelationValue[defaultRelationKey]}`)
                        //             findRelevanceAndBuildUp(defaultRelationKey, RelationValue[defaultRelationKey]);
                        //             break;
                        //           }
                        //           default: {
                        //             let _logger = Logger.error(
                        //               'Store',
                        //               `buildRelationStore.RelationBuilderObservable RelationValue type is not supported!`,
                        //               { isPrint: Main.printMode !== "none" }
                        //             );
                        //             if (envType == 'browser' && _logger['options']['isPrint'])
                        //               console.error(_logger['_str']);
                        //             break;
                        //           }
                        //         }
                        //       }

                        //     }
                        //     break;
                        //   }
                        //   default: {
                        //     let _logger = Logger.error(
                        //       'Store',
                        //       `buildRelationStore.RelationBuilderObservable value type is not supported!`,
                        //       { isPrint: Main.printMode !== "none" }
                        //     );
                        //     if (envType == 'browser' && _logger['options']['isPrint'])
                        //       console.error(_logger['_str']);
                        //     break;
                        //   }

                        // }


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
            last(),
          )
        }),
        map(() => StateClone),
        catchError(err => of(err))
      )
      .subscribe(state => {
        this.withRelation$.next(state);
      });
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