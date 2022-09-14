import * as _ from "lodash";
import { asapScheduler, BehaviorSubject, Observable, Subject, Subscription, TeardownLogic } from "rxjs";
// import { addToSubscription } from "./store.interface";
import { Broker } from "./broker";
import { Action } from "./action";
import { Reducer } from "./reducer";
import { createFeatureSelector } from "./selector";
import { CqrsMain } from "./main";
import { LastSettlement } from "./adapter";
import { v4 as uuidv4 } from "uuid"
import { filter } from "rxjs/operators";
// import { CacheService } from "./cache";


const _name = "Store"
export type settlement = {
  reducerName: string;
  _previousHash: string;
  _currentHash: string;
  lastSettlement: LastSettlement<any>;
}
/**
 * Split of writing functionality
 * Focus on reading repositories
 * 
 * Store doesn't depend on any one.
 * 
 */
export class Store<initialState, Reducers> extends Broker {
  // _name: string = "Store";
  _storeId = `store-${uuidv4()}`;
  private subscriptionMap: Map<string, Subscription> = new Map()
  private subscription: Subscription = new Subscription()
  // private _lastSettlement: settlement;
  private _mainCqrs: CqrsMain<initialState, Reducers>;
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
  private _settlement$: BehaviorSubject<settlement> = new BehaviorSubject(null);
  public get settlement$() {
    return this._settlement$.asObservable()
      .pipe(
        filter(lastSettlement => !!lastSettlement)
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

  setMain(main: CqrsMain<initialState, Reducers>) {
    this._mainCqrs = main;
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
      let _settlement = {
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


}

// interface StoreMain<initialState, Reducers> {
//   forRoot<initialState, Reducers>(reducers: Reducers): _Store<initialState, Reducers>;
//   // _Store:S

// }

