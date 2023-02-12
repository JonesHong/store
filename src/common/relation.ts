import {
  catchError,
  concatMap,
  delay,
  filter,
  last,
  map,
  mergeMap,
  reduce,
  tap,
  toArray,
} from 'rxjs/operators';
import { from, Observable, of, pipe, concatWith } from 'rxjs';
import {
  FromJDLMessage,
  IEntityRelationConfig,
  InputRelationshipOption,
  JDLObject,
  RelationBuilderMethod,
  RelationDescription,
  RelationshipConfigTable,
  RelationshipFromJDL,
  RelationshipOptionMethod,
} from './interface/relation.interface';
import { Store } from './store';
import { Settlement } from "./interface/store.interface";
import * as _ from 'lodash';
import { Reducer } from './reducer';
import { Entity } from './entity';
import {
  addMany,
  cloneAndReset,
  removeMany,
  removeOne,
  setOne,
  updateMany,
} from './adapter';
import { v4 as uuidV4 } from 'uuid';
import { selectRelevanceEntity, selectSourceRelevanceEntity } from './selector';
import { Logger } from './logger';
import { DateTime } from 'luxon';
import { Singleton } from './decoratios/singleton';

/**
 * 『只要描述直接關聯的那條線的關係是什麼』
 * 關係會關聯到三層
 * 舉例就是問 Group時會知道有哪些 User (G->D->E->U)
 * Group.userMap (✔)
 * Group.departmentMap.employeeMap.user (✘)
 *
 * 參考 jhipster
 * 關係有四種： OneToOne, OneToMany, ManyToOne, ManyToMany
 * 以建立雙向為主 By Reference
 * https://tinyurl.com/ycksdjh2
 *
 * 參考 SQL
 * FOREIGN KEY ... REFERENCES
 * https://tinyurl.com/2bfse55t
 */


/**
 * 要用這有個前提
 * 要像 SQL一樣在 多對一時，多的那邊會記住一的 id
 * 如用 neo4j等資料庫，在資料庫可以不用這樣記
 * 但是透過 cypher拉資料回來時，把關係對象的 id寫入 return res
 * 這邊所有的 config也要與 neo4j設定一致
 *
 * ＊修正一下：應該是 neo4j cypher要參照此 config
 */
@Singleton
class _Relation {
  private _name = 'Relation';
  private static instance: _Relation;
  public static getInstance: () => _Relation;

  /**
   * Example:
   * relationship OneToOne {
   * JobHistory{job} to Job
   * JobHistory{department} to Department
   * JobHistory{employee} to Employee
   * }
   */
  private _RelationshipFromJDL: RelationshipFromJDL = {
    OneToOne: new Set(),
    OneToMany: new Set(),
    ManyToOne: new Set(),
    ManyToMany: new Set(),
  };
  private _RelationshipConfigTable: RelationshipConfigTable = {};


  public get RelationshipFromJDL() {
    return this._RelationshipFromJDL
  }

  public set RelationshipFromJDL(RelationshipFromJDL: RelationshipFromJDL) {
    this._RelationshipFromJDL = RelationshipFromJDL;
    this.fromJDL(RelationshipFromJDL);
  }

  public get RelationshipConfigTable() {
    return this._RelationshipConfigTable
  }
  public set RelationshipConfigTable(RelationshipConfigTable: RelationshipConfigTable) {
    this._RelationshipConfigTable = RelationshipConfigTable;
  }


  private constructor() { }
  // public  _relationConfig: IEntityRelationConfig;
  // public  set relationConfig(config: IEntityRelationConfig) {
  //     Relation.relationConfig = config;
  // }

  // public  get relationConfig(): IEntityRelationConfig {
  //     return Relation.relationConfig;
  // }

