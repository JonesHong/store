import _ from "lodash"
import { DateTime } from "luxon";
import { v4 as uuidv4 } from "uuid";
import { envType } from "./env_checker";
import { Settlement } from "./interface/store.interface";
import { Logger } from "./logger";
import { upperCaseFirst } from "upper-case-first";
import { Main } from "./main";


export abstract class Action {
    abstract type: string;
    private _actionId: string = `action-${uuidv4()}`;
    private _createDateTime = this._nowTime();
    private _updateDateTime = this._createDateTime;


    private _parentId: string = null;
    // 起點
    private _sourceId?: string = null;
    // 終點們
    private _targetIds?: string[] = [];
    private _traversal: Map<number, any> = new Map();

    constructor() { }

    public get actionId(): string {
        return this._actionId
    }
    public get createDateTime(): number {
        return this._createDateTime;
    }
    public get updateDateTime(): number {
        return this._updateDateTime;
    }
    public set parentId(parentId: string) {
        this._parentId = parentId;
        this._updateDateTime = this._nowTime();
    }
    public set sourceId(sourceId: string) {
        this._sourceId = sourceId;
        this._updateDateTime = this._nowTime();
    }
    public set targetIds(targetIds: string[]) {
        this._targetIds = targetIds;
        this._updateDateTime = this._nowTime();
    }
    private _nowTime() {
        return DateTime.fromJSDate(new Date).valueOf();
    }
    // addTraversal(node: string) {
    //     let _now = DateTime.fromJSDate(new Date);
    //     this._traversal.set(_now.valueOf(), node);
    //     this._updateDateTime = this._nowTime();
    // }
    toObject = () => {
        let _payload = {};
        let classEntries: [string, any][] = Object.entries(this);
        // await Promise.all(
        classEntries.map((entry) => {
            let _key = entry[0], _val = entry[1];
            if (typeof (_val) !== "function") {
                _payload[_key] = _val;
            }
        })
        // )
        return _payload
    }
    setParent(parent: Action) {
        if (!!this['_parent']) return;
        if (parent.actionId == this._parentId) {
            this['_parent'] = parent;
            parent.addChild(this);
        }
        else {
            // console.error(`[Error/Action] setParent with wrong parent.`)
            let _logger = Logger.error(
                this.type, "setParent with wrong parent.",
                { isPrint: Main.printMode !== "none" }
            );
            if (envType == "browser" && _logger['options']['isPrint'])
                console.error(_logger['_str']);
        }
    }
    addChild(child: Action) {
        if (!!!this['_childrenMap']) this['_childrenMap'] = {};
        if (child._parentId == this.actionId) {
            let _childId = child.actionId;
            if (!!this['_childrenMap'][_childId]) return;
            this['_childrenMap'][_childId] = child;
            child.setParent(this);
        }
        else {
            // console.error(`[Error/Action] addChild with wrong child.`)
            let _logger = Logger.error(
                this.type, "addChild with wrong child.",
                { isPrint: Main.printMode !== "none" }
            );
            if (envType == "browser" && _logger['options']['isPrint'])
                console.error(_logger['_str']);
        }
    }

}
export const transferActionMapToActionList = function (actionMap: object): string[] {
    if (typeof (actionMap) !== "object" || Array.isArray(actionMap)) {
        // console.error(`[Error/transferActionMapToActionList] Only accept type object, this input type is ${typeof (actionMap)}`)
        let _logger = Logger.error(
            "transferActionMapToActionList",
            `Only accept type object, this input type is ${typeof (actionMap)}`,
            { isPrint: Main.printMode !== "none" }
        );
        if (envType == "browser" && _logger['options']['isPrint'])
            console.error(_logger['_str']);
        return null;
    }
    // let newActionMap = Object.assign({}, actionMap)
    let actionList: any[] = Object.values(actionMap);

    return actionList
}
export const DefaultActionMap = {
    SystemInitiate: "[Default] System Initiate",
    ErrorResponse: "[Default] Error Response",
    SystemRestoreByCache: "[Default] System Restore By Cache",
    PacketLossObserved: "[Default] Packet Loss Observed",
}
export class SystemInitiate extends Action {
    readonly type: string = DefaultActionMap.SystemInitiate
    constructor(public payload?: never) {
        super();
    }
}
export class ErrorResponse extends Action {
    readonly type: string = DefaultActionMap.ErrorResponse
    constructor(public payload: { failedAction: Action, error: any, descriptions?: string, options?: any }) {
        super();
    }
}
export class SystemRestoreByCache extends Action {
    readonly type: string = DefaultActionMap.SystemRestoreByCache
    constructor(public payload: { storeState: any }) {
        super();
    }
}
export class PacketLossObserved extends Action {
    readonly type: string = DefaultActionMap.PacketLossObserved
    constructor(public payload: { reducerName: string, _currentHash: string }) {
        super();
    }
}

