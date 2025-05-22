// src/common/entity.ts
// 此檔案定義了應用程式中所有實體 (Entity) 的抽象基類。
// Entity 代表了應用程式中的一個獨立的數據單元，例如使用者 (User)、產品 (Product) 等。
// 它封裝了實體的數據屬性、關聯管理以及一些通用方法。

import { InputRelationshipOption } from './interface/relation.interface';
import { Logger } from './logger';
// 假設 Reducer 類型從 './reducer' 導入，但由於 reducer.ts 已重構為函式型，
// 此處的 OldReducer 類型可能指向舊的或不相容的定義。
// 在 Entity 類中直接依賴具體的 Reducer 實例可能不是最佳實踐，
// 應考慮將需要 Store 互動的邏輯移至 Effect 或服務中。
import { Reducer as OldReducer } from './reducer'; 
import { Relation } from "./relation"; // 假設 Relation 類別存在並提供關聯操作的靜態方法
import { v4Generator } from './functions/Generator'; // 用於生成預設 ID
// 移除未使用的 import: envType, customAlphabet, _ (lodash)

/**
 * 實體的抽象基類。
 * 所有具體的實體類別 (例如 `UserEntity`, `ProductEntity`) 都應繼承自此類別。
 *
 * @remarks
 * **關於關聯管理**：
 * 此類別中的關聯方法 (`buildRelationship`, `setRelationship` 等) 依賴於一個外部的 `Relation` 模組。
 * 這些方法主要用於在實體實例之間命令式地建立或斷開關聯連結，並記錄這些關聯的配置。
 * 在採用 Redux/NgRx 模式（特別是使用 `createRelationSelector`）後，Store 中狀態的關聯通常是唯讀計算的，
 * 而不是通過直接修改實體實例的這些方法來建立。
 * 因此，這些命令式關聯方法的主要使用場景可能變為：
 * 1. 在非 Store 管理的實體實例之間手動建立關聯 (例如，臨時計算或特定業務邏輯)。
 * 2. 在測試中方便地構建具有特定關聯的實體對象圖。
 * 3. 如果 `Relation.ts` 及其 `RelationshipConfigTable` 被用於驅動這些命令式操作，
 *    那麼它們仍然可以作為一種底層機制存在，但 Store 層面的關聯填充將由 Selector 負責。
 */
export abstract class Entity {
  /** 
   * 實體的唯一識別碼。
   * 通常在構造時由 `v4Generator()` 自動產生 (如果未提供)。
   */
  public id?: string;

  /** 
   * 抽象屬性，代表實體的類型名稱 (例如 "User", "Product")。
   * 具體實體類別必須實現此屬性。
   * @readonly 通常實體類型在實例化後不應改變。
   */
  abstract readonly _name: string;

  /** 
   * 存儲此實體所有數據屬性 (非關聯屬性) 的鍵名集合。
   * 由 `upsertData` 方法在設定屬性時自動維護。
   * @private
   */
  private _dataKeySet: Set<string> = new Set();

  /**
   * 存儲此實體已建立的關聯及其配置。
   * - 鍵 (string): 在此實體上代表關聯的屬性名稱 (例如 `_room` 或 `_memberMap`)。
   * - 值 (`InputRelationshipOption`): 建立此關聯時使用的完整配置。
   * @private
   * @see InputRelationshipOption
   */
  private _relationshipKeyMap: Map<string, InputRelationshipOption> = new Map();

  /**
   * 獲取此實體所有數據屬性的鍵名集合。
   * @returns 一個包含所有數據屬性鍵名的唯讀 Set。
   */
  public get dataKeySet(): ReadonlySet<string> {
    return this._dataKeySet;
  }

  /**
   * 獲取此實體所有已建立關聯的配置。
   * @returns 一個唯讀 Map，鍵為關聯屬性名，值為關聯配置。
   */
  public get relationshipKeyMap(): ReadonlyMap<string, InputRelationshipOption> {
    return this._relationshipKeyMap;
  }

  /**
   * (供內部或 `Relation` 模組使用) 設定或更新一個關聯的配置到 `_relationshipKeyMap`。
   * @param relationName 在此實體上代表關聯的屬性名稱。
   * @param options 該關聯的 `InputRelationshipOption` 配置。
   */
  public setRelationshipKeyMap(relationName: string, options: InputRelationshipOption): void {
    this._relationshipKeyMap.set(relationName, options);
  }

