import { Bloc } from '@felangel/bloc';
import { Store } from './store';
import * as _ from 'lodash';
import {
  cloneAndReset,
  addMany,
  addOne,
  removeAll,
  removeMany,
  removeOne,
  setAll,
  setMany,
  setOne,
  updateMany,
  updateOne,
  upsertMany,
  upsertOne,
  initialMain,
} from './adapter';
import {
  transferDefaultToEntity,
  transferActionMapToActionList,
  CommonActionMap,
  MethodMap,
  Action,
  CompareSettlement,
  AddOne,
  AddMany,
  SetOne,
  SetMany,
  SetAll,
  RemoveOne,
  RemoveMany,
  RemoveAll,
  UpdateOne,
  UpdateMany,
  UpsertOne,
  UpsertMany,
  Initial,
  PacketLossObserved,
} from './action';
import { selectRelevanceEntity } from './selector';
import { v4 as uuidV4 } from 'uuid';
import { Entity } from './entity';
import { asapScheduler } from 'rxjs';
import { DateTime } from 'luxon';
import { Logger } from './logger';
import { envType } from './env_checker';
import { camelCase } from "change-case";
import { Main } from './main';

export abstract class Reducer<action, state> extends Bloc<action, state> {
  _reducerId = `reducer-${uuidV4()}`;
  abstract _name: string;
  public defaultMapper: {
    actionMap: typeof CommonActionMap;
    methodMap: MethodMap;
  };
  private _store!: Store<any, any>;
  private _servicesMap = {};
  addService(service) {
    if (!service.name) {
      let _logger = Logger.error(
        'Reducer',
        'addService wrong.Check service _name!!',
        { isPrint: Main.printMode !== "none" }
      );
      if (envType == 'browser' && _logger['options']['isPrint'])
        console.error(_logger['_str']);
      return;
    }
    this._servicesMap[service.name] = service;
  }
  private _actionTypeList: string[] = [];
  private _defaultInitialState: state;
  private _initialState = null;
  /**
   *
   * @param initialState
   * Like usual Reducer
   * @param actionTypeList
   * Make a actionTypeList that all action you need to handle.
   * It'll addTopic in Broker and subscribe it, when store is set.
   */
  constructor(initialState, actionMap: object) {
    super(initialState);
    this._defaultInitialState = _.cloneDeep(initialState);
    this._initialState = _.cloneDeep(initialState);
    this._actionTypeList = [
      ...this._actionTypeList,
      ...transferActionMapToActionList(actionMap),
    ];
  }
  // reset(){
  //   // let _action =
  //   // this.dispatch()
  //   // this.removeAll();
  //   this.defaultMapper.actionMap.RemoveAll
  // }
  initialHandler = (mode: 'test' | 'prod' = 'prod') => {
    this.handleEntityMethods();
    if (mode == 'prod') {
      this.subscribeTopic(this.actionTypeList);
    }
  };

  public get store(): Store<any, any> {
    return this._store;
  }

  public get actionTypeList(): string[] {
    return this._actionTypeList;
  }

  setStore(store: Store<any, any>): void {
    if (!!this._store) return null;
    this._store = store;
    store.addReducer(this);
  }