  /**
   * https://www.jhipster.tech/managing-relationships/
   */
  toJDLFormat(config: IEntityRelationConfig) {
    // let entitiesConfig = Object.entries(config);
    // let RelationshipFromJDL = _.cloneDeep(this.RelationshipFromJDL);
    // from(entitiesConfig)
    //   .pipe(
    //     mergeMap((entityConfig) => {
    //       let entityName = entityConfig[0], // key
    //         relationDescriptions = entityConfig[1]; // value
    //       return from(relationDescriptions).pipe(
    //         map((relationDescription) => {
    //           let fromEntity = `${entityName[0].toUpperCase()}${entityName.slice(
    //             1
    //           )}`,
    //             toEntity = relationDescription['targetEntity'],
    //             fromRelationshipName = relationDescription['relationshipName'],
    //             toRelationshipName = '';

    //           switch (relationDescription['type']) {
    //             case 'OneToOne':
    //             case 'OneToMany': {
    //               toRelationshipName = `{${relationDescription['referencesEntity']}}`;
    //               break;
    //             }
    //             case 'ManyToOne':
    //             case 'ManyToMany': {
    //               // as usual

    //               toRelationshipName = `{${fromEntity}(${relationDescription['referencesField']})}`;
    //               break;
    //             }
    //           }
    //           let relationStr = `${fromEntity}{${fromRelationshipName}} to ${toEntity}${toRelationshipName}`;
    //           RelationshipFromJDL[relationDescription['type']].add(relationStr);
    //         })
    //       );
    //     })
    //   )
    //   .subscribe();
    // return RelationshipFromJDL;
  }
  /**
   * Regexp with string match or matchAll.
   *
   * e.g.
   * User{employee(userId)} to Employee{user(id)}
   * entity:  User{
   * relationshipName:  {employee
   * referenceDisplay:  (id
   *
   */
  regexpMap = {
    JDLFormatBasic: new RegExp(/.* to .*/), // 一定要符合
    JDLFormatWith: new RegExp(/.* with .*/), // 尚未支援，不能符合
    JDLFormatRequired: new RegExp(/.* required\}.*/), // 尚未支援，不能符合
    JDLCurlyBrackets: new RegExp(/.+\{.*\}.*/), // { } 檢查大括號
    JDLCurlyBracketsRorL: new RegExp(/(\{|\})/g), // { or } 檢查大括號
    JDLParentheses: new RegExp(/.+\(.*\).*/), // ( ) 檢查小括號
    JDLParenthesesRorL: new RegExp(/(\(|\))/g), // ( or ) 檢查小括號
    JDLEntity: new RegExp(/[\w]+(\{)?/),
    JDLRelationshipName: new RegExp(/\{[\w]+/),
    JDLReferenceDisplay: new RegExp(/\([\w]+/),
  };
  /**
   *
   * @param RelationshipFromJDL
   * @returns
   *
   * e.g.
   * RelationshipFromJDL {
   *     OneToMany: Set(["User{employeeMap(userId)} to Employee{user(id)}"])
   * }
   * ### It will turn into
   * UserRel = [
   *     {
   *       "targetEntity": "Employee",
   *       "relationshipName": "employee",
   *       "type": "OneToMany",
   *       "referencesEntity": "user"
   *     }
   * ]
   */
  fromJDL = (relationshipFromJDL: RelationshipFromJDL, options?: { isTreatSameManyToOneAndOneToMany: boolean }) => {
    // SQL: JOIN Employee employee with user.id = employee.userId
    let relationshipFromJDLEntities: [string, Set<string>][] = Object.entries(relationshipFromJDL);
    let _MessageMap: Map<string, FromJDLMessage[]> = new Map();
    let mainAccumulator: RelationshipConfigTable = {};
    const setMessageMap = (relationshipFromJDL, fromJDLMessage: FromJDLMessage) => {
      let now = DateTime.now();
      fromJDLMessage['dateTimeString'] = now.toFormat("yyyy-MM-dd HH:mm:ss");
      if (!_MessageMap.has(relationshipFromJDL))
        _MessageMap.set(relationshipFromJDL, []);
      let _message = _MessageMap.get(relationshipFromJDL);
      _message.push(fromJDLMessage);
    };

    /**
     * e.g.  
     * from:  
     * jdlString="Group{departmentMap(groupId)} to Department{group(id)}";  
     * 
     * to:  
     * {  
     *     fromDisplayField: "groupId",  
     *     fromEntityString: "Group",  
     *     fromRelationName: "departmentMap",  
     *     toDisplayField: "id",  
     *     toEntityString: "Department",  
     *     toRelationName: "group"  
     * }
     */
    const JDLStringToObjectPipe = () => pipe(
      map((jdlString: string) => {
        /**
         * Employee to Job{employee}
         * JobHistory{job} to Job
         * Group{departmentMap(groupId)} to Department{group(id)}
         */
        if (this.regexpMap['JDLFormatBasic'].test(jdlString) === false) {
          setMessageMap(jdlString, { type: "error", description: "isNotMatchJDLFormatBasic" });
          return;
        }
        if (this.regexpMap['JDLFormatWith'].test(jdlString) === true) {
          setMessageMap(jdlString, { type: "error", description: "isNotSupportedWith" });
          return;
        }
        if (this.regexpMap['JDLFormatRequired'].test(jdlString) === true) {
          setMessageMap(jdlString, { type: "error", description: "isNotSupportedRequired" });
          return;
        }
        /**
           * 從最簡單的 ['User', 'Employee']
           * 稍微複雜的 ['User', 'Employee{user}']
           * 一直到最長的 ['User{employee(userId)}', 'Employee{user(id)}']
           * 用 split將 from跟 to切開
           */
        let splitJDLString = jdlString.split(" to ");
        let payload: JDLObject = {
          fromEntityString: null, fromRelationName: null, fromDisplayField: 'id',
          toEntityString: null, toRelationName: null, toDisplayField: 'id'
        };
        let testJDLFormat = (string, regexpKey): boolean => {
          if (!!!(regexpKey in this.regexpMap)) {
            console.error(`regexpKey: ${regexpKey} is not in:\n`, this.regexpMap)
            return;
          }
          return this.regexpMap[regexpKey].test(string);
        };
        splitJDLString.map((halfJDLString, index) => {
          // e.g. halfJDLString = "Group{departmentMap(groupId)}";
          let direction = index == 0 ? 'from' : 'to';
          if (testJDLFormat(halfJDLString, "JDLEntity") === false) {
            setMessageMap(jdlString, { type: "error", description: "isNotMatchJDLEntity" });
            return;
          } else {
            payload[`${direction}EntityString`] = halfJDLString.match(this.regexpMap['JDLEntity'])[0] // Group{ or Group
            if (payload[`${direction}EntityString`].includes("{"))
              payload[`${direction}EntityString`] = payload[`${direction}EntityString`].slice(0, -1); // Group
          }

          if (halfJDLString.match(this.regexpMap['JDLCurlyBracketsRorL'])?.length == 1) {
            // e.g. Group{departmentMap(groupId) or Group departmentMap(groupId)}
            // ["{"] or ["}"]
            setMessageMap(jdlString, { type: "error", description: "syntaxErrorJDLCurlyBrackets" });
          } else {
            // e.g. Group{departmentMap(groupId)}
            // ["{", "}"]
            if (testJDLFormat(halfJDLString, "JDLCurlyBrackets") === true) {
              // 找到 RelationName，直接拿來用
              payload[`${direction}RelationName`] = halfJDLString.match(this.regexpMap['JDLRelationshipName'])[0] // {department
                .slice(1); // department
            }
            else {
              // 找不到 RelationName，將用另一半的 EntityString
              // e.g. GroupUser
              payload[`${direction}RelationName`] = splitJDLString[index == 0 ? 1 : 0].match(this.regexpMap['JDLEntity'])[0] // GroupUser{ or GroupUser
              if (payload[`${direction}RelationName`].includes("{"))
                payload[`${direction}RelationName`] = payload[`${direction}RelationName`].slice(0, -1); // GroupUser
              payload[`${direction}RelationName`] = payload[`${direction}RelationName`][0].toLowerCase() + // g
                payload[`${direction}RelationName`].slice(1); // roupUser
              // setMessageMap(jdlString, {  type: "error", description:  "isNotMatchJDLCurlyBrackets" });
            }
          }
          // else {
          //     console.warn("1111.理論上不應該出現在這裡，需檢查一下");
          //     console.log(halfJDLString, halfJDLString.match(this.regexpMap['JDLCurlyBracketsRorL']), testJDLFormat(halfJDLString, "JDLCurlyBrackets"))
          //     setMessageMap(jdlString, {  type: "error", description:  "others" });
          // }


          if (halfJDLString.match(this.regexpMap['JDLParenthesesRorL'])?.length == 1) {
            // e.g. Group{departmentMap groupId)} or Group{departmentMap(groupId}
            // ["("] or [")"]
            setMessageMap(jdlString, { type: "error", description: 'syntaxErrorJDLParentheses' });
          } else {
            // e.g. Group{departmentMap(groupId)}
            // ["(", ")"]
            if (testJDLFormat(halfJDLString, "JDLParentheses") === true) {
              // 找到 DisplayField，直接拿來用
              payload[`${direction}DisplayField`] = halfJDLString.match(this.regexpMap['JDLReferenceDisplay'])[0] // (groupId
                .slice(1); // groupId
            }
            else {
              // 找不到 DisplayField，預設是 id
              //    setMessageMap(jdlString, {  type: "error", description:  "isNotMatchJDLParentheses" });
            }

          }
          //  else {
          //     console.warn("22222.理論上不應該出現在這裡，需檢查一下");
          //     setMessageMap(jdlString, {  type: "error", description:  "others" });
          // }
        })

        let jdlStringCOMB1 = `${payload['fromEntityString']}{${payload['fromRelationName']}(${payload['fromDisplayField']})}` +
          " to " +
          `${payload['toEntityString']}{${payload['toRelationName']}(${payload['toDisplayField']})}`;

        let jdlStringCOMB2 = `${payload['fromEntityString']}{${payload['fromRelationName']}}` +
          " to " +
          `${payload['toEntityString']}{${payload['toRelationName']}}`;

        let jdlStringCOMB3 = `${payload['fromEntityString']}` +
          " to " +
          `${payload['toEntityString']}`;
        if ((jdlString !== jdlStringCOMB1) && (jdlString !== jdlStringCOMB2) && (jdlString !== jdlStringCOMB3)) {
          setMessageMap(jdlString, { type: "error", description: "others" });
          return;
        }
        return payload;
      }),
      filter(val => !!val)
    );
    /**
    * EntityString as first key, RelationName as second key.  
    * Turn it into @type InputRelationshipOption.  
    * 
    * e.g.   
    * from:
    * {  
    *     fromDisplayField: "groupId",  
    *     fromEntityString: "Group",  
    *     fromRelationName: "departmentMap",  
    *     toDisplayField: "id",  
    *     toEntityString: "Department",  
    *     toRelationName: "group"  
    * } 
    *  
    * to:  
    * "OneToMany"
    * {  
    *  "Group": {  
    *      _relationshipOptions: [{
    *          "departmentMap":{
    *              inputEntityOptions:{relationName:"departmentMap",displayField:"groupId",method:"setRelationship"},
    *              thisEntityOptions:{relationName:"group",displayField:"id",method:"addRelationships"},
    *      }],
    *      _relatedEntityMap: new Map().set("Department", {...}),
    *      _relatedRelationNameSet: new Map().add("departmentMap", {...}),
    *  },  
    *  "Department":{  
    *      _relationshipOptions: [{
    *          "group":{
    *              inputEntityOptions:{relationName:"group",displayField:"id",method:"addRelationships"},
    *              thisEntityOptions:{relationName:"departmentMap",displayField:"groupId",method:"setRelationship"},
    *      }],
    *      _relatedEntityMap: new Map().set("Group", {...}),
    *      _relatedRelationNameSet: new Map().add("group", {...}),
    *  }  
    * }  
    * 
    */
    const JDLObjectToRelationshipConfigTablePipe = (key) => pipe(
      reduce((accumulator: RelationshipConfigTable, jdlObject: JDLObject) => {
        let switchCount = 0, keyClone = key;

        const switchJDLObjectFromAndTo = () => {
          if (switchCount > 1) return;
          let direction = switchCount == 0 ? 'from' : 'to',
            oppositeDirection = switchCount == 0 ? 'to' : 'from';
          if (switchCount == 1) {
            // e.g. key = "OneToMany";
            keyClone = keyClone.split("To") // ["One","Many"]
              .reverse() // ["Many","One"]
              .join("To"); // keyClone = "ManyToOne"
          }

          let inputEntityOptionsMethod!: RelationshipOptionMethod,
            thisEntityOptionsMethod!: RelationshipOptionMethod;
          switch (keyClone) {
            case "OneToOne": {
              inputEntityOptionsMethod = "setRelationship";
              thisEntityOptionsMethod = "setRelationship";
            }
              break;
            case "OneToMany": {
              inputEntityOptionsMethod = "addRelationships";
              thisEntityOptionsMethod = "setRelationship";

            }
              break;
            case "ManyToOne": {
              inputEntityOptionsMethod = "setRelationship";
              thisEntityOptionsMethod = "addRelationships";
            }
              break;
            case "ManyToMany": {
              inputEntityOptionsMethod = "addRelationships";
              thisEntityOptionsMethod = "addRelationships";
            }
              break;

            default:
              break;
          }
          if (!!!accumulator[jdlObject[`${direction}EntityString`]]) {
            accumulator[jdlObject[`${direction}EntityString`]] = {
              _relationshipOptions: [],
              _relatedEntityMap: new Map(),
              _relatedRelationNameMap: new Map(),
            }
          }
          let { _relationshipOptions, _relatedEntityMap, _relatedRelationNameMap } = accumulator[jdlObject[`${direction}EntityString`]];

          let tempRelationshipOption: InputRelationshipOption = {
            inputEntityOptions: {
              relationName: jdlObject[`${direction}RelationName`],
              displayField: jdlObject[`${direction}DisplayField`],
              method: inputEntityOptionsMethod
            },
            thisEntityOptions: {
              relationName: jdlObject[`${oppositeDirection}RelationName`],
              displayField: jdlObject[`${oppositeDirection}DisplayField`],
              method: thisEntityOptionsMethod
            }
          };
          _relationshipOptions.push(tempRelationshipOption);
          _relatedEntityMap.set(jdlObject[`${oppositeDirection}EntityString`], tempRelationshipOption);
          if (accumulator[jdlObject[`${direction}EntityString`]]._relatedRelationNameMap.has(jdlObject[`${direction}RelationName`])) {

          }
          else {
            _relatedRelationNameMap.set(jdlObject[`${direction}RelationName`], tempRelationshipOption);
          }

          switchCount++;
          switchJDLObjectFromAndTo();
        };

        switchJDLObjectFromAndTo();
        return accumulator;
      }, mainAccumulator)
    );

    from(relationshipFromJDLEntities).pipe(
      mergeMap(entities => {
        let key = entities[0], // "OneToOne" | "OneToMany" | "ManyToOne" | "ManyToMany"
          value = entities[1];
        // console.log(value)
        return from(value).pipe(
          // tap(val => console.log(1111,val)),
          JDLStringToObjectPipe(),
          JDLObjectToRelationshipConfigTablePipe(key),
        )
      }),
      last()
    )
      .subscribe(val => {
        // console.log("RelationshipConfigTable:\n", val);
        console.log("_MessageMap:\n", _MessageMap);
        this.RelationshipConfigTable = val;
      })
  }

  private _reducerSettlement: Settlement;
  public StoreRelation<initialState, Reducers>(
    store: Store<initialState, Reducers>,
    config: IEntityRelationConfig
  ) {
    let count = 0;
    // local cache to be compare with new one.
    // let _reducerSettlement: settlement;
    // only clone once after init
    let _stateClone: initialState = _.cloneDeep(store['state']);
    // for update _stateClonePipe
    let _reducer: Reducer<any, any>,
      _values: { create: any[]; update: any[]; delete: string[] },
      _sourceEntity,
      _sourceState,
      _sourceRelationConfigs: RelationDescription[],
      _targetEntity,
      _targetState,
      _targetRelationConfigs: RelationDescription[],
      _targetRelationConfig: RelationDescription;
    let _commonRelationPipe: any = () => {
      return pipe(
        mergeMap((entity: Entity) => {
          let entityId = entity['id'];
          if (!!_sourceRelationConfigs && _sourceRelationConfigs.length !== 0) {
            let _configsIndex = 0;
            return from(_sourceRelationConfigs).pipe(
              map((_sourceRelationConfig) => {
                const findTargetRelationConfig = () => {
                  let _payloadIndex = _.findIndex(
                    _targetRelationConfigs,
                    (config, index) => {
                      // console.log(329083038203, _configsIndex, index, config)
                      // console.log(_configsIndex !== index, config['targetEntity'] == `${_sourceEntity[0].toUpperCase()}${_sourceEntity.slice(1)}`)
                      if (config['targetEntity'] == `${_sourceEntity[0].toUpperCase()}${_sourceEntity.slice(1)}`
                      ) {
                        _configsIndex += 1;
                        return true;
                      } else return false;
                    },
                    _configsIndex
                  );
                  let _payload = _targetRelationConfigs[_payloadIndex]

                  if (!_payload) {
                    _configsIndex = 0;
                    return findTargetRelationConfig();
                  }
                  return _payload;
                };

                _targetEntity = `${_sourceRelationConfig['targetEntity'][0].toLowerCase()}${_sourceRelationConfig['targetEntity'].slice(1)}`;
                _targetState = _stateClone[_targetEntity];
                _targetRelationConfigs = config[_targetEntity];
                // console.log(333333,config, _targetEntity, _sourceEntity)
                _targetRelationConfig = findTargetRelationConfig();
                // console.log(412, _targetRelationConfig);

                let relevanceEntities = [];
                switch (_sourceRelationConfig['type']) {
                  case 'OneToOne': {
                    relevanceEntities = selectRelevanceEntity(_targetState, {
                      key: `${_sourceRelationConfig['relationshipName']}Id`,
                      value: entityId,
                    });
                    if (relevanceEntities.length == 0) {
                      let sourceKey = _sourceRelationConfig['targetEntity'];
                      let key = `${sourceKey[0].toLowerCase() + sourceKey.slice(1)
                        }`;
                      relevanceEntities = selectSourceRelevanceEntity(
                        _targetState,
                        { key: `${key}Id`, value: entity }
                      );
                    }
                    relevanceEntities.length !== 0
                      ? entity.setOneToOne(relevanceEntities, {
                        target: _targetRelationConfig,
                        source: _sourceRelationConfig,
                      })
                      : null;
                    // relevanceEntities.length !== 0 ? entity.setOneToOne(relevanceEntities) : null;
                    break;
                  }
                  case 'OneToMany': {
                    // target是多的那邊
                    relevanceEntities = selectRelevanceEntity(_targetState, {
                      key: `${_targetRelationConfig['referencesField']}`,
                      value: entityId,
                    });

                    // if (entityId == "constructionLocation-33941722-a859-43c5-920a-34015ca5d730") {
                    // console.log(23823098, relevanceEntities)
                    // }

                    if (relevanceEntities.length == 0) {
                      let sourceKey = _sourceRelationConfig['targetEntity'];
                      let key = `${sourceKey[0].toLowerCase() + sourceKey.slice(1)
                        }`;
                      relevanceEntities = selectSourceRelevanceEntity(
                        _targetState,
                        { key: `${key}Id`, value: entity }
                      );
                    }

                    relevanceEntities.length !== 0
                      ? entity.addManyToOne(relevanceEntities, {
                        target: _targetRelationConfig,
                        source: _sourceRelationConfig,
                      })
                      : null;

                    // relevanceEntities.length !== 0 ? entity.addManyToOne(relevanceEntities) : null;
                    break;
                  }
                  case 'ManyToOne': {
                    // 依照
                    relevanceEntities = selectRelevanceEntity(_targetState, {
                      key: `${_targetRelationConfig['referencesEntity']}`,
                      value: entity[_sourceRelationConfig['referencesField']],
                    });
                    if (relevanceEntities.length == 0) {
                      let sourceKey = _sourceRelationConfig['targetEntity'];
                      let key = `${sourceKey[0].toLowerCase() + sourceKey.slice(1)
                        }`;
                      relevanceEntities = selectSourceRelevanceEntity(
                        _targetState,
                        { key: `${key}s`, value: entity }
                      );
                    }

                    relevanceEntities.length !== 0
                      ? entity.setOneToMany(relevanceEntities, {
                        target: _targetRelationConfig,
                        source: _sourceRelationConfig,
                      })
                      : null;
                    // relevanceEntities.length !== 0 ? entity.setOneToMany(relevanceEntities) : null;
                    break;
                  }
                  case 'ManyToMany': {
                    // relevanceEntities = selectRelevanceEntity(_targetState, { key: `${_sourceRelationConfig['referencesField']}IdList`, value: entityId });
                    relevanceEntities = selectRelevanceEntity(_targetState, {
                      key: `${_sourceRelationConfig['referencesField']}`,
                      value: entityId,
                    });
                    if (relevanceEntities.length == 0) {
                      let sourceKey = _sourceRelationConfig['targetEntity'];
                      let key = `${sourceKey[0].toLowerCase() + sourceKey.slice(1)
                        }`;
                      relevanceEntities = selectSourceRelevanceEntity(
                        _targetState,
                        { key: `${key}s`, value: entity }
                      );
                    }
                    relevanceEntities.length !== 0
                      ? entity.addManyToMany(relevanceEntities, {
                        target: _targetRelationConfig,
                        source: _sourceRelationConfig,
                      })
                      : null;
                    // relevanceEntities.length !== 0 ? entity.addManyToMany(relevanceEntities) : null;
                    break;
                  }
                }
              })
            );
          } else {
            return of(null);
          }
        }),
        last()
      );
    };

    return store.settlement$.pipe(
      filter((reducerSettlement: Settlement) => {
        return (
          !!store &&
          (!this._reducerSettlement ||
            this._reducerSettlement['_currentHash'] !==
            reducerSettlement['_currentHash'])
        );
      }),
      // filter((reducerSettlement: settlement) => {
      //     return !!reducerSettlement['lastSettlement']['isChanged'];
      // }),
      mergeMap((reducerSettlement) => {
        let _reducerSettlement = _.cloneDeep(reducerSettlement);
        this._reducerSettlement = _reducerSettlement;

        if (!!_reducerSettlement['lastSettlement']['isChanged']) {
          return of(_reducerSettlement).pipe(
            // update _stateClone
            map((_reducerSettlement) => {
              _sourceEntity = _reducerSettlement['reducerName'];
              _reducer = store['reducers'][_reducerSettlement['reducerName']];
              //   _sourceState = cloneAndReset(
              //     _stateClone[_reducerSettlement['reducerName']]
              //   );
              _sourceState = _stateClone[_sourceEntity];

              _values = {
                create: _reducer.createEntities(
                  Object.values(_reducerSettlement['lastSettlement']['create'])
                ),
                // update: _reducer.createEntities(
                //   Object.values(_reducerSettlement['lastSettlement']['update'])
                // ),
                update: Object.values(
                  _reducerSettlement['lastSettlement']['update']
                ),
                delete: Object.values(
                  _reducerSettlement['lastSettlement']['delete']
                ),
              };

              //   _sourceRelationConfigs = config[reducerSettlement['reducerName']];
              _sourceRelationConfigs = config[_sourceEntity];
              _values.create.length !== 0
                ? (_sourceState = addMany(_values.create, _sourceState))
                : null;
              //   _values.update.length !== 0
              //     ? (_sourceState = updateMany(_values.update, _sourceState))
              //     : null;
              //更新=>先斷開連結再重新build
              _values['update'] = _values['update']
                .map((entityObject) => {
                  // console.log(
                  //   entityObject,
                  //   _sourceState,
                  //   _sourceState['ids'].find((id) => id == entityObject['id'])
                  // );
                  if (
                    !_sourceState['ids'].find((id) => id == entityObject['id'])
                  ) {
                    // Logger.warn()
                    return;
                  }
                  let _entity =
                    _stateClone[_sourceEntity]['entities'][entityObject['id']];
                  // 可能有問題，先試試看
                  _entity.breakAllReferences();
                  // console.log(_entity)
                  _entity = _reducer.createEntity(entityObject);
                  // Object.entries(entityObject).map(entry => {
                  //     // console.log(_key)
                  //     let _key = entry[0], _val = entry[1];
                  //     _entity[_key] = _val;
                  // })
                  _sourceState = setOne(_entity, _sourceState);
                  return _entity;
                })
                .filter((entity) => !!entity);
              // 先斷開連結才刪除
              _values['delete'].map((id: string) => {
                let _entity: Entity = selectRelevanceEntity(_sourceState, {
                  key: 'id',
                  value: id,
                })[0];
                _entity.breakAllReferences();
                _sourceState = removeOne(id, _sourceState);
              });
              // _values.delete.length !== 0 ? _sourceState = removeMany(_values.delete, _sourceState) : null;
              _sourceState['_previousHash'] = _sourceState['_currentHash'];
              _sourceState['_currentHash'] = `settlement-${uuidV4()}`;
              //   _stateClone[reducerSettlement['reducerName']] = _sourceState;
              _sourceState.lastSettlement = reducerSettlement['lastSettlement'];
              _stateClone[_sourceEntity] = _sourceState;

              return _reducerSettlement;
            }),
            mergeMap((ignoreAnyway) => {
              if (_values['create'].length !== 0) {
                return from(_values['create']).pipe(
                  // concatMap(val => of(val).pipe(delay(1))),
                  _commonRelationPipe()
                );
              } else {
                return of(null);
              }
            }),
            mergeMap((ignoreAnyway) => {
              if (_values['update'].length !== 0) {
                return from(_values['update']).pipe(_commonRelationPipe());
              } else {
                return of(null);
              }
            })
            // concatWith(
            //   of(_reducerSettlement).pipe(
            //     mergeMap((_reducerSettlement) => {
            //       if (_values['create'].length !== 0) {
            //         return from(_values['create']).pipe(
            //           // concatMap(val => of(val).pipe(delay(1))),
            //           _commonRelationPipe()
            //         );
            //       } else {
            //         return of(null);
            //       }
            //     })
            //   ),
            //   of(_reducerSettlement).pipe(
            //     mergeMap((reducerSettlement) => {
            //       if (_values['update'].length !== 0) {
            //         return from(_values['update']).pipe(_commonRelationPipe());
            //       } else {
            //         return of(null);
            //       }
            //     })
            //   )
            // )
            // Do create first
            // mergeMap((reducerSettlement) => {
            //   if (_values['create'].length !== 0) {
            //     return from(_values['create']).pipe(_commonRelationPipe());
            //   } else {
            //     return of(null);
            //   }
            // }),
            // mergeMap((reducerSettlement) => {
            //   if (_values['update'].length !== 0) {
            //     return from(_values['update']).pipe(_commonRelationPipe());
            //   } else {
            //     return of(null);
            //   }
            // })
          );
        } else {
          return of(null);
        }
      }),
      // last(),
      map((res: null) => _stateClone),
      catchError((err) => {
        return of(err);
      })
    );
  }


  public switchRelationshipOptions = (options: InputRelationshipOption) => {
    return {
      ...options,
      inputEntityOptions: options.thisEntityOptions,
      thisEntityOptions: options.inputEntityOptions,
    }
  }
  public buildRelationship: RelationBuilderMethod = ({ thisEntity, inputEntity }, options) => {
    let { method } = options.thisEntityOptions;
    thisEntity[method](inputEntity, options);
  }
  public setRelationship: RelationBuilderMethod = ({ thisEntity, inputEntity }, options) => {
    let {
      relationName = `_${inputEntity._name[0].toLowerCase()}${inputEntity._name.slice(1)}`,
      displayField = "id",
      method
    } = options.inputEntityOptions;
    // console.log(`${thisEntity._name}.setRelationship:\n`, options, '\n', thisEntity);
    if (!!thisEntity[relationName]) return;
    thisEntity[relationName] = inputEntity;
    options['inputEntityClassName'] = inputEntity._name;
    thisEntity.setRelationshipKeyMap(relationName, options);

    inputEntity[method](
      thisEntity,
      this.switchRelationshipOptions(options)
    )
  }
  public addRelationships: RelationBuilderMethod = ({ thisEntity, inputEntity }, options) => {
    let { isMultiRelationNameEndWithMap = true } = options;
    let {
      relationName = `_${inputEntity._name[0].toLowerCase()}${inputEntity._name.slice(1)}`,
      displayField = "id",
      method
    } = options.inputEntityOptions;
    if (isMultiRelationNameEndWithMap) {
      relationName = relationName.slice(-3) === "Map" ? relationName : `${relationName}Map`;
      options['inputEntityOptions']['relationName'] = relationName;
    }
    // console.log(`${thisEntity._name}.addRelationships:\n`, options, '\n', thisEntity);
    if (!!!thisEntity[relationName]) thisEntity[relationName] = {};
    if (!!thisEntity[relationName][inputEntity[displayField]]) return;
    thisEntity[relationName][inputEntity[displayField]] = inputEntity;
    options['inputEntityClassName'] = inputEntity._name;
    thisEntity.setRelationshipKeyMap(relationName, options);

    inputEntity[method](
      thisEntity,
      this.switchRelationshipOptions(options)
    )
  }
  public breakInputEntityRelationships: RelationBuilderMethod = ({ thisEntity, inputEntity }, options) => {
    // let { inputEntityOptions, thisEntityOptions } = options;
    // console.log(`${this._name}.breakInputEntityRelationships:\n `, this._relationshipKeyMap)
    let { relationName, displayField = "id" } = options.inputEntityOptions;
    if (!!!thisEntity[relationName]) return;
    if (displayField in thisEntity[relationName]) {
      // 對象是一的時候，this可能是一或是多的
      // console.log(3333)
      delete thisEntity[relationName];
    } else if (!!thisEntity[relationName][inputEntity[displayField]]) {
      // 對象是多的時候，this可能是一或是多的
      delete thisEntity[relationName][inputEntity[displayField]];
      // console.log(4444)
    } else {
      console.error("不可能!!，一定是哪裡出錯了")
    }
    thisEntity.deleteRelationshipKeyMap(relationName);
  }

  public breakEntityRelationshipByOptions: RelationBuilderMethod = ({ thisEntity, inputEntity }, options) => {
    // console.log(`${this._name}.breakThisEntityRelationshipByOptions:\n `, this._relationshipKeyMap)
    let { relationName } = options.inputEntityOptions;
    let { displayField = "id", method } = options.thisEntityOptions;

    let relatedEntity!: Entity;
    if (!!!thisEntity[relationName]) return;
    // 1. 先斷開自己在對方那邊紀錄的關係，所以拿 relatedEntityOptions.thisEntityOptions.method檢查
    switch (method) {
      case "setRelationship": {
        // console.log(1111)
        // 此 Entity與對方的關係為"一對一(1:1)"或是"多對一(*:1)"
        relatedEntity = thisEntity[relationName];
        relatedEntity.breakInputEntityRelationships(thisEntity, this.switchRelationshipOptions(options));
      }
        break;
      case "addRelationships": {
        // console.log(2222)
        // 此 Entity與對方的關係為"一對多(1:*)"或是"多對多(*:*)"
        Object.values(thisEntity[relationName]).map((entity: Entity) => {
          relatedEntity = entity;
          relatedEntity.breakInputEntityRelationships(thisEntity, this.switchRelationshipOptions(options));
        });
      }
        break;
    }
    // 2. 接著把自己這邊跟對方有關的刪掉
    delete thisEntity[relationName];
    thisEntity.deleteRelationshipKeyMap(relationName);
  }
  public breakAllEntityRelationships = (thisEntity: Entity) => {
    // console.log(`${this._name}.breakAllEntityRelationships:\n `, this._relationshipKeyMap)
    // console.log( this._relationshipKeyMap.entries())
    Array.from(thisEntity.relationshipKeyMap.values()).map((options) => thisEntity.breakEntityRelationshipByOptions(options));
  }

}

export const Relation = _Relation.getInstance();


