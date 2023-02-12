import { Entity } from "../entity";


export type RelationType = "OneToOne" | "OneToMany" | "ManyToOne" | "ManyToMany";

/**
 * In Neo4j, direction means active or passive.  
 * Arrow side is passive, Line side is active.  
 * 
 * In JHipster, it means memorizing references in other or not.  
 * 
 * But this Relation is always two way binding by references.  
 * So direction's meaning in here will be close to Neo4j.  
 * 
 * "none" is equal "both".  
 * default is none.  
 */
export type RelationDirection = "in" | "out" | "none";

/**
 * Conclusion of experience with JDL(JHipster) and Neo4j.  
 * 
 * https://www.jhipster.tech/jdl/relationships#syntax
 * JDL Syntax:  
 *  relationship (OneToMany | ManyToOne | OneToOne | ManyToMany) {  
 *   <from entity\>[{<relationship name\>[(<display field\>)]}] 
 *     to  
 *    <to entity\>[{<relationship name\>[(<display field\>)]}]+   
 * }  
 * * (OneToMany | ManyToOne| OneToOne | ManyToMany) is the type of your relationship,
 * * <from entity\> is the name of the entity owner of the relationship: the source,
 * * <to entity\> is the name of the entity where the relationship goes to: the destination,
 * * <relationship name\> is the name of the field having the other end as type,
 * * <display field\> is the name of the field that should show up in select boxes (default: id),
 * * required whether the injected field is required.
 * * with jpaDerivedIdentifier whether @MapsId is used for the association (applicable only for one-to-one)
 * * And you can have more than one relationship body
 *   * See the Multiple relationship bodies section for more info!  
 */

interface RelationDescriptionUnion {
    /**
     * What is the name of the other entity?
     */
    "relateEntity": string;
    /**
     * What is the name of the relationship?
     */
    "relationshipName": string | null;
    /**
     * What is the type of the relationship?  
     * OneToOne, OneToMany, ManyToOne, ManyToMany  
     */
    "type": RelationType;
    "direction"?: RelationDirection
}
interface RelationDescriptionForMany extends RelationDescriptionUnion {
    /**
     * Form field to use displaying.  
     * What is the name of this relationship in the other entity?  
     * When you display this relationship on client-side, which field from <relateEntity> do you want to use?   
     * This field will be displayed as a String, so it cannot be a Blob id.  
     */
    "referencesField": string;
    /**
     * What is the type of the relationship?  
     * ManyToOne, ManyToMany  
     */
    "type": "ManyToOne" | "ManyToMany";
}
interface RelationDescriptionForOne extends RelationDescriptionUnion {
    /**
     * The name of this relationship in the other entity.  
     * What is the name of this relationship in the other entity?  
     */
    "referencesEntity": string;
    /**
     * What is the type of the relationship?  
     * OneToOne, OneToMany   
     */
    "type": "OneToOne" | "OneToMany";
}

export type RelationDescription = RelationDescriptionForMany | RelationDescriptionForOne
export type IEntityRelationConfig = {
    [entityName: string]: RelationDescription[];
};
export interface RelationshipByType {
    "OneToOne"?: Set<string>;
    "OneToMany"?: Set<string>;
    "ManyToOne"?: Set<string>;
    // "ManyToOneOrOneToMany"
    "ManyToMany"?: Set<string>
}



//----------------------------------------------------------------
//----------------------------------------------------------------
//                              NEW
//----------------------------------------------------------------
//----------------------------------------------------------------



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
    inputEntityClassName?: string,
}
export type RelationshipConfig = {
    _relationshipOptions: InputRelationshipOption[];
    _relatedEntityMap: Map<string, InputRelationshipOption>;
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

export type RelationBuilderMethod = ({ thisEntity, inputEntity }: { thisEntity: Entity, inputEntity?: Entity }, options: InputRelationshipOption) => void;


