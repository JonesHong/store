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
import { from, Observable, of, pipe, throwError, UnaryFunction } from 'rxjs';
import {
  IEntityRelationConfig,
  RelationDescription,
  RelationshipByType,
} from './interface/relation.interface';
import { settlement, Store } from './store';
import * as _ from 'lodash';
import { Reducer } from './reducer';
import { Entity } from './entity';
import {
  addMany,
  cloneAndReset,
  removeMany,
  removeOne,
  updateMany,
} from './adapter';
import { v4 as uuidV4 } from 'uuid';
import { selectRelevanceEntity, selectSourceRelevanceEntity } from './selector';
import { Logger } from './logger';

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
// export const EntityRelationConfig: IEntityRelationConfig = {
//     user,
//     employee,
//     group,
//     department
// };

/**
 * 參考：
 * http://www.jhipster.pro/docs/jdl/relationships-cn
 */
const OneToMany = [
  // SQL: JOIN Employee employee with user.id = employee.userId
  'User{employee(userId)} to Employee{user(id)}',
  'User{playAs(userId)} to Employee{belongTo(id)}',
];
const ManyToOne = [
  // SQL: JOIN Employee employee with user.id = employee.userId
  'Employee{user(id)} to User{employee(userId)}',
];

/**
 * 要用這有個前提
 * 要像 SQL一樣在 多對一時，多的那邊會記住一的 id
 * 如用 neo4j等資料庫，在資料庫可以不用這樣記
 * 但是透過 cypher拉資料回來時，把關係對象的 id寫入 return res
 * 這邊所有的 config也要與 neo4j設定一致
 *
 * ＊修正一下：應該是 neo4j cypher要參照此 config
 */
export class Relation {
  private _name = 'Relation';
  private static instance: Relation;
  public static getInstance(): Relation {
    if (!Relation.instance) {
      Relation.instance = new Relation();
    }

    return Relation.instance;
  }

