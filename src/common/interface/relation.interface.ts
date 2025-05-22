// src/common/interface/relation.interface.ts
// 此檔案定義了與實體關聯 (Relationship) 相關的 TypeScript 介面和類型。
// 這些定義主要用於解析 JDL (JHipster Domain Language) 或類似的領域定義語言，
// 並將其轉換為應用程式內部可以使用的結構化關聯配置。

import { Entity } from "../entity"; // 引入實體基類，用於某些方法簽名

// #region JDL 關聯語法參考與基礎介面

/**
 * JDL (JHipster Domain Language) 中定義關聯的基本語法結構。
 * (此註解參考自：http://www.jhipster.pro/docs/jdl/relationships-cn#%E8%AF%AD%E6%B3%95)
 *
 * 語法範例：
 * ```jdl
 * relationship (OneToMany | ManyToOne | OneToOne | ManyToMany) {
 *   <from entity>[{<relationship name>[(<display field>)]}]
 *   to
 *   <to entity>[{<relationship name>[(<display field>)]}]
 * }
 * ```
 * - `(OneToMany | ManyToOne| OneToOne | ManyToMany)`: 關聯類型。
 * - `<from entity>`: 源實體的名稱。
 * - `<to entity>`: 目標實體的名稱。
 * - `<relationship name>`: 在實體中代表此關聯的屬性名稱。
 * - `<display field>`: 在 UI (例如下拉選擇框) 中顯示關聯實體時，應使用的目標實體欄位 (預設為 `id`)。
 * - `required`: 標識關聯屬性是否為必需。
 * - `with jpaDerivedIdentifier` 或 `@MapsId`: 用於 JPA 中的衍生識別碼 (通常僅適用於一對一關聯)。
 */

/**
 * 描述一個實體關聯中的一方。
 */
export interface Relationship {
    /** 
     * 實體的名稱 (例如 "User", "Group")。
     * 在 JDL 中，這對應 `<from entity>` 或 `<to entity>`。
     */
    entity: string;

    /** 
     * 在此實體中，代表與對方實體關聯的屬性名稱。
     * 例如，如果 `User` 有多個 `Post`，此屬性在 `User` 實體上可能被命名為 `posts`。
     * 在 JDL 中，這對應 `<relationship name>`。
     * 英文註解提示：`relationship name == propKey`。
     */
    relationName?: string;

    /** 
     * 當顯示此關聯時，應使用對方實體的哪個欄位來表示 (例如在下拉選單中)。
     * 預設為 `id`。
     * 在 JDL 中，這對應 `<display field>`。
     * 英文註解提示：`display field (default: id) == relatedEntityPropKey`。
     */
    displayField?: "id" | string;
}

/**
 * 定義了在實體上建立關聯時可以調用的方法名稱。
 * - `setRelationship`: 通常用於對一的關聯 (OneToOne, ManyToOne)，直接設定關聯屬性。
 * - `addRelationships`: 通常用於對多的關聯 (OneToMany, ManyToMany)，將關聯實體添加到集合中。
 */
export type RelationshipOptionMethod = "setRelationship" | "addRelationships";

/**
 * 擴展 `Relationship`，增加了在實體上操作此關聯時應使用的方法。
 */
export interface RelationshipOption extends Relationship {
    /** 指定在實體對象上建立此關聯時應調用的方法。 */
    method: RelationshipOptionMethod;
}

// #endregion JDL 關聯基礎介面

// #region 關聯配置核心介面

/**
 * 描述一個完整的輸入關聯配置，包含了關聯的雙方資訊和關聯類型。
 * 這是構建 `RelationshipConfigTable` 的核心單元。
 */
export interface InputRelationshipOption {
    /** 
     * 關聯的 "輸入方" (或 "目標方") 的配置。
     * 在 `A to B` 的關係中，如果當前是從 A 的視角配置，則 B 是 inputEntity。
     */
    inputEntityOptions: RelationshipOption;

    /** 
     * 關聯的 "本方" (或 "源方") 的配置。
     * 在 `A to B` 的關係中，如果當前是從 A 的視角配置，則 A 是 thisEntity。
     */
    thisEntityOptions: RelationshipOption;

