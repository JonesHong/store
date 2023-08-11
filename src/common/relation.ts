import { filter, last, map, mergeMap, reduce, toArray, } from 'rxjs/operators';
import { asapScheduler, from, pipe } from 'rxjs';
import { FromJDLMessage, InputRelationshipOption, JDLObject, RelationBreakerMethod, RelationBreakerSetting, RelationBuilderMethod, RelationshipConfigTable, RelationshipFromJDL, RelationshipOptionMethod, } from './interface/relation.interface';
import * as _ from 'lodash';
import { Entity } from './entity';
import { Logger } from './logger';
import { DateTime } from 'luxon';
import { Singleton } from './decoratios/singleton';
import { camelCase } from 'lodash';
import { Main } from './main';
import { envType } from './env_checker';
import { MapToString } from './functions/Transformer';

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

export const DefaultRelationBreakerSetting: RelationBreakerSetting = {
  "isSelfDestruction": false,
}

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
  toJDLFormat(config: any) {
    console.log('not finished!! now is empty.')
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
              payload[`${direction}RelationName`] = camelCase(payload[`${direction}RelationName`]); // roupUser
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
            RelationType: keyClone,
            // inputEntityClassName: jdlObject[`${oppositeDirection}EntityString`],
            inputEntityOptions: {
              entity: jdlObject[`${oppositeDirection}EntityString`],
              relationName: jdlObject[`${direction}RelationName`],
              displayField: jdlObject[`${direction}DisplayField`],
              method: inputEntityOptionsMethod
            },
            thisEntityOptions: {
              entity: jdlObject[`${direction}EntityString`],
              relationName: jdlObject[`${oppositeDirection}RelationName`],
              displayField: jdlObject[`${oppositeDirection}DisplayField`],
              method: thisEntityOptionsMethod
            }
          };
          // _relatedEntityMap.set(jdlObject[`${oppositeDirection}EntityString`], tempRelationshipOption);

          // _relatedEntityMap: 一種 Entity可能會有複數的關係
          // User 跟 User，可以是父母、兄弟、夫妻
          // _relatedRelationNameMap: 一種關係只應該有一種 Entity
          // 夫妻關係只會是 User 跟 User，不會是 User 跟 Group
          if (accumulator[jdlObject[`${direction}EntityString`]]._relatedRelationNameMap.has(jdlObject[`${direction}RelationName`])) {
            setMessageMap(jdlObject[`${direction}RelationName`], { type: "error", description: "displayFieldMustBeUnique" });
          }
          else {
            _relationshipOptions.push(tempRelationshipOption);
            let relationOptionsList: InputRelationshipOption[] = _relatedEntityMap.has(jdlObject[`${oppositeDirection}EntityString`]) ? _relatedEntityMap.get(jdlObject[`${oppositeDirection}EntityString`]) : [];
            relationOptionsList.push(tempRelationshipOption)
            _relatedEntityMap.set(jdlObject[`${oppositeDirection}EntityString`], relationOptionsList);
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
          // toArray()
        )
      }),
      // toArray()
      last()
    )
      .subscribe((val) => {
        let _logger = Logger.log(
          'Relation.fromJDL',
          MapToString(_MessageMap),
          { isPrint: Main.printMode == "detail" }
        );
        if (envType == 'browser' && _logger['options']['isPrint'])
          console.log(_logger['_str']);
        this.RelationshipConfigTable = val;
      }
        //   {
        //   next(value) {

        //     let _logger = Logger.log(
        //       'Relation.fromJDL',
        //       MapToString(_MessageMap),
        //       { isPrint: Main.printMode == "detail" }
        //     );
        //     if (envType == 'browser' && _logger['options']['isPrint'])
        //       console.log(_logger['_str']);
        //     this.RelationshipConfigTable = value;

        //   },
        //   error(err) {

        //   },
        //   complete() {
        //   },
        // }
      )
  }



  public switchRelationshipOptions = (options: InputRelationshipOption): InputRelationshipOption => {
    // let inputEntityName = inputEntity['_name'].replace(/Entity/, '');
    return {
      ...options,
      // inputEntityClassName: options.thisEntityOptions.entity,
      inputEntityOptions: options.thisEntityOptions,
      thisEntityOptions: options.inputEntityOptions,
    }
  }
  public buildRelationship: RelationBuilderMethod = ({ thisEntity, inputEntity }, options) => {
    let { method } = options.inputEntityOptions;
    thisEntity[method](inputEntity, this.switchRelationshipOptions(options));
    return thisEntity;
  }
  public setRelationship: RelationBuilderMethod = ({ thisEntity, inputEntity }, options, count = 0) => {
    let {
      relationName = `_${camelCase(inputEntity._name)}`,
    } = options.thisEntityOptions;
    let {
      // relationName = `_${camelCase(inputEntity._name)}`,
      displayField = "id",
      method
    } = options.inputEntityOptions;
    if (count > 1) return thisEntity; // ManyToMany do switch more than one.
    if (relationName[0] !== "_") relationName = '_' + relationName;
    // console.log(`${thisEntity._name}.setRelationship:\n`, options, '\n', thisEntity);
    if (!!thisEntity[relationName]) return
    // thisEntity;
    thisEntity[relationName] = inputEntity;
    // options['inputEntityClassName'] = inputEntity._name;
    thisEntity.setRelationshipKeyMap(relationName, options);
    // inputEntity.setRelationshipKeyMap(relationName, options); // 待測試

    count++;
    inputEntity[method](
      thisEntity,
      this.switchRelationshipOptions(options)
    )
  }
  public addRelationships: RelationBuilderMethod = ({ thisEntity, inputEntity }, options, count = 0) => {
    let { isMultiRelationNameEndWithMap = false } = options;
    let {
      relationName = `_${camelCase(inputEntity._name)}`,
    } = options.thisEntityOptions;
    let {
      displayField = "id",
      method
    } = options.inputEntityOptions;

    if (options.RelationType === "ManyToMany") displayField = "id";
    if (relationName[0] !== "_") relationName = '_' + relationName;
    if (isMultiRelationNameEndWithMap) {
      relationName = relationName.slice(-3) === "Map" ? relationName : `${relationName}Map`;
      options['inputEntityOptions']['relationName'] = relationName;
    }
    if (count > 1) return thisEntity;; // ManyToMany do switch more than one.
    // console.log(`${thisEntity._name}.addRelationships:\n`, options, '\n', thisEntity);
    if (!!!thisEntity[relationName]) thisEntity[relationName] = {};
    if (!!thisEntity[relationName][inputEntity[displayField]]) return;// thisEntity;
    thisEntity[relationName][inputEntity[displayField]] = inputEntity;
    // options['inputEntityClassName'] = inputEntity._name;
    thisEntity.setRelationshipKeyMap(relationName, options);
    // inputEntity.setRelationshipKeyMap(relationName, options); // 待測試

    count++;
    inputEntity[method](
      thisEntity,
      this.switchRelationshipOptions(options)
    )
  }
  public breakInputEntityRelationships: RelationBreakerMethod = ({ thisEntity, inputEntity }, options) => {
    // let { inputEntityOptions, thisEntityOptions } = options;
    // console.log(`${this._name}.breakInputEntityRelationships:\n `, this._relationshipKeyMap)
    let { relationName } = options.inputEntityOptions;
    let { displayField = "id" } = options.thisEntityOptions;

    let relatedKey = inputEntity[displayField];

    relationName = `_${relationName}`;

    if (!!!thisEntity[relationName]) return thisEntity;
    switch (options['RelationType']) {
      case "ManyToMany":
        relationName = `_${options.thisEntityOptions['relationName']}`;
        thisEntity[relationName] = null;
        delete thisEntity[relationName];
        break;
      case "OneToOne":
      case "ManyToOne":
        // 自己和對象的關係是一的時候
        thisEntity[relationName] = null;
        delete thisEntity[relationName];
        break;
      case "OneToMany":
        // 自己和對象的關係是多的時候
        thisEntity[relationName][relatedKey] = null;
        delete thisEntity[relationName][relatedKey];
        break;

      default:
        break;
    }

    // if (!!thisEntity[relationName][displayField]) {
    //   // 自己和對象的關係是一的時候
    //   thisEntity[relationName] = null;
    //   delete thisEntity[relationName];
    //   // console.warn(3333, thisEntity._name, thisEntity)
    // }
    // else if (!!thisEntity[relationName][relatedKey]) {
    //   // 自己和對象的關係是多的時候
    //   thisEntity[relationName][relatedKey] = null;
    //   delete thisEntity[relationName][relatedKey];

    //   // console.warn(4444, thisEntity._name, thisEntity, thisEntity[relationName])
    // }
    // else {
    //   console.error("不可能!!，一定是哪裡出錯了")
    // }

    if (!!!thisEntity[relationName] || Object.keys(thisEntity[relationName]).length == 0) {
      // asapScheduler.schedule(() => {
      thisEntity[relationName] = null;
      delete thisEntity[relationName];
      thisEntity.deleteRelationshipKeyMap(relationName);
      // }, 50)
    }
    return thisEntity;
  }

  public breakEntityRelationshipByOptions: RelationBreakerMethod = ({ thisEntity }, options) => {
    // console.log(`${this._name}.breakThisEntityRelationshipByOpccccccctions:\n `, thisEntity.relationshipKeyMap)

    // let { relationName } = options.inputEntityOptions;
    let { relationName, displayField = "id", method } = options.thisEntityOptions;

    relationName = `_${relationName}`;
    let relatedEntity!: Entity;
    // console.warn("breakEntityRelationshipByOptions", thisEntity._name, relationName, thisEntity[relationName])
    if (!!!thisEntity[relationName]) return thisEntity;
    // 1. 先斷開自己在對方那邊紀錄的關係，所以拿 relatedEntityOptions.thisEntityOptions.method檢查
    switch (method) {
      case "setRelationship": {
        // 此 Entity與對方的關係為"一對一(1:1)"或是"多對一(*:1)"
        relatedEntity = thisEntity[relationName];
        // asapScheduler.schedule(() => {
        relatedEntity = relatedEntity.breakInputEntityRelationships(thisEntity, options);
        // }, 10)
        // thisEntity[relationName] = this.breakInputEntityRelationships({ thisEntity: thisEntity[relationName], inputEntity: thisEntity }, options);
        // console.warn(1111, thisEntity._name, thisEntity)
      }
        break;
      case "addRelationships": {
        // 此 Entity與對方的關係為"一對多(1:*)"或是"多對多(*:*)"
        Object.values(thisEntity[relationName]).forEach((entity: Entity) => {
          relatedEntity = entity;
          // asapScheduler.schedule(() => {
          relatedEntity = relatedEntity.breakInputEntityRelationships(thisEntity, options);
          // }, 10)
          // thisEntity[relationName][id] = this.breakInputEntityRelationships({ thisEntity: thisEntity[relationName], inputEntity: thisEntity }, options);
        });
        // console.warn(2222, thisEntity._name, thisEntity)
      }
        break;
    }
    // 2. 接著把自己這邊跟對方有關的刪掉
    // asapScheduler.schedule(() => {
    thisEntity[relationName] = null;
    delete thisEntity[relationName];
    thisEntity.deleteRelationshipKeyMap(relationName);
    // }, 50)
    return thisEntity;
  }
  public breakAllEntityRelationships = (thisEntity: Entity) => {
    // console.log(`${this._name}.breakAllEntityRelationships:\n `, thisEntity.relationshipKeyMap)
    // console.log( this._relationshipKeyMap.entries())
    let relationshipValues = thisEntity.relationshipKeyMap.values();
    Array.from(relationshipValues).forEach((options) => thisEntity.breakEntityRelationshipByOptions(options));
    // Array.from(relationshipValues).map((options) => this.breakEntityRelationshipByOptions({ thisEntity }, options));
    // return thisEntity;
  }

}

export const Relation = _Relation.getInstance();


