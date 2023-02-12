import * as _ from "lodash";
import { asapScheduler, BehaviorSubject, concat, from, Observable, of, pipe, Subject, Subscription, TeardownLogic } from "rxjs";
// import { addToSubscription } from "./store.interface";
import { Broker } from "./broker";
import { Action, AddMany, RemoveMany, SetMany } from "./action";
import { Reducer } from "./reducer";
import { createFeatureSelector } from "./selector";
import { CQRS } from "./main";
import { EntityState, LastSettlement } from "./interface/adapter.interface";
import { Settlement } from "./interface/store.interface";
import { v4 as uuidv4 } from "uuid"
import { filter, map, mergeMap } from "rxjs/operators";
import { SettlementChanged } from "./pipes/_some.pipe";
import { JDLObject, RelationshipConfig, RelationshipConfigTable } from "./interface/relation.interface";
import { Entity } from "./entity";
import { addMany, removeOne, setOne } from "./adapter";
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
  public get reducers() {
    return this._reducers
  }
  private _state: initialState;
  public get state() {
    return this._state
  }
  // private _stateInstantiate: initialState;
  // public get stateInstantiate() {
  //   return this._stateInstantiate
  // }
  private _state$: BehaviorSubject<initialState>;
  public get state$() {
    return this._state$.asObservable()
  }
  // public get reducerSettlement() {
  //   return this._settlement$.value;
  // }
  private _settlement$: BehaviorSubject<Settlement> = new BehaviorSubject(null);
  public get settlement$() {
    return this._settlement$.asObservable()
      .pipe(
        SettlementChanged(this._settlement$)
      );
  }
  // private _settlementsLogSize = 100;
  private _settlementsLog = [];

  constructor() {
    super();
    this._storeInitial();
  }
  private _storeInitial(): void {
    if (!!!this._settlement$) {
      asapScheduler.schedule(() => { this._storeInitial(); }, 100)
      return;
    }
    this.settlement$.subscribe(settlement => {
      this._settlementsLog.push(settlement);
      // if (this._settlementsLog.length > CacheService.maxConfig._settlementsLogSize) this._settlementsLog = this._settlementsLog.slice(1);
    })
  }

  setMain(main: CQRS<initialState, Reducers>) {
    this._CQRS = main;
  }
  setInitial(reducers: Reducers, initialState: initialState) {
    this._reducers = reducers;
    this._state = initialState
    // this._stateInstantiate = initialState
    this._state$ = new BehaviorSubject(initialState)

  }
  // count = 0
  addReducer(reducer: Reducer<any, any>): void {
    let keywordToSlice = reducer?._name?.search(/Reducer/);
    // console.log(keywordToSlice, reducer)
    if (keywordToSlice == -1) {
      console.error(`The reducer's name need to be includes "Reducer" .`);
      return null;
    }
    let reducerName = reducer?._name?.slice(0, keywordToSlice);
    reducerName = `${reducerName[0].toLowerCase()}${reducerName.slice(1)}`;
    if (!reducerName) {
      console.error(`The reducer need to be an Class.`);
      return null;
    }
    if (!reducer?.listen) {
      console.error(`The reducer need to be an BLoC.`);
      return null;
    }
    if (!reducer?.setStore) {
      console.error(`The reducer need to be extends Reducer.`);
      return null;
    }
    if (this.subscriptionMap.has(reducerName)) {
      console.warn("Reducer already exist.");
      return null;
    }
    let reducer$;
    // this.count += 1;
    // let _lastSettlement;
    reducer$ = reducer.listen(state => {
      let newState = this._state;
      newState[reducerName] = state
      this._state = newState;
      this._state$.next(newState);
      // this._stateInstantiate = reducer.turnStateToEntities();
      let _settlement: Settlement = {
        reducerName,
        _previousHash: state['_previousHash'],
        _currentHash: state['_currentHash'],
        lastSettlement: state['lastSettlement']
      }
      // if (!_lastSettlement) _lastSettlement = _settlement
      // if (_lastSettlement['_currentHash'] !== _settlement['_currentHash']) {
      this._settlement$.next(_settlement);
      // _lastSettlement = _settlement;
      // }
      // console.log("addReducer", state)
    })
    this._reducers[reducerName] = reducer;
    this.subscription.add(reducer$);
    this.subscriptionMap.set(reducerName, reducer$);
    reducer.setStore(this);
    // setTimeout(() => {
    //   console.log(this.count, this.subscriptionMap)
    // }, 5000);
  }



  subscribe(next?: (state: initialState) => void, error?: (error: any) => void, complete?: () => void): Subscription {
    return this.state$.subscribe({ next, error, complete })
  }



  /**
   * 如果直接 cloneDeep(Store)的話，每次更新都要重新綁全部的邏輯  
   * 所以根據 settlement的結果修正 RelationStore中的 state  
   * 然後只重新綁訂有更新部分的關係，以達到最小消耗
   */
  private buildRelationStore = () => {
    // let { relationshipConfigTable } = this._CQRS;
    if (!this._withRelation) this._withRelation = _.cloneDeep(this.state);
    let StateClone = this._withRelation,
      theReducer: Reducer<any, any>,
      theState: EntityState<any>;
    let JDLObject: JDLObject,
      RelationshipConfigTable: RelationshipConfigTable,
      SettlementClone: Settlement,
      LastSettlementToValues: { create: any[]; update: any[]; delete: string[] },
      theConfig: RelationshipConfig,
      LastSettlementToEntity: { create: Entity[]; update: Entity[] } = { create: [], update: [] };

    return this.settlement$.pipe(
      filter((settlement) => !!this._CQRS && !!this._CQRS.relationshipConfigTable),
      map(settlement => {
        // 這個 operator 的目的是；整理最新 settlement 的結果   
        RelationshipConfigTable = this._CQRS.relationshipConfigTable;
        SettlementClone = _.cloneDeep(settlement);
        let { lastSettlement } = SettlementClone;
        let { reducerName } = SettlementClone;
        theReducer = this.reducers[reducerName];
        theState = StateClone[reducerName];
        theConfig = RelationshipConfigTable[reducerName];

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
              // if (!!!theState['entities'][entityData['id']]) return;
              let theEntity: Entity = theState['entities'][entityData['id']];
              // 斷開所有連結，稍後會重建
              theEntity.breakAllEntityRelationships();
              let newEntity = theReducer.createEntity(entityData);
              LastSettlementToEntity['update'].push(newEntity);
              theState = setOne(newEntity, theState);
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
        return SettlementClone;
      }),
      mergeMap((SettlementClone) => {
        // 這個 operator 的目的是；針對 settlement 中的 create, update 的部分重建關係

        let { lastSettlement } = SettlementClone;
        let isCreateLengthBeZero = lastSettlement['create'].length == 0,
          isUpdateLengthBeZero = lastSettlement['create'].length == 0;
        let create$ = of(1),
          update$ = of(2);
        const RelationBuilderObservable = (EntityList: Entity[]) => {
          // 遍歷所有的 Entity
          return from(EntityList)
            .pipe(
              mergeMap((Entity: Entity) => {
                if (!theConfig || theConfig['_relationshipOptions'].length == 0) {
                  // 如果這個 Entity 並未設定關係的話跳過
                  return of(null)
                }
                let { id } = Entity;
                // 兩個 Entity之間可能有複數種關係，用這個方式去避免被跳過
                let _configsIndex = 0;
                // 遍歷這個 Entity 所有的 relationConfig
                return from(theConfig['_relationshipOptions'])
                  .pipe(
                    map((relationshipOption) => {
                      // const findTargetRelationOptionIndex = _.findIndex()

                    })
                  )
              })
            )
        }
        // if (isCreateLengthBeZero && isUpdateLengthBeZero) { }
        // else if (!isCreateLengthBeZero && isUpdateLengthBeZero) { }
        // else if (isCreateLengthBeZero && !isUpdateLengthBeZero) { }
        // else if (!isCreateLengthBeZero && !isUpdateLengthBeZero) { }
        return concat(
          isCreateLengthBeZero ? of(null) : create$,
          isUpdateLengthBeZero ? of(null) : update$
        )
      })


    );
  }

  private _withRelation: initialState;
  private _withRelation$ = this.buildRelationStore();

  public get withRelation$() {
    return this._withRelation$
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