// export interface CommonActionMapInterface {
//     AddOne: '[Default] Add One',
//     AddMany: '[Default] Add Many',
//     SetOne: '[Default] Set One',
//     SetMany: '[Default] Set Many',
//     SetAll: '[Default] Set All',
//     RemoveOne: '[Default] Remove One',
//     RemoveMany: '[Default] Remove Many',
//     RemoveAll: '[Default] Remove All',
//     UpdateOne: '[Default] Update One',
//     UpdateMany: '[Default] Update Many',
//     UpsertOne: '[Default] Upsert One',
//     UpsertMany: '[Default] Upsert Many',
// }
export enum CommonActionMap {
    Initial = '[Default] Initial',
    AddOne = '[Default] Add One',
    AddMany = '[Default] Add Many',
    SetOne = '[Default] Set One',
    SetMany = '[Default] Set Many',
    SetAll = '[Default] Set All',
    RemoveOne = '[Default] Remove One',
    RemoveMany = '[Default] Remove Many',
    RemoveAll = '[Default] Remove All',
    UpdateOne = '[Default] Update One',
    UpdateMany = '[Default] Update Many',
    UpsertOne = '[Default] Upsert One',
    UpsertMany = '[Default] Upsert Many',
    CompareSettlement = "[Default] Compare Settlement",
    // CacheOne= '[Default] Cache One',
    // CacheMany= '[Default] Cache Many',
    // CacheAll= '[Default] Cache All',
}
export class Initial extends Action {
    readonly type: string = CommonActionMap.Initial
    constructor(private reducerName: string, private payload?: never) {
        super();
        this.type = replaceDefaultToEntity(this.type, reducerName);
    }
}
export class AddOne extends Action {
    readonly type: string = CommonActionMap.AddOne
    constructor(private reducerName: string, public entity: any) {
        super();
        this.type = replaceDefaultToEntity(this.type, reducerName);
    }
}
export class AddMany extends Action {
    readonly type: string = CommonActionMap.AddMany
    constructor(private reducerName: string, public entities: any[]) {
        super();
        this.type = replaceDefaultToEntity(this.type, reducerName);
    }
}
export class SetOne extends Action {
    readonly type: string = CommonActionMap.SetOne
    constructor(private reducerName: string, public entity: any) {
        super();
        this.type = replaceDefaultToEntity(this.type, reducerName);
    }
}
export class SetMany extends Action {
    readonly type: string = CommonActionMap.SetMany
    constructor(private reducerName: string, public entities: any[]) {
        super();
        this.type = replaceDefaultToEntity(this.type, reducerName);
    }
}
export class SetAll extends Action {
    readonly type: string = CommonActionMap.SetAll
    constructor(private reducerName: string, public entities: any) {
        super();
        this.type = replaceDefaultToEntity(this.type, reducerName);
    }
}
export class RemoveOne extends Action {
    readonly type: string = CommonActionMap.RemoveOne
    constructor(private reducerName: string, public id: string) {
        super();
        this.type = replaceDefaultToEntity(this.type, reducerName);
    }
}
export class RemoveMany extends Action {
    readonly type: string = CommonActionMap.RemoveMany
    constructor(private reducerName: string, public ids: any[]) {
        super();
        this.type = replaceDefaultToEntity(this.type, reducerName);
    }
}
export class RemoveAll extends Action {
    readonly type: string = CommonActionMap.RemoveAll
    constructor(private reducerName: string) {
        super();
        this.type = replaceDefaultToEntity(this.type, reducerName);
    }
}
export class UpdateOne extends Action {
    readonly type: string = CommonActionMap.UpdateOne
    constructor(private reducerName: string, public entity: any) {
        super();
        this.type = replaceDefaultToEntity(this.type, reducerName);
    }
}
export class UpdateMany extends Action {
    readonly type: string = CommonActionMap.UpdateMany
    constructor(private reducerName: string, public entities: any[]) {
        super();
        this.type = replaceDefaultToEntity(this.type, reducerName);
    }
}
export class UpsertOne extends Action {
    readonly type: string = CommonActionMap.UpsertOne
    constructor(private reducerName: string, public entity: any) {
        super();
        this.type = replaceDefaultToEntity(this.type, reducerName);
    }
}
export class UpsertMany extends Action {
    readonly type: string = CommonActionMap.UpsertMany
    constructor(private reducerName: string, public entities: any[]) {
        super();
        this.type = replaceDefaultToEntity(this.type, reducerName);
    }
}
export class CompareSettlement extends Action {
    readonly type: string = CommonActionMap.CompareSettlement
    constructor(private reducerName: string, public settlement: Settlement) {
        super();
    }
}