    /** 
     * 標識對於 "對多" 關聯，在本方實體上的關聯屬性名稱是否應以 "Map" 結尾
     * (例如 `userMap` 而不是 `users`)，並且其值是否為一個以 ID 為鍵的 Map 物件。
     * 預設行為可能依賴於此設定或屬性名稱的約定。
     */
    isMultiRelationNameEndWithMap?: boolean;

    // inputEntityClassName?: string; // 舊的可選屬性，用途不明確，可能已廢棄。

    /** 
     * 關聯的類型 (例如 "OneToMany", "ManyToMany")。
     */
    RelationType: RelationType;
}

/**
 * 單個實體的完整關聯配置。
 * 包含此實體所有的關聯選項，並以不同方式組織以便快速查找。
 */
export type RelationshipConfig = {
    /** 
     * 此實體所有關聯的 `InputRelationshipOption` 列表。
     * 這是最原始的配置列表。
     */
    _relationshipOptions: InputRelationshipOption[];

    /**
     * 按相關實體名稱分組的關聯配置。
     * 鍵為相關實體的名稱 (例如 "Group")，值為與該實體相關的所有 `InputRelationshipOption` 陣列。
     * 用於快速查找某實體與特定類型其他實體的所有關聯。
     * @example _relatedEntityMap.get("Group") // 返回所有與 Group 實體的關聯配置
     */
    _relatedEntityMap: Map<string, InputRelationshipOption[]>;

    /**
     * 按本方實體上的關聯屬性名稱索引的關聯配置。
     * 鍵為本方實體上代表關聯的屬性名 (例如 `posts` 或 `group`)，值為對應的 `InputRelationshipOption`。
     * 用於通過屬性名快速查找其關聯配置。
     * @example _relatedRelationNameMap.get("posts") // 返回 "posts" 屬性的關聯配置
     */
    _relatedRelationNameMap: Map<string, InputRelationshipOption>;
}

/**
 * 整個應用程式的關聯配置表。
 * 鍵為實體名稱 (通常是 PascalCase，例如 "UserEntity")，值為該實體的 `RelationshipConfig`。
 * 此表由 JDL 解析產生，並在 `createRelationSelector` 等地方使用，以了解如何在實體間填充關聯數據。
 */
export type RelationshipConfigTable = {
    [EntityString: string]: RelationshipConfig;
}

// #endregion 關聯配置核心介面

// #region JDL 解析相關類型

/**
 * @deprecated 此介面可能代表了從 JDL 解析出的中間原始數據結構，
 *             在轉換為 `RelationshipConfigTable` 之前。
 *             其註解提到了 SQL 和 Neo4j 的數據同步前提，暗示了其設計可能考慮了特定的後端實現。
 *             對於純前端的狀態管理，其直接用途可能有限，主要服務於 `Relation.ts` 的解析邏輯。
 * 從 JDL 字串中直接提取的關聯定義集合。
 * 每種關聯類型對應一個包含原始 JDL 關聯定義字串的 Set。
 */
export interface RelationshipFromJDL {
    "OneToOne"?: Set<string>;
    "OneToMany"?: Set<string>;
    "ManyToOne"?: Set<string>;
    "ManyToMany"?: Set<string>;
}

/**
 * 定義了支援的 JDL 關聯類型。
 */
export type RelationType = "OneToOne" | "OneToMany" | "ManyToOne" | "ManyToMany";

/**
 * JDL 解析過程中產生的訊息的基礎介面。
 */
interface FromJDLMessageBase {
    /** 訊息類型 (例如 "log", "error", "warning")。 */
    type: string;
    /** 訊息產生的時間戳字串。 */
    dateTimeString?: string;
    /** 訊息的描述內容。 */
    description?: string;
}

/** JDL 解析過程中的日誌訊息。 */
interface FromJDLMessageLog extends FromJDLMessageBase {
    type: "log";
    // description?: string; // 描述可以是任意日誌內容
}

/** 
 * JDL 解析過程中的錯誤訊息。
 * `description` 欄位列舉了可能的錯誤類型代碼。
 */
interface FromJDLMessageError extends FromJDLMessageBase {
    type: "error";
    description?: "isNotMatchJDLFormatBasic"       // JDL 基本格式不匹配
                 | "isNotSupportedWith"            // 不支援的 "with" 子句
                 | "isNotSupportedRequired"        // 不支援的 "required" 關鍵字用法
                 | "isNotMatchJDLEntity"           // JDL 中實體名稱不匹配
                 | "syntaxErrorJDLCurlyBrackets"   // JDL 中花括號語法錯誤
                 | "syntaxErrorJDLParentheses"     // JDL 中括號語法錯誤
                 | "displayFieldMustBeUnique"      // displayField 必須唯一 (可能在特定上下文中)
                 | "others";                       // 其他未分類錯誤
}

