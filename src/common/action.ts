import * as _ from "lodash"
import { DateTime } from "luxon";
import { v4 as uuidv4 } from "uuid";
import { envType } from "./env_checker";
import { Logger } from "./logger";

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
    addTraversal(node: string) {
        let _now = DateTime.fromJSDate(new Date);
        this._traversal.set(_now.valueOf(), node);
        this._updateDateTime = this._nowTime();
    }
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
            let _logger = Logger.error(this.type, "setParent with wrong parent.");
            if (envType == "browser" && _logger['options']['isPrint']) console.error(_logger['_str']);
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
            let _logger = Logger.error(this.type, "addChild with wrong child.");
            if (envType == "browser" && _logger['options']['isPrint']) console.error(_logger['_str']);
        }
    }

}
export const transferActionMapToActionList = function (actionMap: object): string[] {
    if (typeof (actionMap) !== "object" || Array.isArray(actionMap)) {
        // console.error(`[Error/transferActionMapToActionList] Only accept type object, this input type is ${typeof (actionMap)}`)
        let _logger = Logger.error(
            "transferActionMapToActionList",
            `Only accept type object, this input type is ${typeof (actionMap)}`
        );
        if (envType == "browser" && _logger['options']['isPrint']) console.error(_logger['_str']);
        return null;
    }
    // let newActionMap = Object.assign({}, actionMap)
    let actionList: any[] = Object.values(actionMap);

    return actionList
}
export const DefaultActionMap = {
    SystemInitiate: "[Default] System Initiate",
    SystemRestoreByCache: "[Default] System Restore By Cache",
    GetMissingSettlements: "[Default] Get Missing Settlements",
    ErrorResponse: "[Default] Error Response"
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
export class GetMissingSettlements extends Action {
    readonly type: string = DefaultActionMap.GetMissingSettlements
    constructor(public payload: { hash: string }) {
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
export const CommonActionMap = {
    Initial: '[Default] Initial',
    AddOne: '[Default] Add One',
    AddMany: '[Default] Add Many',
    SetOne: '[Default] Set One',
    SetMany: '[Default] Set Many',
    SetAll: '[Default] Set All',
    RemoveOne: '[Default] Remove One',
    RemoveMany: '[Default] Remove Many',
    RemoveAll: '[Default] Remove All',
    UpdateOne: '[Default] Update One',
    UpdateMany: '[Default] Update Many',
    UpsertOne: '[Default] Upsert One',
    UpsertMany: '[Default] Upsert Many',
    // CacheOne: '[Default] Cache One',
    // CacheMany: '[Default] Cache Many',
    // CacheAll: '[Default] Cache All',
}
export class Initial extends Action {
    readonly type: string = CommonActionMap.Initial
    constructor(private entityName: string, private payload?: never) {
        super();
        this.type = replaceDefaultToEntity(this.type, entityName);
    }
}
export class AddOne extends Action {
    readonly type: string = CommonActionMap.AddOne
    constructor(private entityName: string, public entity: any) {
        super();
        this.type = replaceDefaultToEntity(this.type, entityName);
    }
}
export class AddMany extends Action {
    readonly type: string = CommonActionMap.AddMany
    constructor(private entityName: string, public entities: any[]) {
        super();
        this.type = replaceDefaultToEntity(this.type, entityName);
    }
}
export class SetOne extends Action {
    readonly type: string = CommonActionMap.SetOne
    constructor(private entityName: string, public entity: any) {
        super();
        this.type = replaceDefaultToEntity(this.type, entityName);
    }
}
export class SetMany extends Action {
    readonly type: string = CommonActionMap.SetMany
    constructor(private entityName: string, public entities: any[]) {
        super();
        this.type = replaceDefaultToEntity(this.type, entityName);
    }
}
export class SetAll extends Action {
    readonly type: string = CommonActionMap.SetAll
    constructor(private entityName: string, public entities: any) {
        super();
        this.type = replaceDefaultToEntity(this.type, entityName);
    }
}
export class RemoveOne extends Action {
    readonly type: string = CommonActionMap.RemoveOne
    constructor(private entityName: string, public id: string) {
        super();
        this.type = replaceDefaultToEntity(this.type, entityName);
    }
}
export class RemoveMany extends Action {
    readonly type: string = CommonActionMap.RemoveMany
    constructor(private entityName: string, public ids: any[]) {
        super();
        this.type = replaceDefaultToEntity(this.type, entityName);
    }
}
export class RemoveAll extends Action {
    readonly type: string = CommonActionMap.RemoveAll
    constructor(private entityName: string) {
        super();
        this.type = replaceDefaultToEntity(this.type, entityName);
    }
}
export class UpdateOne extends Action {
    readonly type: string = CommonActionMap.UpdateOne
    constructor(private entityName: string, public entity: any) {
        super();
        this.type = replaceDefaultToEntity(this.type, entityName);
    }
}
export class UpdateMany extends Action {
    readonly type: string = CommonActionMap.UpdateMany
    constructor(private entityName: string, public entities: any[]) {
        super();
        this.type = replaceDefaultToEntity(this.type, entityName);
    }
}
export class UpsertOne extends Action {
    readonly type: string = CommonActionMap.UpsertOne
    constructor(private entityName: string, public entity: any) {
        super();
        this.type = replaceDefaultToEntity(this.type, entityName);
    }
}
export class UpsertMany extends Action {
    readonly type: string = CommonActionMap.UpsertMany
    constructor(private entityName: string, public entities: any[]) {
        super();
        this.type = replaceDefaultToEntity(this.type, entityName);
    }
}
// UpsertMany.t
export const replaceDefaultToEntity = (defaultName: string, entityName: string) => {
    if (typeof (entityName) !== "string") {
        // console.error(`[Error] entityName ids need to be String`);
        let _logger = Logger.error(
            "replaceDefaultToEntity",
            `entityName ids need to be String`
        );
        if (envType == "browser" && _logger['options']['isPrint']) console.error(_logger['_str']);
        return null
    }
    let entityNameReg = `${entityName['0']?.toUpperCase()}${entityName?.toLowerCase().slice(1)}`;
    let replaceReg = /Default/;
    return defaultName.replace(replaceReg, entityNameReg)
}

export const transferDefaultToEntity = (entityName: string) => {
    if (typeof (entityName) !== "string") {
        // console.error(`[Error] entityName ids need to be String`);
        let _logger = Logger.error(
            "transferDefaultToEntity",
            `entityName ids need to be String`
        );
        if (envType == "browser" && _logger['options']['isPrint']) console.error(_logger['_str']);
        return null
    }
    let actionMap = _.cloneDeep(CommonActionMap)
    // await Promise.all(
    Object.entries(actionMap).map(entry => {
        let _key = entry[0],
            _val = entry[1];
        actionMap[_key] = replaceDefaultToEntity(_val, entityName);
    })
    // );

    let _payload: { actionMap: typeof CommonActionMap, methodMap: MethodMap } = {
        actionMap,
        methodMap: {
            Initial: (entityName) => new Initial(entityName),
            AddOne: (entityName, entity) => new AddOne(entityName, entity),
            AddMany: (entityName, entities) => new AddMany(entityName, entities),
            SetOne: (entityName, entity) => new SetOne(entityName, entity),
            SetMany: (entityName, entities) => new SetMany(entityName, entities),
            SetAll: (entityName, entities) => new SetAll(entityName, entities),
            RemoveOne: (entityName, id) => new RemoveOne(entityName, id),
            RemoveMany: (entityName, ids) => new RemoveMany(entityName, ids),
            RemoveAll: (entityName) => new RemoveAll(entityName),
            UpdateOne: (entityName, entity) => new UpdateOne(entityName, entity),
            UpdateMany: (entityName, entities) => new UpdateMany(entityName, entities),
            UpsertOne: (entityName, entity) => new UpsertOne(entityName, entity),
            UpsertMany: (entityName, entities) => new UpsertMany(entityName, entities),
        }
    }

    return _payload
}

export interface MethodMap {
    Initial: (entityName) => Initial;
    AddOne: (entityName, entity) => AddOne;
    AddMany: (entityName, entities) => AddMany;
    SetOne: (entityName, entity) => SetOne;
    SetMany: (entityName, entities) => SetMany;
    SetAll: (entityName, entities) => SetAll;
    RemoveOne: (entityName, id) => RemoveOne;
    RemoveMany: (entityName, ids) => RemoveMany;
    RemoveAll: (entityName) => RemoveAll;
    UpdateOne: (entityName, entity) => UpdateOne;
    UpdateMany: (entityName, entities) => UpdateMany;
    UpsertOne: (entityName, entity) => UpsertOne;
    UpsertMany: (entityName, entities) => UpsertMany;
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
    UpsertMany;