export const replaceDefaultToEntity = (defaultName: string, reducerName: string) => {
    if (typeof (reducerName) !== "string") {
        // console.error(`[Error] reducerName ids need to be String`);
        let _logger = Logger.error(
            "replaceDefaultToEntity",
            `reducerName ids need to be String`,
            { isPrint: Main.printMode !== "none" }
        );
        if (envType == "browser" && _logger['options']['isPrint'])
            console.error(_logger['_str']);
        return null
    }
    let reducerNameReg = upperCaseFirst(reducerName);
    let replaceReg = /Default/;
    return defaultName.replace(replaceReg, reducerNameReg)
}

export const transferDefaultToEntity = (reducerName: string) => {
    if (typeof (reducerName) !== "string") {
        // console.error(`[Error] reducerName ids need to be String`);
        let _logger = Logger.error(
            "transferDefaultToEntity",
            `reducerName ids need to be String`,
            { isPrint: Main.printMode !== "none" }
        );
        if (envType == "browser" && _logger['options']['isPrint'])
            console.error(_logger['_str']);
        return null
    }
    let actionMap = _.cloneDeep(CommonActionMap)
    // await Promise.all(
    Object.entries(actionMap).map((actionEntry) => {
        let _key = actionEntry[0],
            _val = actionEntry[1];
        actionMap[_key] = replaceDefaultToEntity(_val, reducerName);
    })
    // );

    let _payload: { actionMap: typeof CommonActionMap, methodMap: MethodMap } = {
        actionMap,
        methodMap: {
            Initial: (reducerName) => new Initial(reducerName),
            AddOne: (reducerName, entity) => new AddOne(reducerName, entity),
            AddMany: (reducerName, entities) => new AddMany(reducerName, entities),
            SetOne: (reducerName, entity) => new SetOne(reducerName, entity),
            SetMany: (reducerName, entities) => new SetMany(reducerName, entities),
            SetAll: (reducerName, entities) => new SetAll(reducerName, entities),
            RemoveOne: (reducerName, id) => new RemoveOne(reducerName, id),
            RemoveMany: (reducerName, ids) => new RemoveMany(reducerName, ids),
            RemoveAll: (reducerName) => new RemoveAll(reducerName),
            UpdateOne: (reducerName, entity) => new UpdateOne(reducerName, entity),
            UpdateMany: (reducerName, entities) => new UpdateMany(reducerName, entities),
            UpsertOne: (reducerName, entity) => new UpsertOne(reducerName, entity),
            UpsertMany: (reducerName, entities) => new UpsertMany(reducerName, entities),
            CompareSettlement: (reducerName, settlement) => new CompareSettlement(reducerName, settlement),
        }
    }

    return _payload
}

export interface MethodMap {
    Initial: (reducerName) => Initial;
    AddOne: (reducerName, entity) => AddOne;
    AddMany: (reducerName, entities) => AddMany;
    SetOne: (reducerName, entity) => SetOne;
    SetMany: (reducerName, entities) => SetMany;
    SetAll: (reducerName, entities) => SetAll;
    RemoveOne: (reducerName, id) => RemoveOne;
    RemoveMany: (reducerName, ids) => RemoveMany;
    RemoveAll: (reducerName) => RemoveAll;
    UpdateOne: (reducerName, entity) => UpdateOne;
    UpdateMany: (reducerName, entities) => UpdateMany;
    UpsertOne: (reducerName, entity) => UpsertOne;
    UpsertMany: (reducerName, entities) => UpsertMany;
    CompareSettlement: (reducerName, settlement) => CompareSettlement;
}
export type DefaultActionUnion = AddOne |
    AddMany |
    SetOne |
    SetMany |
    SetAll |
    RemoveOne |
    RemoveMany |
    RemoveAll |
    UpdateOne |
    UpdateMany |
    UpsertOne |
    UpsertMany |
    CompareSettlement;