/** 
 * JDL 解析過程中的警告訊息。
 * `description` 欄位列舉了可能的警告類型代碼。
 */
interface FromJDLMessageWarning extends FromJDLMessageBase {
    type: "warning";
    description?: "isNotMatchJDLCurlyBrackets"          // JDL 中花括號語法可能不標準
                 | "isNotMatchJDLParentheses"        // JDL 中括號語法可能不標準
                 | "isOnlySupportedBidirectionalRelationship"; // 系統可能僅支援雙向關聯的完整定義
}

/**
 * 代表 JDL 解析過程中可能產生的任何類型的訊息 (日誌、錯誤或警告)。
 */
export type FromJDLMessage = FromJDLMessageLog | FromJDLMessageError | FromJDLMessageWarning;

/**
 * @deprecated 此介面似乎代表了從單個 JDL 關聯語句解析出的結構化物件，
 *             用於 `RelationshipConfigTable` 生成過程中的中間步驟。
 *             對於直接使用 `RelationshipConfigTable` 的消費者而言，此類型可能不是必需的。
 * 從 JDL 關聯定義字串解析出的物件表示。
 */
export interface JDLObject {
    /** 源實體的名稱。 */
    fromEntityString: string;
    /** 源實體中代表關聯的屬性名。 */
    fromRelationName: string;
    /** 源實體中用於在 UI 中顯示此關聯的欄位 (通常是對方實體的欄位)。 */
    fromDisplayField: string;
    /** 目標實體的名稱。 */
    toEntityString: string;
    /** 目標實體中代表反向關聯的屬性名 (如果定義了)。 */
    toRelationName: string;
    /** 目標實體中用於在 UI 中顯示此關聯的欄位。 */
    toDisplayField: string;
}

// #endregion JDL 解析相關類型

// #region 關聯操作方法類型 (可能用於 Entity 類別的內部實現)

/**
 * @deprecated 此類型定義了一個用於建立實體間關聯的函式簽名。
 *             它似乎與 `Entity.ts` 中的命令式關聯方法 (如 `buildRelationship`) 相關，
 *             在基於 Reducer 和 Selector 的響應式狀態管理模型中，其直接使用場景可能有限。
 *             關聯的建立更多是通過 Reducer 更新狀態，並由 Selector 計算衍生數據來實現。
 * 用於建立實體間關聯的函式簽名。
 * @param thisEntity 當前實體 (關聯的源頭)。
 * @param inputEntity 要關聯的目標實體 (可選，某些斷開操作可能不需要)。
 * @param options 描述此次關聯的配置。
 * @param counts (可選) 內部計數器，可能用於防止無限遞迴等。
 */
export type RelationBuilderMethod = ({ thisEntity, inputEntity }: { thisEntity: Entity, inputEntity?: Entity }, options: InputRelationshipOption, counts?: number) => void;

/**
 * @deprecated 與 `RelationBuilderMethod` 類似，此類型定義了斷開實體關聯的函式簽名。
 *             在響應式模型中，關聯的斷開也應通過 Reducer 更新狀態來實現。
 * 用於斷開實體間關聯的函式簽名。
 * @param thisEntity 當前實體。
 * @param inputEntity 要斷開關聯的目標實體 (可選)。
 * @param options 描述要斷開的關聯的配置。
 * @param setting 可選的斷開行為設定。
 * @returns 操作後的 `thisEntity` (可能已修改)。
 */
export type RelationBreakerMethod = ({ thisEntity, inputEntity }: { thisEntity: Entity, inputEntity?: Entity }, options: InputRelationshipOption, setting?: RelationBreakerSetting) => Entity;

/**
 * 定義斷開關聯時的行為設定。
 */
export interface RelationBreakerSetting {
    /** 
     * 是否在斷開關聯的同時“銷毀”實體自身 (例如，清空其所有數據屬性)。
     * 預設行為取決於 `DefaultRelationBreakerSetting` (如果存在)。
     */
    isSelfDestruction: boolean;
}

// #endregion 關聯操作方法類型