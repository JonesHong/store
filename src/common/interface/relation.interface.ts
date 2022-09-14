

export type RelationType = "OneToOne" | "OneToMany" | "ManyToOne" | "ManyToMany";
// | "one-to-one" | "one-to-many" | "many-to-one" | "many-to-many";
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
    "ManyToMany"?: Set<string>
}