  defaultActionState(action: Action): state {
    let _redisOptions;
    if (!!this._servicesMap['CacheService']) {
      _redisOptions = {
        reducerName: this._name,
        cacheService: this._servicesMap['CacheService'],
      };
    }
    // action.addTraversal(this._name);

    // let _timeLabel = `[${this._name}] defaultActionState`;
    // console.time(_timeLabel);
    let _beforeExec = DateTime.now();
    let newState: state = cloneAndReset(this.state, action);
    switch (action['type']) {
      case this.defaultMapper['actionMap']['Initial']: {
        let actionWithType = action as Initial;
        newState = initialMain(this._initialState, newState);
        break;
      }
      case this.defaultMapper['actionMap']['CompareSettlement']: {
        let actionWithType = action as CompareSettlement;
        // 比較前端的 _currentHash 與後端的 _previousHash
        if (!!this.state['_currentHash']) {
          let { settlement } = actionWithType;

          if (this.state['_currentHash'] !== settlement['_previousHash']) {
            // 發現掉包，不改當前的 state
            // 送一個 Action 回去給 Store 應該要透過 Effect 重新拿完整/缺失的部分
            this.store.dispatch(new PacketLossObserved({ reducerName: this._name, _currentHash: this.state['_currentHash'] }));
          }
          else {
            // 代表後端丟來的資料跟前端是沒有落差的
            let stateClone: state = _.cloneDeep(this.state);
            let createValues = Object.values(settlement['lastSettlement']['create']),
              updateValues = Object.values(settlement['lastSettlement']['update']),
              deleteValues = Object.values(settlement['lastSettlement']['delete']);
            // let createValues = Object.keys(settlement['lastSettlement']['create']).map((key) => settlement['lastSettlement']['create'][key]),
            //   updateValues = Object.keys(settlement['lastSettlement']['update']).map((key) => settlement['lastSettlement']['update'][key]),
            //   deleteValues = Object.keys(settlement['lastSettlement']['delete']).map((key) => settlement['lastSettlement']['delete'][key]);
            // 按照後端 settlement 完的結果更新前端的 state
            createValues.length !== 0 ? stateClone = addMany(createValues, stateClone) : null;
            updateValues.length !== 0 ? stateClone = upsertMany(updateValues, stateClone) : null;
            deleteValues.length !== 0 ? stateClone = removeMany(deleteValues, stateClone) : null;
            // 更新完 state 也要同步當前的 hash版本
            stateClone['_currentHash'] = settlement['_currentHash'];
            stateClone['_previousHash'] = settlement['_previousHash'];
            // 把在剛剛更新 state 改變的 lastSettlement 重置
            newState = cloneAndReset(stateClone);
          }
        }

        // newState = initialMain(this._initialState, newState);
        break;
      }
      case this.defaultMapper['actionMap']['AddOne']: {
        let actionWithType = action as AddOne;
        newState = addOne(actionWithType['entity'], newState, _redisOptions);
        break;
      }
      case this.defaultMapper['actionMap']['AddMany']: {
        let actionWithType = action as AddMany;
        newState = addMany(actionWithType['entities'], newState, _redisOptions);
        break;
      }
      case this.defaultMapper['actionMap']['SetOne']: {
        let actionWithType = action as SetOne;
        newState = setOne(actionWithType['entity'], newState);
        break;
      }
      case this.defaultMapper['actionMap']['SetMany']: {
        let actionWithType = action as SetMany;
        newState = setMany(actionWithType['entities'], newState);
        break;
      }
      case this.defaultMapper['actionMap']['SetAll']: {
        let actionWithType = action as SetAll;
        newState = setAll(actionWithType['entities'], newState);
        break;
      }
      case this.defaultMapper['actionMap']['RemoveOne']: {
        let actionWithType = action as RemoveOne;
        newState = removeOne(actionWithType['id'], newState);
        break;
      }
      case this.defaultMapper['actionMap']['RemoveMany']: {
        let actionWithType = action as RemoveMany;
        newState = removeMany(actionWithType['ids'], newState);
        break;
      }
      case this.defaultMapper['actionMap']['RemoveAll']: {
        let actionWithType = action as RemoveAll;
        newState = removeAll(newState);
        break;
      }
      case this.defaultMapper['actionMap']['UpdateOne']: {
        let actionWithType = action as UpdateOne;
        newState = updateOne(actionWithType['entity'], newState);
        break;
      }
      case this.defaultMapper['actionMap']['UpdateMany']: {
        let actionWithType = action as UpdateMany;
        newState = updateMany(actionWithType['entities'], newState);
        break;
      }
      case this.defaultMapper['actionMap']['UpsertOne']: {
        let actionWithType = action as UpsertOne;
        newState = upsertOne(actionWithType['entity'], newState);
        break;
      }
      case this.defaultMapper['actionMap']['UpsertMany']: {
        let actionWithType = action as UpsertMany;
        newState = upsertMany(actionWithType['entities'], newState);
        break;
      }
      default: {
        let _logger = Logger.log(
          'DefaultActionState',
          `defaultActionState() doesn't handle this action: ${action['type']}.\nMake sure it has been handle in ${this._name}.mapEventToState() or Effect.`,
          { isPrint: Main.printMode == "detail" }
        );
        if (envType == 'browser' && _logger['options']['isPrint'])
          console.log(_logger['_str']);
        break;
      }
    }
    if (!newState['lastSettlement']['isChanged']) {
      // 如果沒改變
      let _logger = Logger.log(
        'DefaultActionState',
        `There is no change after action(${action['type']}):`,
        { isPrint: Main.printMode == "detail", payload: action }
      );
      if (envType == 'browser' && _logger['options']['isPrint'])
        console.log(_logger['_str']);
    } else {
      if (action['type'] !== this.defaultMapper['actionMap']['Initial']) {
        // 如果改變，更新一下 state中的 hash
        newState['_previousHash'] = newState['_currentHash'] || null;
        newState['_currentHash'] = `settlement-${uuidV4()}`;
      }
      newState['lastSettlement']['actionId'] = action['actionId'];
    }
    // console.timeEnd(_timeLabel);
    let _afterExec = DateTime.now();
    let execTime = _afterExec.diff(_beforeExec, 'milliseconds').toMillis();
    newState['lastSettlement']['dateTime'] = _afterExec.valueOf();
    let _logger = Logger.log(this._name, `DefaultActionState finished.`, {
      execTime,
      isPrint: Main.printMode == "detail"
    });
    if (envType == 'browser' && _logger['options']['isPrint'])
      console.log(_logger['_str']);
    return newState;
  }