  /**
   * (供內部或 `Relation` 模組使用) 從 `_relationshipKeyMap` 中刪除一個關聯的配置。
   * @param relationName 要刪除的關聯屬性名稱。
   */
  public deleteRelationshipKeyMap(relationName: string): void {
    this._relationshipKeyMap.delete(relationName);
  }

  /**
   * 構造一個新的實體實例。
   * @param properties 一個物件，包含要設置到實體上的初始屬性值。
   *                   如果 `properties` 中不包含 `id`，則會自動生成一個。
   */
  constructor(properties: Record<string, any>) {
    this.upsertData(properties); // 初始化時即設定數據
  }

  // #region 關聯操作方法 (依賴外部 Relation 模組)
  // 這些方法主要用於命令式地操作實體間的關聯。
  // 注意：在 Redux/Selector 模式下，Store 狀態的關聯通常由 Selector 計算，而非直接調用這些方法修改。

  /**
   * 建立此實體與另一個實體之間的關聯 (通常是雙向的，具體取決於 `Relation.buildRelationship` 的實現)。
   * 此方法委託給 `Relation.buildRelationship` 實現。
   * 
   * @param entity 要與之建立關聯的目標實體。
   * @param options 描述此關聯的配置，遵循 `InputRelationshipOption` 介面。
   * @example
   * // 假設 member 和 room 實例已創建
   * // const memberToRoomRelationOptions: InputRelationshipOption = {
   * //   inputEntityOptions: { entity: "Room", relationName: "_room", method: "setRelationship", displayField: "id" },
   * //   thisEntityOptions: { entity: "Member", relationName: "_members", method: "addRelationships", displayField: "id" },
   * //   RelationType: "ManyToOne" // 表示一個 Member 屬於一個 Room，一個 Room 可以有多個 Member
   * // };
   * // member.buildRelationship(room, memberToRoomRelationOptions);
   */
  buildRelationship(entity: Entity, options: InputRelationshipOption): void {
    Relation.buildRelationship({ thisEntity: this, inputEntity: entity }, options);
  }

  /**
   * 設定一個 "對一" (OneToOne, ManyToOne) 的關聯。
   * 此方法通常由 `Relation.buildRelationship` 或直接由 `Relation.setRelationship` 協調調用。
   * 它會將目標實體直接賦值給本實體上由 `options.thisEntityOptions.relationName` 指定的屬性，
   * 並記錄此關聯到 `_relationshipKeyMap`。
   * 
   * @param entity 要關聯的目標實體。
   * @param options 描述此關聯的配置。
   * @remarks 此方法應確保 `options.thisEntityOptions.method` 為 `"setRelationship"`。
   *          實際的屬性賦值和 `_relationshipKeyMap` 更新由 `Relation.setRelationship` 封裝。
   */
  setRelationship(entity: Entity, options: InputRelationshipOption): void {
    Relation.setRelationship({ thisEntity: this, inputEntity: entity }, options);
  }

  /**
   * 添加一個 "對多" (OneToMany, ManyToMany) 的關聯。
   * 此方法通常由 `Relation.buildRelationship` 或直接由 `Relation.addRelationships` 協調調用。
   * 它會將目標實體添加到本實體上由 `options.thisEntityOptions.relationName` 指定的集合屬性中
   * (通常是一個以目標實體 ID 為鍵的 Map)，並記錄此關聯到 `_relationshipKeyMap`。
   * 
   * @param entity 要添加到關聯集合的目標實體。
   * @param options 描述此關聯的配置。
   * @remarks 此方法應確保 `options.thisEntityOptions.method` 為 `"addRelationships"`。
   *          實際的屬性賦值和 `_relationshipKeyMap` 更新由 `Relation.addRelationships` 封裝。
   */
  addRelationships(entity: Entity, options: InputRelationshipOption): void {
    Relation.addRelationships({ thisEntity: this, inputEntity: entity }, options);
  }

