import * as _ from "lodash";
import { asapScheduler, BehaviorSubject, Observable, pipe, Subject, Subscription, TeardownLogic } from "rxjs";
// import { addToSubscription } from "./store.interface";
import { Broker } from "./broker";
import { Action, AddMany, RemoveMany, SetMany } from "./action";
import { Reducer } from "./reducer";
import { createFeatureSelector } from "./selector";
import { CQRS } from "./main";
import { EntityState, LastSettlement } from "./interface/adapter.interface";
import { Settlement } from "./interface/store.interface";
import { v4 as uuidv4 } from "uuid"
import { filter, map } from "rxjs/operators";
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
  //  * If MainCQRS seRelationshipFromJDL
   * :Observable<initialState>
   */
  private buildRelationStore = () => {
    // let { relationshipConfigTable } = this._CQRS;
    if (!this._withRelation) this._withRelation = _.cloneDeep(this.state);
    let StateClone = this._withRelation;
    let JDLObject: JDLObject,
      RelationshipConfigTable: RelationshipConfigTable,
      SettlementClone: Settlement,
      LastSettlementToValue: { create: any[]; update: any[]; delete: string[] },
      theConfig: RelationshipConfig
    // LastSettlementToEntity: { create: Entity[]; update: Entity[]; delete: string[] };

    return this.settlement$.pipe(
      filter((settlement) => !!this._CQRS && !!this._CQRS.relationshipConfigTable),
      map(settlement => {
        RelationshipConfigTable = this._CQRS.relationshipConfigTable;
        SettlementClone = _.cloneDeep(settlement);
        let { lastSettlement } = SettlementClone;
        let { reducerName } = SettlementClone;
        let theReducer: Reducer<any, any> = this.reducers[reducerName];
        let theState: EntityState<any> = StateClone[reducerName];
        theConfig = RelationshipConfigTable[reducerName];

        LastSettlementToValue = {
          create: Object.values(SettlementClone['lastSettlement']['create']),
          update: Object.values(SettlementClone['lastSettlement']['update']),
          delete: Object.values(SettlementClone['lastSettlement']['delete']),
        };
        let createEntities: Entity[] = theReducer.createEntities(LastSettlementToValue['create']);
        if (LastSettlementToValue['create'].length !== 0) { theState = addMany(createEntities, theState); }
        if (LastSettlementToValue['update'].length !== 0) {
          Array.from(LastSettlementToValue['update'])
            .map((entityData) => {
              // if (!!!theState['entities'][entityData['id']]) return;
              let theEntity: Entity = theState['entities'][entityData['id']];
              // 斷開所有連結，稍後會重建
              theEntity.breakAllReferences();
              let newEntity = theReducer.createEntity(entityData);
              theState = setOne(newEntity, theState);
              return entityData;
            })
        };
        if (LastSettlementToValue['delete'].length !== 0) {
          Array.from(LastSettlementToValue['delete'])
            .map((id: string) => {
              let theEntity: Entity = theState['entities'][id];
              // 斷開所有連結，稍後會重建
              theEntity.breakAllReferences();
              theState = removeOne(id, theState);
            })
        }
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