  /**
   * Example:
   * relationship OneToOne {
   * JobHistory{job} to Job
   * JobHistory{department} to Department
   * JobHistory{employee} to Employee
   * }
   */
  RelationshipByType: RelationshipByType = {
    OneToOne: new Set(),
    OneToMany: new Set(),
    ManyToOne: new Set(),
    ManyToMany: new Set(),
  };
  RelationshipByEntity: { [Entity: string]: RelationDescription[] } = {};

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
    let entitiesConfig = Object.entries(config);
    let relationshipByType = _.cloneDeep(this.RelationshipByType);
    from(entitiesConfig)
      .pipe(
        mergeMap((entityConfig) => {
          let entityName = entityConfig[0], // key
            relationDescriptions = entityConfig[1]; // value
          return from(relationDescriptions).pipe(
            map((relationDescription) => {
              let fromEntity = `${entityName[0].toUpperCase()}${entityName.slice(
                  1
                )}`,
                toEntity = relationDescription['targetEntity'],
                fromRelationshipName = relationDescription['relationshipName'],
                toRelationshipName = '';

              switch (relationDescription['type']) {
                case 'OneToOne':
                case 'OneToMany': {
                  toRelationshipName = `{${relationDescription['referencesEntity']}}`;
                  break;
                }
                case 'ManyToOne':
                case 'ManyToMany': {
                  // as usual

                  toRelationshipName = `{${fromEntity}(${relationDescription['referencesField']})}`;
                  break;
                }
              }
              let relationStr = `${fromEntity}{${fromRelationshipName}} to ${toEntity}${toRelationshipName}`;
              relationshipByType[relationDescription['type']].add(relationStr);
            })
          );
        })
      )
      .subscribe();
    return relationshipByType;
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
  regexpList = {
    JDLFormatBasic: new RegExp(/.* to .*/g),
    curlyBrackets: new RegExp(/.+\{.*\}.*/g), // { } 大括號
    parentheses: new RegExp(/.+\(.*\).*/g), // ( ) 小括號
    entity: new RegExp(/[\w]+\{/g),
    relationshipName: new RegExp(/\{[\w]+/g),
    referenceDisplay: new RegExp(/\([\w]+/g),
  };
  /**
   *
   * @param RelationshipByType
   * @returns
   *
   * e.g.
   * RelationshipByType {
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
  fromJDL(RelationshipByType: RelationshipByType) {
    let relationTypeEntities: [string, Set<string>][] =
      Object.entries(RelationshipByType);
    let relationshipByEntity = _.cloneDeep(this.RelationshipByEntity);
    const regexpMatcher = (str: string) => {
      let regexpList = this.regexpList;
      let isPassBasic = regexpList.JDLFormatBasic.test(str);
      regexpList.JDLFormatBasic.lastIndex = 0;
      if (!isPassBasic) {
        Logger.error(
          this._name,
          `Syntax is wrong.\nPlease make sure there is " to " in this syntax.`
        );
        // console.error(
        //     `Syntax is wrong.\n` +
        //     `Please make sure there is " to " in this syntax.`
        // )
        return null;
      }
      /**
       * 從最簡單的 ['User', 'Employee']
       * 稍微複雜的 ['User', 'Employee{user}']
       * 一直到最長的 ['User{employee(userId)}', 'Employee{user(id)}']
       * 用 split將 from跟 to切開
       */
      let splitString = str.split(' to '),
        curlyBracketsTest = (someStr) => {
          regexpList.curlyBrackets.lastIndex = 0;
          return regexpList.curlyBrackets.test(someStr);
        },
        parenthesesTest = (someStr) => {
          regexpList.parentheses.lastIndex = 0;
          return regexpList.parentheses.test(someStr);
        },
        isBracketLegal = (() => {
          let payload = true;
          // await Promise.all(
          splitString.map((halfStr) => {
            if (!!payload) {
              payload =
                (curlyBracketsTest(halfStr) && parenthesesTest(halfStr)) ||
                (curlyBracketsTest(halfStr) && !parenthesesTest(halfStr)) ||
                (!curlyBracketsTest(halfStr) && !parenthesesTest(halfStr));
            }
          });
          // );
          return payload;
        })();
      if (splitString.length !== 2) {
        Logger.error(
          this._name,
          `Syntax is wrong.\nPlease check fromEntity or toEntity.`
        );
        // console.error(
        //     `Syntax is wrong.\n` +
        //     `Please check fromEntity or toEntity.`
        // );
        return null;
      }
      if (!isBracketLegal) {
        Logger.error(
          this._name,
          `Brackets are wrong.\nMake sure to have only curlyBrackets or both curlyBrackets and parentheses.`
        );
        // console.error(
        //     `Brackets are wrong.\n` +
        //     `Make sure to have only curlyBrackets or both curlyBrackets and parentheses.`
        // )
        return null;
      }

      let entityGetter = (index: number) => {
          let halfStr = splitString[index],
            matcher,
            payload;
          if (curlyBracketsTest(halfStr)) {
            // User{employee} => User{ => User
            matcher = halfStr.match(regexpList.entity);
            if (matcher.length == 0) {
              Logger.error(this._name, 'There goes wrong.');
            } else {
              payload = matcher[0].slice(0, -1);
            }
          } else {
            // User
            payload = halfStr;
          }
          return payload;
        },
        relationshipNameGetter = (index: number) => {
          let halfStr = splitString[index],
            matcher,
            payload;
          if (curlyBracketsTest(halfStr)) {
            // User{employee} => {employee => employee
            matcher = halfStr.match(regexpList.relationshipName);
            if (matcher.length == 0) {
              Logger.error(this._name, 'There goes wrong.');
              // console.error(
              //     "There goes wrong."
              // )
            } else {
              payload = matcher[0].slice(1);
            }
          } else {
            // User
            payload = null;
          }
          return payload;
        },
        referenceDisplayGetter = (index: number) => {
          let halfStr = splitString[index],
            matcher,
            payload;
          if (parenthesesTest(halfStr)) {
            // User{employee(userId)} => (userId => userId
            matcher = halfStr.match(regexpList.referenceDisplay);
            if (matcher.length == 0) {
              Logger.error(this._name, 'There goes wrong.');
              // console.error(
              //     "There goes wrong."
              // )
            } else {
              payload = matcher[0].slice(1);
            }
          } else {
            // User or User{employee}
            payload = null;
          }
          return payload;
        };

      return {
        fromEntity: entityGetter(0),
        fromRelationshipName: relationshipNameGetter(0),
        fromReferenceDisplay: referenceDisplayGetter(0),
        toEntity: entityGetter(1),
        toRelationshipName: relationshipNameGetter(1),
        toReferenceDisplay: referenceDisplayGetter(1),
      };
    };
    from(relationTypeEntities)
      .pipe(
        mergeMap((relationTypeEntity) => {
          let relationType = relationTypeEntity[0],
            relationSet = relationTypeEntity[1];
          return from(relationSet).pipe(
            map((_sourceRelationConfig) => {
              let {
                fromEntity,
                fromRelationshipName,
                fromReferenceDisplay,
                toEntity,
                toRelationshipName,
                toReferenceDisplay,
              } = regexpMatcher(_sourceRelationConfig);
              let payload: any = {
                targetEntity: toEntity,
                relationshipName: toRelationshipName,
                type: relationType,
              };
              switch (relationType) {
                case 'OneToOne':
                case 'OneToMany': {
                  payload['referencesEntity'] = toReferenceDisplay;
                  break;
                }
                case 'ManyToOne':
                case 'ManyToMany': {
                  payload['referencesField'] = toReferenceDisplay;
                  break;
                }
              }

              let renameFromEntity = `${fromEntity[0].toLowerCase()}${fromEntity.slice(
                1
              )}`;
              if (!relationshipByEntity[renameFromEntity])
                relationshipByEntity[renameFromEntity] = [];
              relationshipByEntity[renameFromEntity].push(payload);
              return payload;
            })
          );
        })
      )
      .subscribe();
    return relationshipByEntity;
  }

  /**
   * "Not Finish yet."
   * It only add new _sourceRelationConfig.
   *
   * @param entityRelation
   * Need to be ware the type.
   */
  //  addRelationToConfig(newRelations: IEntityRelationConfig) {
  //     for (const entityName in newRelations) {
  //         if (!this._relationConfig[entityName])
  //             this._relationConfig[entityName] = [];
  //         for (const _sourceRelationConfig of newRelations[entityName]) {
  //             if (this._relationConfig[entityName].find(des => des['relationshipName'] == _sourceRelationConfig['relationshipName'] && des['type'] == _sourceRelationConfig['type'])) {

  //             }
  //         }
  //     }
  //     // this.config$.next(EntityRelationConfig);
  // }
  //  count = 0
  /**
   * version 0.0.1
   * 跑過 store全部 reducer下的 entity
   * 根據關係設定檔去綁關係
   * 下個版本引進 lastSettlement
   *
   * @param store
   * @param options
   * @returns
   */
  public getStoreWithRelation_v1<initialState, Reducers>(
    store: Store<initialState, Reducers>,
    options: { config: IEntityRelationConfig }
  ): Observable<any> {
    let storeClone;
    return store.state$.pipe(
      // State build _sourceRelationConfig with options.config
      mergeMap((state) => {
        storeClone = null;
        storeClone = _.cloneDeep(store);
        let reducers = storeClone.reducers;

        return from(Object.entries(storeClone.state)).pipe(
          reduce((totalState, nextStateEntry: [string, Reducer<any, any>]) => {
            let sourceEntity = nextStateEntry[0], // e.g.: user
              sourceState: any = nextStateEntry[1]; // e.g.: {ids:[], entities:{}}
            let sourceRelationConfigs = options['config'][sourceEntity];
            // find the specific config for the sourceState
            if (!!sourceRelationConfigs) {
              // for (const _sourceRelationConfig of sourceRelationConfigs)
              // await Promise.all(
              sourceRelationConfigs.map(async (_sourceRelationConfig) => {
                let targetEntity = `${_sourceRelationConfig[
                    'targetEntity'
                  ][0].toLowerCase()}${_sourceRelationConfig[
                    'targetEntity'
                  ].slice(1)}`,
                  sourceReducer = reducers[sourceEntity],
                  targetReducer = reducers[targetEntity];

                let targetReducerRelationConfigs = options['config'][
                  targetEntity
                ].find(
                  (config) =>
                    config['targetEntity'] ==
                    `${sourceEntity[0].toUpperCase()}${sourceEntity.slice(1)}`
                );
                let regexForMany = new RegExp('ManyTo');
                let isMatchMany = regexForMany.test(
                  _sourceRelationConfig['type']
                );

                // Go through forEach entities in the reducer.
                if (!targetReducer) {
                  Logger.error(
                    this._name,
                    `The reducer(${targetEntity}) is not in store.`
                  );
                  // console.error(`[Error/Relation] The reducer(${targetEntity}) is not in store.`);
                }
                if (!targetReducerRelationConfigs) {
                  Logger.error(
                    this._name,
                    `The relationConfig of ${targetEntity} is not found.`
                  );
                  // console.error(`[Error/Relation] The relationConfig of ${targetEntity} is not found.`);
                } else {
                  let sourceStateEntries: [string, Entity][] = Object.entries(
                    sourceState['entities']
                  );
                  // await Promise.all(
                  sourceStateEntries.map((entity) => {
                    let entityId = entity[0], // e.g.: "user-1"
                      entityValue = entity[1]; // e.g.: {id:"user-1", name:"Jones"}
                    /**
                     * 如果 當前這個 Entity(我)對另一個 Entity(他)的關係是：
                     *
                     * * OneToOne
                     * 我以我的 id去他的 Reducer找符合條件的 entities（只會找到一個）
                     * 找到以後再以 setOneToMany把他加進來
                     *
                     * * OneToMany
                     * 我以我的 id去他的 Reducer找符合條件的 entities（會找到一或複數個）
                     * 找到以後再以 addManyToOne把他們加進來
                     *
                     * * ManyToOne
                     * 我以我的 id去他的 Reducer找符合條件的 entities（只會找到一個）
                     * 找到以後再以 setOneToMany把他加進來
                     */
                    let targetEntities = [];
                    // if (!!targetReducerRelationConfigs)
                    // 這邊寫錯了 selectRelevanceEntity({key:"groupId"})
                    switch (_sourceRelationConfig['type']) {
                      case 'OneToOne': {
                        targetEntities = targetReducer.selectRelevanceEntity({
                          key: `${_sourceRelationConfig['relationshipName']}Id`,
                          value: entityId,
                        });
                        // targetEntities.length !== 0 ? entityValue.setOneToOne(targetEntities, { target: targetReducerRelationConfigs, source: _sourceRelationConfig }) : null;
                        targetEntities.length !== 0
                          ? entityValue.setOneToOne(targetEntities)
                          : null;
                        break;
                      }
                      case 'OneToMany': {
                        // target是多的那邊
                        targetEntities = targetReducer.selectRelevanceEntity({
                          key: `${targetReducerRelationConfigs['referencesField']}`,
                          value: entityId,
                        });

                        targetEntities.length !== 0
                          ? entityValue.addManyToOne(targetEntities, {
                              target: targetReducerRelationConfigs,
                              source: _sourceRelationConfig,
                            })
                          : null;
                        // targetEntities.length !== 0 ? entityValue.addManyToOne(targetEntities) : null;
                        break;
                      }
                      case 'ManyToOne': {
                        // 依照
                        targetEntities = targetReducer.selectRelevanceEntity({
                          key: `${targetReducerRelationConfigs['referencesEntity']}`,
                          value:
                            entityValue[
                              targetReducerRelationConfigs['referencesEntity']
                            ],
                        });
                        // console.log(801928109, targetEntity,targetReducerRelationConfigs, `${targetReducerRelationConfigs['referencesEntity']}`, entityValue[targetReducerRelationConfigs['referencesEntity']])
                        // console.log(targetEntities, entityValue, _sourceRelationConfig, 329802380298)
                        targetEntities.length !== 0
                          ? entityValue.setOneToMany(targetEntities, {
                              target: targetReducerRelationConfigs,
                              source: _sourceRelationConfig,
                            })
                          : null;
                        // targetEntities.length !== 0 ? entityValue.setOneToMany(targetEntities) : null;
                        break;
                      }
                      case 'ManyToMany': {
                        targetEntities = targetReducer.selectRelevanceEntity({
                          key: `${_sourceRelationConfig['referencesField']}IdList`,
                          value: entityId,
                        });
                        // targetEntities.length !== 0 ? entityValue.addManyToMany(targetEntities, { target: targetReducerRelationConfigs, source: _sourceRelationConfig }) : null;
                        targetEntities.length !== 0
                          ? entityValue.addManyToMany(targetEntities)
                          : null;
                        break;
                      }
                    }
                    // sourceState['entities'][entityId] = entityValue;
                  });
                  // )
                }
              });
              // )
            }

            totalState[sourceEntity] = sourceState;
            return totalState;
          }, {})
        );
      })
      // mergeMap((statePromise: Promise<{}>) => from(statePromise)),
    );
  }
  private _reducerSettlement: settlement;
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
            return from(_sourceRelationConfigs).pipe(
              map((_sourceRelationConfig) => {
                _targetEntity = `${_sourceRelationConfig[
                  'targetEntity'
                ][0].toLowerCase()}${_sourceRelationConfig[
                  'targetEntity'
                ].slice(1)}`;
                _targetState = _stateClone[_targetEntity];
                _targetRelationConfigs = config[_targetEntity];
                _targetRelationConfig = _targetRelationConfigs.find(
                  (config) =>
                    config['targetEntity'] ==
                    `${_sourceEntity[0].toUpperCase()}${_sourceEntity.slice(1)}`
                );

                let relevanceEntities = [];
                switch (_sourceRelationConfig['type']) {
                  case 'OneToOne': {
                    relevanceEntities = selectRelevanceEntity(_targetState, {
                      key: `${_sourceRelationConfig['relationshipName']}Id`,
                      value: entityId,
                    });
                    if (relevanceEntities.length == 0) {
                      let sourceKey = _sourceRelationConfig['targetEntity'];
                      let key = `${
                        sourceKey[0].toLowerCase() + sourceKey.slice(1)
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
                      let key = `${
                        sourceKey[0].toLowerCase() + sourceKey.slice(1)
                      }`;
                      relevanceEntities = selectSourceRelevanceEntity(
                        _targetState,
                        { key: `${key}s`, value: entity }
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
                      let key = `${
                        sourceKey[0].toLowerCase() + sourceKey.slice(1)
                      }`;
                      relevanceEntities = selectSourceRelevanceEntity(
                        _targetState,
                        { key: `${key}Id`, value: entity }
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
                      let key = `${
                        sourceKey[0].toLowerCase() + sourceKey.slice(1)
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
      filter((reducerSettlement: settlement) => {
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
        this._reducerSettlement = reducerSettlement;
        if (!!reducerSettlement['lastSettlement']['isChanged']) {
          return of(reducerSettlement).pipe(
            // update _stateClone
            map((reducerSettlement) => {
              _sourceEntity = reducerSettlement['reducerName'];
              _reducer = store['reducers'][reducerSettlement['reducerName']];
              _sourceState = cloneAndReset(
                _stateClone[reducerSettlement['reducerName']]
              );
              _values = {
                create: _reducer.createEntities(
                  Object.values(reducerSettlement['lastSettlement']['create'])
                ),
                update: _reducer.createEntities(
                  Object.values(reducerSettlement['lastSettlement']['update'])
                ),
                delete: Object.values(
                  reducerSettlement['lastSettlement']['delete']
                ),
              };
              _sourceRelationConfigs = config[reducerSettlement['reducerName']];
              _values.create.length !== 0
                ? (_sourceState = addMany(_values.create, _sourceState))
                : null;
              _values.update.length !== 0
                ? (_sourceState = updateMany(_values.update, _sourceState))
                : null;
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
              _stateClone[reducerSettlement['reducerName']] = _sourceState;

              return reducerSettlement;
            }),
            // Do create first
            mergeMap((reducerSettlement) => {
              if (_values['create'].length !== 0) {
                return from(_values['create']).pipe(_commonRelationPipe());
              } else {
                return of(null);
              }
            }),
            mergeMap((reducerSettlement) => {
              if (_values['update'].length !== 0) {
                return from(_values['update']).pipe(_commonRelationPipe());
              } else {
                return of(null);
              }
            })
          );
        } else {
          return of(null);
        }
      }),
      map((res: null) => _stateClone),
      catchError((err) => {
        return of(err);
      })
    );
  }
}

export const RelationManager = Relation.getInstance();