  /**
   * 斷開與特定目標實體之間由特定配置定義的關聯 (可能是雙向的，取決於 `Relation` 模組實現)。
   * 此方法委託給 `Relation.breakInputEntityRelationships` 實現。
   * 
   * @param entity 要斷開關聯的目標實體。
   * @param options 描述要斷開的關聯的配置。
   * @returns 可能返回操作後的實體或 void，取決於 `Relation` 模組的實現。
   */
  breakInputEntityRelationships(entity: Entity, options: InputRelationshipOption): Entity | void {
    return Relation.breakInputEntityRelationships({ thisEntity: this, inputEntity: entity }, options);
  }

  /**
   * 根據提供的關聯配置，斷開本實體上對應的單向關聯。
   * 此方法委託給 `Relation.breakEntityRelationshipByOptions` 實現。
   * 
   * @param options 描述要斷開的關聯的配置。
   * @returns 可能返回操作後的實體或 void。
   */
  breakEntityRelationshipByOptions(options: InputRelationshipOption): Entity | void {
    return Relation.breakEntityRelationshipByOptions({ thisEntity: this }, options);
  }

  /**
   * 斷開此實體所有已建立的關聯 (通常是雙向的，取決於 `Relation` 模組實現)。
   * 會遍歷 `_relationshipKeyMap` 並逐個斷開。
   * 此方法委託給 `Relation.breakAllEntityRelationships` 實現。
   */
  breakAllEntityRelationships(): void {
    Relation.breakAllEntityRelationships(this);
  }

  /**
   * "銷毀" 此實體實例。
   * 首先會斷開所有關聯。如果 `isTerminated` 為 `true` (預設)，
   * 則進一步將實例的所有數據屬性和記錄的關聯屬性名對應的屬性設為 `null` 並從實例中 `delete`。
   * 
   * @param isTerminated 是否徹底清除實例的屬性，預設為 `true`。
   *                     如果為 `false`，則僅斷開關聯，實體數據屬性保留。
   */
  killItSelf(isTerminated: boolean = true): void {
    this.breakAllEntityRelationships(); // 確保先斷開所有外部引用

    if (isTerminated) {
      // 清除數據屬性
      this._dataKeySet.forEach((key) => {
        try {
          (this as any)[key] = null; // 嘗試設為 null
          delete (this as any)[key];  // 從實例中移除屬性
        } catch (e) {
          Logger.warn(`Entity.killItSelf`, `Failed to nullify or delete data property: ${key} on entity ${this._name} (${this.id})`, {payload: e});
        }
      });
      this._dataKeySet.clear(); // 清空鍵集合

      // 清除關聯屬性（基於 _relationshipKeyMap 中記錄的屬性名）
      this._relationshipKeyMap.forEach((_options, key) => {
         try {
            (this as any)[key] = null;
            delete (this as any)[key];
        } catch (e) {
          Logger.warn(`Entity.killItSelf`, `Failed to nullify or delete relationship property: ${key} on entity ${this._name} (${this.id})`, {payload: e});
        }
      });
      this._relationshipKeyMap.clear(); // 清空映射
    }
  }
  // #endregion 關聯操作方法

  // #region 舊 Reducer 關聯 (應考慮移除或重構)
  /**
   * @deprecated 此屬性用於關聯舊的 `Reducer` 類別實例。
   *             在基於函式的 `createReducer` 和響應式 Store/Selector 模型下，實體通常不應直接持有 Reducer 的引用。
   *             如果實體需要觸發狀態變更或訪問 Store，應通過 Action 分發和 Selector 訂閱等機制間接實現。
   */
  private _reducer!: OldReducer<any, any>; // 使用了舊的 Reducer 類型

  /**
   * @deprecated 獲取與此實體關聯的舊 `Reducer` 實例。請參閱 `_reducer` 屬性的棄用說明。
   */
  public get reducer(): OldReducer<any, any> {
    Logger.warn(`Entity.reducer getter`, `Accessing deprecated _reducer property on entity ${this._name} (${this.id}). This direct coupling is discouraged.`, {isPrint: true});
    return this._reducer;
  }

