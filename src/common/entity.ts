import * as _ from 'lodash';
import { envType } from './env_checker';
import { RelationDescription } from './interface/relation.interface';
import { Logger } from './logger';
import { Reducer } from './reducer';

type OptionsRelationDescription = {
  source: RelationDescription;
  target: RelationDescription;
};
type BuildRelationOptions = {
  targetKey: string;
};
export abstract class Entity {
  abstract _name: string;

  private _relationKeysMap: Map<string, string> = new Map([]);

  public get relationKeysMap() {
    return this._relationKeysMap;
  }

  /**
   * Object key = relateEntity/relationshipName
   */
  // private _relationDescription: { [key: string]: OptionsRelationDescription } = {};
  // public get relationDescription() {
  //     return this._relationDescription
  // }

  private relationOptionSwitch(options: OptionsRelationDescription) {
    let newOptions = {
      ...options,
      source: options['target'],
      target: options['source'],
    };
    return newOptions;
  }
  private relationKeyModify(key: string) {
    let regexForMap = new RegExp('Map'),
      newKey;
    if (regexForMap.test(key)) {
      newKey = key;
    } else {
      newKey = `${key}Map`;
    }
    return newKey;
  }
  setOneToOne = (
    theOne: Entity | Entity[],
    options?: OptionsRelationDescription | BuildRelationOptions
  ) => {
    const method = (one: Entity) => {
      let _key =
        !!options && 'target' in options
          ? `_${options['target']['relationshipName']}` // For options offer
          : `_${one._name}`; // As default
      if (
        !!options &&
        'targetKey' in options &&
        !this._relationKeysMap.has(_key)
      )
        this._relationKeysMap.set(_key, options['targetKey']);
      if (!!this[_key] && _.isEqual(this[_key], one)) {
        let _logger = Logger.warn(
          `setOneToOne`,
          `${theOne['id']} already exist in ${this['id']}.${_key}`,
          { isPrint: false }
        );
        if (envType == 'browser' && _logger['options']['isPrint'])
          console.warn(_logger['_str']);
        // console.warn(`[Warning/setOneToOne] ${theOne['id']} already exist in ${this['id']}.${_key}`);
        return null;
      }
      this[_key] = one;
      if (!!options && 'source' in options) {
        this._relationKeysMap.set(
          _key,
          `_${options['source']['relationshipName']}`
        );
        one.setOneToOne(this, this.relationOptionSwitch(options));
      } else {
        one.setOneToOne(this, { targetKey: _key });
      }
    };

    if (Array.isArray(theOne)) {
      let _logger = Logger.error(
        'setOneToOne',
        `Input theOne should be Object.`
      );
      if (envType == 'browser' && _logger['options']['isPrint'])
        console.error(_logger['_str']);
      // console.error("[Error/Entity] Input theOne has to be Object.")
      // await Promise.all(
      theOne.map((element) => {
        method(element);
      });
      // );
    } else {
      method(theOne);
    }
  };
  setOneToMany = (
    theOne: Entity | Entity[],
    options?: OptionsRelationDescription | BuildRelationOptions
  ) => {
    const method = (one: Entity) => {

      // console.log(this._name,options)
      // console.log(44444, `_${options['source']['referencesField']}`,`_${options['target']['relationshipName']}`, options)
      let _key =
        !!options && 'target' in options
          ? `_${options['target']['relationshipName']}`
          //  ? `_${options['source']['relationshipName']}`
           // For options offer
          : `_${one._name}`; // As default

      // console.log(3333, options['targetKey'])
      if (
        !!options &&
        'targetKey' in options &&
        !this._relationKeysMap.has(_key)
      )
        this._relationKeysMap.set(_key, options['targetKey']);
      // console.log(237927329, _key, options, this)
      // if (!one._name) {
      //     console.error("[Error/setOneToMany] theOne need to be a Class.");
      //     return null;
      // }
      if (!!this[_key] && _.isEqual(this[_key], one)) {
        let _logger = Logger.warn(
          'setOneToMany',
          `${one['id']} already exist in ${this['id']}.${_key}`,
          { isPrint: false }
        );
        if (envType == 'browser' && _logger['options']['isPrint'])
          console.warn(_logger['_str']);
        // console.warn(`[Warning/setOneToMany] ${one['id']} already exist in ${this['id']}.${_key}`);
        return null;
      }
      this[_key] = one;
      if (!!options && 'source' in options) {
        this._relationKeysMap.set(
          _key,
          this.relationKeyModify(`_${options['source']['relationshipName']}`)
        );
        one.addManyToOne(this, this.relationOptionSwitch(options));
      } else {
        one.addManyToOne(this, { targetKey: _key });
      }
    };

    if (Array.isArray(theOne)) {
      // Logger.error?()
      // console.error("[Error/Entity] Input theOne has to be Object.")
      // await Promise.all(
      theOne.map((element) => {
        method(element);
      });
      // );
    } else {
      method(theOne);
    }
  };
  addManyToOne = (
    theMany: Entity | Entity[],
    options?: OptionsRelationDescription | BuildRelationOptions
  ) => {
    // console.log("\naddManyToOne\n", theMany)
    const method = (many: Entity) => {
      let _key =
        !!options && 'target' in options
          ? this.relationKeyModify(`_${options['target']['relationshipName']}`) // For options offer
          : `_${many._name}Map`; // As default
      let _subKey = many['id'];
      // !options ? theMany?.id : options['referencesField'];
      if (
        !!options &&
        'targetKey' in options &&
        !this._relationKeysMap.has(_key)
      )
        this._relationKeysMap.set(_key, options['targetKey']);

      // if (!theMany._name) {
      //     console.error("[Error/addManyToOne] theMany need to be a Class.");
      //     return null;
      // }
      if (!this[_key]) this[_key] = {};
      if (!!this[_key][_subKey] && _.isEqual(this[_key][_subKey], many)) {
        // console.warn(`[Warning/addManyToOne] ${_subKey} already exist in ${this["id"]}.${_key}`);
        return null;
      }
      this[_key][_subKey] = many;
      if (!!options && 'source' in options) {
        // this[`_relationDescription`][`${options['source']['relateEntity']}/${options['source']['relationshipName']}`] = options;
        this._relationKeysMap.set(
          _key,
          `_${options['source']['relationshipName']}`
        );
        many.setOneToMany(this, this.relationOptionSwitch(options));
      } else {
        many.setOneToMany(this, { targetKey: _key });
      }
    };

    if (Array.isArray(theMany)) {
      // await Promise.all(
      theMany.map((many) => {
        method(many);
      });
      // );
    } else {
      // console.error("[Error/Entity] Input theMany has to be Array.");
      method(theMany);
    }
  };
  addManyToMany = (
    theMany: Entity | Entity[],
    options?: OptionsRelationDescription | BuildRelationOptions
  ) => {
    const method = (many: Entity) => {
      let _key =
        !!options && 'target' in options
          ? this.relationKeyModify(`_${options['target']['relationshipName']}`) // For options offer
          // ? this.relationKeyModify(`_${options['source']['referencesField']}`) // For options offer
          : `_${many._name}Map`; // As default
      let _subKey = many['id'];
      // !options ?  theMany?.id : options['referencesField'];
      // if (!theMany._name) {
      //     console.error("[Error/addManyToMany] theMany need to be a Class.");
      //     return null;
      // }
      if (
        !!options &&
        'targetKey' in options &&
        !this._relationKeysMap.has(_key)
      )
        this._relationKeysMap.set(_key, options['targetKey']);
      if (!this[_key]) this[_key] = {};
      if (!!this[_key][_subKey] && _.isEqual(this[_key][_subKey], many)) {
        // console.warn(`[Warning/addManyToMany] ${_subKey} already exist in ${this["id"]}.${_key}`);
        return null;
      }
      this[_key][_subKey] = many;
      if (!!options && 'source' in options) {
        this._relationKeysMap.set(
          _key,
          this.relationKeyModify(`_${options['source']['relationshipName']}`)
        );
        many.addManyToMany(this, this.relationOptionSwitch(options));
      } else {
        many.addManyToMany(this, { targetKey: _key });
      }
    };

    if (Array.isArray(theMany)) {
      // await Promise.all(
      theMany.map((many) => {
        method(many);
      });
      // );
    } else {
      // console.error("[Error/Entity] Input theMany has to be Array.");
      method(theMany);
    }
  };