  private _entityClass;
  public setEntity(entityClass) {
    this._entityClass = entityClass;
  }
  createEntity = (data: object): Entity => {
    let _payload = new this._entityClass(data);
    return _payload;
  };
  createEntities = (dataList: any[]): Entity[] => {
    let _payload;
    if (Array.isArray(dataList)) {
      _payload = dataList.map((data) => this.createEntity(data));
    } else {
      let _logger = Logger.error(
        this._name,
        `createEntities doesn't handle: ${dataList}`,
        {
          isPrint: Main.printMode !== "none"
        }
      );
      if (envType == 'browser' && _logger['options']['isPrint'])
        console.error(_logger['_str']);
      // console.error("[Error/Reducer] createEntities doesn't handle.");
      return null;
    }
    return _payload;
  };
  turnStateToEntities() {
    let _payload = _.cloneDeep(this.state);
    _payload['entities'] = this.createEntities(_payload['entities']);
    return _payload;
  }

  initial: () => string;
  addOne: (entity: any) => string;
  addMany: (entities: any[]) => string;
  setOne: (entity: any) => string;
  setMany: (entities: any[]) => string;
  setAll: (entities: any[]) => string;
  removeOne: (id: string) => string;
  removeMany: (ids: string[]) => string;
  removeAll: () => string;
  updateOne: (entity: any) => string;
  updateMany: (entities: any[]) => string;
  upsertOne: (entity: any) => string;
  upsertMany: (entities: any[]) => string;
  private handleEntityMethods = () => {
    let keywordToSlice = this?._name?.search(/Reducer/);
    const entityName = this?._name?.slice(0, keywordToSlice);
    this.defaultMapper = transferDefaultToEntity(entityName);
    const _methodMap = this.defaultMapper['methodMap'];

    Object.entries(_methodMap).map((entry) => {
      let _key = entry[0],
        _method: any = entry[1],
        _propMethodName = camelCase(_key);
      this._actionTypeList.push(this.defaultMapper['actionMap'][_key]);

      this[_propMethodName] = (payload) => {
        const _entityName = entityName;
        let action: any = _method(_entityName, payload);
        // action.addTraversal(`${this._name}.${_propMethodName}`);
        this.dispatch(action);
        return `${_propMethodName} OK!`;
      };
    });
  };

  /**
   *
   * @param parameter
   * @returns
   *
   * For example:
   * select Group.id in Department.groupId
   * DepartmentReducer.selectRelevanceEntity( {key: "groupId", value: "group-1"} )
   */
  selectRelevanceEntity = (parameter: {
    key: string;
    value: string;
  }): any[] => {
    return selectRelevanceEntity(this.state, parameter);
  };

  getPureData() {
    let _payload = _.cloneDeep(this.state);

    Object.entries(_payload['entities']).map(async (entry: [string, {}]) => {
      let _key = entry[0],
        _val = this.createEntity(entry[1]);
      _payload['entities'][_key] = await _val.toObject();
    });
    return _payload;
  }
  subscribeTopic = (actionTypeList: string[]): void => {
    if (!!!this._store) {
      let _logger = Logger.warn(
        this._name,
        `Because Store is not ready yet, subscribeTopic will retry in 50 ms.`,
        {
          isPrint: Main.printMode !== "none"
        }
      );
      if (envType == 'browser' && _logger['options']['isPrint'])
        console.error(_logger['_str']);
      asapScheduler.schedule(() => {
        this.subscribeTopic(actionTypeList);
      }, 50);
      return;
    }
    let topicList$ = this._store.addTopicsByActionTypeList(actionTypeList);
    topicList$.map((topic$) => {
      topic$.subscribe((action: any) => {
        if (!!action) {
          this.add(action);
        }
      });
    });
  };
  dispatch(action: action) {
    this.add(action);
  }
}