  /**
   * @deprecated 設定與此實體關聯的舊 `Reducer` 實例。只允許設定一次。請參閱 `_reducer` 屬性的棄用說明。
   */
  setReducer(reducer: OldReducer<any, any>): void {
    if (!!this._reducer) { 
      Logger.warn(`Entity.setReducer`, `Reducer has already been set for entity ${this._name} (${this.id}). Ignoring new Reducer.`, { currentReducer: this._reducer, newReducer: reducer, isPrint: true });
      return;
    }
    Logger.warn(`Entity.setReducer`, `Setting deprecated _reducer property on entity ${this._name} (${this.id}). This direct coupling is discouraged.`, {isPrint: true});
    this._reducer = reducer;
  }
  // #endregion 舊 Reducer 關聯

  /**
   * 更新或插入數據到此實體實例。
   * 遍歷傳入 `data` 物件的屬性，並將它們設置到實體實例上。
   * 同時，會將這些屬性的鍵名記錄到 `_dataKeySet` 中。
   * 如果實例的 `id` 尚未設定，且 `data` 中也不包含 `id`，則會自動生成一個 `id`。
   *
   * @param data 一個包含要更新或插入的屬性及其值的物件。
   * @returns 更新後的實體實例 (`this`)，方便鏈式操作。
   *
   * @example
   * // class User extends Entity { readonly _name = "User"; }
   * // const user = new User({});
   * // user.upsertData({ name: 'John Doe', age: 30 });
   * // console.log(user.name); // "John Doe"
   * // console.log(user.id); // (自動生成的 ID)
   * // console.log(Array.from(user.dataKeySet)); // ['name', 'age', 'id'] (順序可能不同)
   */
  upsertData(data: Record<string, any>): this {
    Object.entries(data).forEach(([key, value]) => {
      // 避免將 undefined 的值賦給屬性，除非鍵是 'id' 且實體 id 也未定義 (由後續邏輯處理)
      if (value !== undefined || key === 'id') {
        (this as any)[key] = value;
      }
      this._dataKeySet.add(key);
    });
    // ID 生成邏輯：
    // 1. 如果實體本身沒有 id，並且傳入的 data 中也沒有 id，則生成新 id。
    // 2. 如果實體本身沒有 id，但傳入的 data 中有 id，則使用 data 中的 id。
    // 3. 如果實體本身已有 id，則不論 data 中是否有 id，都保留實體原有的 id (除非 data 中的 id 被賦值覆蓋)。
    if (this.id === undefined) {
        if (data.id !== undefined) {
            this.id = data.id;
        } else {
            this.id = v4Generator();
        }
        this._dataKeySet.add('id'); // 確保 'id' 被記錄
    } else if (data.id !== undefined && data.id !== this.id) {
        // 如果實體已有 id，但 data 中提供了不同的 id，日誌警告，通常不應發生。
        Logger.warn(`Entity.upsertData`, `Attempting to change existing ID on entity ${this._name} from ${this.id} to ${data.id}. ID change is generally not recommended. Using new ID.`, { entityId: this.id, newId: data.id, isPrint: true });
        this.id = data.id; // 根據當前邏輯，data 中的 id 會覆蓋
        this._dataKeySet.add('id');
    }
    return this;
  }

  /**
   * 將實體的數據屬性轉換為一個普通的 JavaScript 物件。
   * 只包含在 `_dataKeySet` 中記錄的屬性。
   * 
   * @remarks
   * 舊的實現中曾包含將 `_relationshipKeyMap` 中的關聯資訊序列化到物件中的邏輯，
   * 但已被註解掉。當前的實現僅轉換純數據屬性。
   * 如果需要序列化關聯，應考慮其複雜性（例如循環引用）和具體需求，
   * 通常這類邏輯更適合放在轉換層 (Transformer) 或特定的序列化服務中。
   *
   * @returns 一個包含實體數據屬性的普通物件。
   *          屬性值是其在實體實例中的當前值。
   */
  toObject(): Record<string, any> {
    const payload: Record<string, any> = {};
    this._dataKeySet.forEach((key) => {
      // 確保只複製已定義的屬性，避免將原型鏈上的屬性或意外的 undefined 值加入
      if (Object.prototype.hasOwnProperty.call(this, key) || (this as any)[key] !== undefined) {
        payload[key] = (this as any)[key];
      }
    });
    return payload;
  }
}
