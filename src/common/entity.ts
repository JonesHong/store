import * as _ from 'lodash';
import { envType } from './env_checker';
import { InputRelationshipOption, RelationBreakerSetting } from './interface/relation.interface';
import { Logger } from './logger';
import { Reducer } from './reducer';
import { DefaultRelationBreakerSetting, Relation } from "./relation"
import { customAlphabet } from 'nanoid/non-secure'
import { v4Generator } from './functions/Generator';


export abstract class Entity {
  abstract _name: string;
  public id?: string;
  private _dataKeySet: Set<string> = new Set();
  private _relationshipKeyMap: Map<string, InputRelationshipOption> = new Map();

  public get dataKeySet(): Set<string> {
    return this._dataKeySet;
  }
  public get relationshipKeyMap(): Map<string, InputRelationshipOption> {
    return this._relationshipKeyMap
  }
  public setRelationshipKeyMap(relationName: string, options: InputRelationshipOption) {
    this._relationshipKeyMap.set(relationName, options);
  }
  public deleteRelationshipKeyMap(relationName: string) {
    this._relationshipKeyMap.delete(relationName);
  }

  /**
   * e.g. 假設 member 與 room
   * member.buildRelationship(
   *  room,
   *    {
   *      inputEntityOptions: { "relationName": "_room", "method": "addRelationships" },
   *      thisEntityOptions: { "relationName": "_memberMap", "displayField": "clientId", "method": "setRelationship" },
   *      // member.id -> member.clientId
   *    }
   * )  
   * @param param
   * @param options 
   */
  buildRelationship(entity: Entity, options: InputRelationshipOption) {
    Relation.buildRelationship({ thisEntity: this, inputEntity: entity }, options);
  }
  setRelationship(entity: Entity, options: InputRelationshipOption) {
    Relation.setRelationship({ thisEntity: this, inputEntity: entity }, options);
  }

  addRelationships(entity: Entity, options: InputRelationshipOption) {
    Relation.addRelationships({ thisEntity: this, inputEntity: entity }, options);
  }

  breakInputEntityRelationships(entity: Entity, options: InputRelationshipOption) {
    return Relation.breakInputEntityRelationships({ thisEntity: this, inputEntity: entity }, options);
  }
  breakEntityRelationshipByOptions(options: InputRelationshipOption) {
    return Relation.breakEntityRelationshipByOptions({ thisEntity: this }, options);
  }
  breakAllEntityRelationships() {
    return Relation.breakAllEntityRelationships(this);
  }
  killItSelf(isTerminated: boolean = true) {
    this.breakAllEntityRelationships();
    if (!!isTerminated)
      Array.from(this._dataKeySet).map((key) => {
        this[key] = null;
        delete this[key];
      });

    Array.from(this._relationshipKeyMap?.keys()).map((key) => {
      this[key] = null;
      delete this[key];
    })
  }

  constructor(property) {
    // this['_name'] = this.getClassName();
    this.upsertData(property);
  }

  private _reducer!: Reducer<any, any>;
  public get reducer(): Reducer<any, any> {
    return this._reducer;
  }
  setReducer(reducer: Reducer<any, any>) {
    if (!!this._reducer) return null;
    this._reducer = reducer;
  }

  upsertData(data: {}) {
    let entityEntries: [string, any][] = Object.entries(data);
    entityEntries.map((entityEntry) => {
      let key = entityEntry[0],
        value = entityEntry[1];
      this[key] = value;
      this._dataKeySet.add(key);
    });
    if (!!!this.id) this.id = v4Generator();
    return this;
  };

  toObject(): object {
    let payload = {};

    Array.from(this._dataKeySet).map((key) => {
      payload[key] = this[key];
    });

    // 用來應對動態的關係(未寫入資料庫的)，像是聊天室與成員的關係
    // Array.from(this._relationshipKeyMap.values()).map((options) => {
    //   let { isMultiRelationNameEndWithMap = true } = options;
    //   let { method } = options.thisEntityOptions;
    //   let { relationName, displayField = "id" } = options.inputEntityOptions;
    //   let newDisplayField = displayField[0].toUpperCase() + displayField.slice(1);
    //   switch (method) {
    //     case "setRelationship": {
    //       // 此 Entity與對方的關係為"一對一(1:1)"或是"多對一(*:1)"
    //       payload[`${relationName}${newDisplayField}`] = this[relationName][displayField];
    //       // console.log(111, this._className, options, '\n', this);
    //     }
    //       break;
    //     case "addRelationships": {
    //       // 此 Entity與對方的關係為"一對多(1:*)"或是"多對多(*:*)"
    //       newDisplayField += 's';
    //       if (!!isMultiRelationNameEndWithMap || new RegExp(/.*Map/).test(relationName)) {
    //         // console.log(222, this._className, options, '\n', this);
    //         payload[relationName.replace("Map", newDisplayField)] = Object.keys(this[relationName]);
    //       } else {
    //         // console.log(333, this._className, options, '\n', this);
    //         payload[`${relationName}${newDisplayField}`] = Object.keys(this[relationName]);
    //       }
    //     }
    //       break;
    //   }
    // });

    // console.log('\n\n', payload)
    return payload;
  };
}