  private _propertyKeySet: Set<string> = new Set();
  public get propertyKeySet(): Set<string> {
    return this._propertyKeySet;
  }
  constructor(property) {
    // this['_name'] = this.getClassName();
    this.addProperty(property);
  }

  private _reducer!: Reducer<any, any>;
  public get reducer(): Reducer<any, any> {
    return this._reducer;
  }
  setReducer(reducer: Reducer<any, any>) {
    if (!!this._reducer) return null;
    this._reducer = reducer;
    // reducer.addEntity(this);
  }

  // private _store!: Store<any, any>;
  // public get store(): Store<any, any> {
  //     return this._store;
  // }
  // setStore(store: Store<any, any>) {
  //     if (!!this._store) return null;
  //     this._store = store;
  //     store.addReducer(this);
  // }

  private addProperty = (property: {}) => {
    let entities: [string, any][] = Object.entries(property);
    // await Promise.all(
    entities.map((entity) => {
      let key = entity[0],
        value = entity[1];
      this[key] = value;
      this._propertyKeySet.add(key);
    });
    // )
  };
  /**
   * Pure data of entity
   * @returns
   */
  toObject = (): object => {
    let payload = {};
    // await Promise.all(
    Array.from(this._propertyKeySet).map((key) => {
      payload[key] = this[`${key}`];
    });
    // )
    return payload;
  };
  /**
   * break off ??????????????????
   * Entity delete all references.
   *
   * e.g. ??????????????????????????????????????????????????????????????????????????????????????????
   *   1. ??????????????????????????????????????????????????????????????????????????????
   *   ?????? _key == "_classMap", _targetKey == "_teacher"
   *   ???????????????????????????????????????????????????????????????????????????????????? _teacher??????
   *   ???????????? ???????????? _classMap ??????
   *   2. ?????????????????????????????????????????????????????????
   *   ?????? _key == "_teacher", _targetKey == "_classMap"
   *   ?????????????????????????????????????????? _classMap[class.id]??????
   *   ???????????? ??????????????? _teacher ??????
   *
   * e.g. ???????????????????????????????????????????????????????????????????????????????????????
   *   1. ?????????????????????????????????????????????????????????
   *   ?????? _key == "_studentMap", _targetKey == "_teacherMap"
   *   ???????????????????????????????????????????????????????????????????????????????????? _teacherMap[teacher.id]??????
   *   ???????????? ???????????? _studentMap ??????
   *   2. ??????????????????????????????????????????????????????
   *   ?????? _key == "_teacherMap", _targetKey == "_studentMap"
   *   ????????????????????????????????????????????????????????????????????????????????? _studentMap[student.id]??????
   *   ???????????? ??????????????? _teacherMap ??????
   *
   */
  breakAllReferences() {
    // console.warn(`[Warning/Entity] Objectize has been tigger.`);
    Array.from(this._relationKeysMap).map((relation) => {
      let _key = relation[0],
        _targetKey = relation[1];
      let _referenceTarget!: Entity;
      if (!!!this[_key]) return;
      if ('id' in this[_key]) {
        // ????????????????????????this????????????????????????
        _referenceTarget = this[_key];
        _referenceTarget.breakTargetReference(_targetKey, this['id']);
      } else {
        // ????????????????????????this????????????????????????
        Object.values(this[_key]).map((entity: Entity) => {
          _referenceTarget = entity;
          _referenceTarget.breakTargetReference(_targetKey, this['id']);
        });
      }
      delete this[_key];
    });
  }
  breakTargetReference(reference: string, id: string) {
    if (!!!this[reference]) return;
    if ('id' in this[reference]) {
      // ????????????????????????this????????????????????????
      delete this[reference];
    } else if (!!this[reference][id]) {
      // ????????????????????????this????????????????????????
      delete this[reference][id];
    }
  }
}
