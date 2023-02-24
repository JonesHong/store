import { Entity } from "../entity";


/**
 * http://www.jhipster.pro/docs/jdl/relationships-cn#%E8%AF%AD%E6%B3%95
 * relationship (OneToMany | ManyToOne | OneToOne | ManyToMany) {  
 * \<from entity\>\[\{\<relationship name\>\[\(\<display field\>\)\]\}\]  
 * to  
 * \<to entity\>\[\{\<relationship name\>\[\(\<display field\>\)\]\}\]  
 * }
 * 
 * * (OneToMany | ManyToOne| OneToOne | ManyToMany) 是你的关系类型  
 * * <from entity> 是关系的实体所有者的名称：源实体  
 * * <to entity> 是关系要到达的实体的名称：目的实体  
 * * <relationship name> 是具有另一端类型的属性名称  
 * * <display field> 是应显示在选择框中的字段名称（默认值：id）  
 * * required 引入的关系属性是否不能为空  
 * * with jpaDerivedIdentifier 或 @MapsId 用于关联关系 (仅适用于一对一（one-to-one）  
 */
export interface Relationship {
    entity: string;
    /** 
     * ? What is the name of the relationship?   
     * First Level, Entity itself's key(property).  
     * relationship name == propKey
     */
    relationName?: string,
    /** 
     * ? When you display this relationship with Angular, which field from <Entity> do you want to use? id  
     * Second Level, RelatedEntity key(property) 
     * display field (default: id) == relatedEntityPropKey
     */
    displayField?: "id" | string,
}

export type RelationshipOptionMethod = "setRelationship" | "addRelationships";
export interface RelationshipOption extends Relationship {
    method: RelationshipOptionMethod
}

/**
 * @param  {RelationshipOption}inputEntityOptions
 * targetEntity
 * @param  thisEntityOptions
 * sourceEntity
 * @param  isMultiRelationNameEndWithMap
 * xxxMap
 */
export interface InputRelationshipOption {
    inputEntityOptions: RelationshipOption,
    thisEntityOptions: RelationshipOption,
    isMultiRelationNameEndWithMap?: boolean,
    // inputEntityClassName?: string,
    RelationType: RelationType;
}
export type RelationshipConfig = {
    _relationshipOptions: InputRelationshipOption[];
    _relatedEntityMap: Map<string, InputRelationshipOption[]>;
    _relatedRelationNameMap: Map<string, InputRelationshipOption>;

}
export type RelationshipConfigTable = {
    [EntityString: string]: RelationshipConfig
}


/**
 * 要用這有個前提
 * 要像 SQL一樣在 多對一時，多的那邊會記住一的 id
 * 如用 neo4j等資料庫，在資料庫可以不用這樣記
 * 但是透過 cypher拉資料回來時，把關係對象的 id寫入 return res
 * 這邊所有的 config也要與 neo4j設定一致
 *
 * ＊修正一下：應該是 neo4j cypher要參照此 config
 * 
 * 
//  "one-to-one" | "one-to-many" | "many-to-one" | "many-to-many";
 */
export interface RelationshipFromJDL {
    "OneToOne"?: Set<string>;
    "OneToMany"?: Set<string>;
    "ManyToOne"?: Set<string>;
    "ManyToMany"?: Set<string>;
}
export type RelationType = "OneToOne" | "OneToMany" | "ManyToOne" | "ManyToMany";
interface FromJDLMessageBase {
    type: string,
    dateTimeString?: string;
    description?: string;
}
interface FromJDLMessageLog extends FromJDLMessageBase {
    type: "log",
    dateTimeString?: string;
    description?: string;
}

interface FromJDLMessageError extends FromJDLMessageBase {
    type: "error",
    dateTimeString?: string;
    description?: "isNotMatchJDLFormatBasic" | "isNotSupportedWith" | "isNotSupportedRequired" | "isNotMatchJDLEntity" |
    "syntaxErrorJDLCurlyBrackets" | "syntaxErrorJDLParentheses" | "displayFieldMustBeUnique" | "others";
}

interface FromJDLMessageWarning extends FromJDLMessageBase {
    type: "warning",
    dateTimeString?: string;
    description?: "isNotMatchJDLCurlyBrackets" | "isNotMatchJDLParentheses" | "isOnlySupportedBidirectionalRelationship";
}



export type FromJDLMessage = FromJDLMessageLog | FromJDLMessageError | FromJDLMessageWarning;

export interface JDLObject {
    fromEntityString: string;
    fromRelationName: string;
    fromDisplayField: string;
    toEntityString: string;
    toRelationName: string;
    toDisplayField: string
}

export type RelationBuilderMethod = ({ thisEntity, inputEntity }: { thisEntity: Entity, inputEntity?: Entity }, options: InputRelationshipOption, counts?: number) => void;


