import { BehaviorSubject, filter, Subscription, take } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

import { Action } from './action';
import { envType } from './env_checker';
import { Logger } from './logger';
import { Main } from './main';
// import { CacheService } from "./cache";

/**
 * This version use Action type as topic.
 *
 * Not sure is good enough.
 * Maybe topic split with Action type is better choice.
 */
export abstract class Broker {
  _brokerId = `broker-${uuidv4()}`;
  public isReadyToDispatch$ = new BehaviorSubject(false);
  private _isReadyToDispatchSubscribe!: Subscription;
  // private _eventsLogSize = 1000
  private _eventsLog: Action[] = [];
  private _eventCache: Action[] = [];
  private _topicMap: Map<string, BehaviorSubject<Action>> = new Map();
  public get topicMap(): Map<string, BehaviorSubject<Action>> {
    return this._topicMap;
  }
  public get topicNameList(): IterableIterator<string> {
    return this._topicMap.keys();
  }
  public get eventCache(): Action[] {
    return this._eventCache;
  }
  constructor() {
    this._brokerInitial();
  }
  private _brokerInitial() {
    this.topicMap.set('broadcast', new BehaviorSubject(null));
    this._isReadyToDispatchSubscribe = this.isReadyToDispatch$
      .pipe(
        filter((isReady) => !!isReady),
        take(1)
      )
      .subscribe(() => {
        if (this.eventCache.length !== 0) {
          this.eventCache.map((event, index) => {
            this.dispatch(event);
            if (index + 1 === this._eventCache.length) {
              this._eventCache = [];
            }
          });
        }
        // asapScheduler.schedule(() => {
        // }, 10);
      });

    // let broadcast = this.getBroadcast();
    // broadcast.subscribe((event) => {
    //   // this._eventsLog.push(event);
    //   // if (this._eventsLog.length > CacheService.maxConfig._eventsLogSize) this._eventsLog = this._eventsLog.slice(1);
    // });
  }

  getEventChain() {
    const _payload: { ids: string[]; events: { [key: string]: Action } } = {
      ids: [],
      events: {},
    };
    // make _payload first.
    this._eventsLog.map((event) => {
      const _id = event['_id'];
      if (!(_id in _payload['events'])) {
        _payload.ids.push(_id);
        _payload.events[_id] = event;
      }
    });
    // build the chain;
    this._eventsLog.map((event) => {
      const _parent = _payload['events'][event['_parentId']];
      if (_parent) event.setParent(_parent);
    });
    return _payload;
  }

  getBroadcast(): BehaviorSubject<Action> | undefined {
    return this.topicMap.get('broadcast');
  }
  getTopicByAction(action: Action): BehaviorSubject<Action> | undefined {
    const type = action['type'];
    if (!this.topicMap.has(type)) {
      const _logger = Logger.error(
        'getTopicByAction',
        `There is no topicName: ${type}`,
        { isPrint: Main.printMode !== 'none' }
      );
      if (envType == 'browser' && _logger['options']['isPrint'])
        console.error(_logger['_str']);
      return undefined;
    }
    return this.topicMap.get(type);
  }
  addTopicByActionType(actionType: string): BehaviorSubject<Action> {
    const topic$: BehaviorSubject<Action> = new BehaviorSubject(null);
    if (this._topicMap.has(actionType)) {
      const _logger = Logger.error(
        'addTopicByActionType',
        `Topic <${actionType}> is already exist.`,
        { isPrint: Main.printMode !== 'none' }
      );
      if (envType == 'browser' && _logger['options']['isPrint'])
        console.error(_logger['_str']);
      return topic$;
    }
    this._topicMap.set(actionType, topic$);
    return topic$;
  }
  addTopicsByActionTypeList = (
    actionTypeList: string[]
  ): BehaviorSubject<Action>[] => {
    const topicList$: BehaviorSubject<Action>[] = [];
    if (!Array.isArray(actionTypeList)) {
      const _logger = Logger.error(
        'addTopicsByActionTypeList',
        `Input must be an Action.type array.`,
        { isPrint: Main.printMode !== 'none' }
      );
      if (envType == 'browser' && _logger['options']['isPrint'])
        console.error(_logger['_str']);
      return topicList$;
    }
    // await Promise.all(
    actionTypeList.map((action) => {
      const topic = this.addTopicByActionType(action);
      topic ? topicList$.push(topic) : null;
    });
    // )
    return topicList$;
  };

  dispatch(action: Action): void {
    if (!this.isReadyToDispatch$.value) {
      const _logger = Logger.log(
        'Broker',
        `Broker is not ready yet. Action has been cache. It'll re-dispatch later.`,
        { isPrint: Main.printMode == 'detail' }
      );
      if (envType == 'browser' && _logger['options']['isPrint'])
        console.log(_logger['_str']);
      // action.addTraversal(`${_name}._eventCache`);
      this._eventCache.push(action);
      return;
    }
    if (!action) {
      return;
    }
    const type = action['type'];
    // action.addTraversal(`${_name}.next`);
    if (!this.topicMap.has(type)) {
      const _logger = Logger.warn(
        'Broker',
        `This event didn't have a specific Subject topic. You can get it by broadcast topic or check Action config:`,
        { payload: action, isPrint: Main.printMode !== 'none' }
      );
      if (envType == 'browser' && _logger['options']['isPrint'])
        console.warn(
          _logger['_str'] + '\n' + JSON.stringify(_logger['options']['payload'])
        );
      // this.addTopic(action);
    } else {
      const theTopic = this.getTopicByAction(action);
      theTopic?.next(action);
    }

    const broadcastTopic = this.topicMap.get('broadcast');
    broadcastTopic.next(action);
  }
  dispatches(actions: Action[]) {
    actions.map((action) => {
      this.dispatch(action);
    });
  }
}
