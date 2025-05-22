// src/common/selector.ts
// 此檔案提供用於從 Store 中選取和組合狀態片段的工具函式。
// 主要包含 createSelector (用於組合多個 Selector) 和一個新的 createRelationSelector
// (用於根據關聯配置表填充實體的關聯數據)。

import * as _ from 'lodash';
import { combineLatest, Observable } from 'rxjs';
import { map, distinctUntilChanged, shareReplay } from 'rxjs/operators';
import { Entity } from './entity'; // 實體基類
import { EntityState } from './interface/adapter.interface'; // 原始實體狀態的類型
import { RelationshipConfigTable, InputRelationshipOption } from './interface/relation.interface';
import { Logger } from './logger'; // 保留 Logger
// import { Main } from './main'; // Main 的直接依賴應考慮移除或重構

// Selector 基礎類型定義
export type Selector<S, R = any> = (state$: Observable<S>) => Observable<R>;
export type ProjectorFn<S1, R = any> = (s1: S1) => R;
export type ProjectorFn2<S1, S2, R = any> = (s1: S1, s2: S2) => R;
// 可以根據需要擴展 ProjectorFn 到更多參數

/**
 * 建立一個 Memoized Selector，它可以從多個 Observable Stream 中組合值。
 * @param selector1 第一個 Observable Stream 或 Selector。
 * @param projectorFn 一個函式，接收來自所有 Stream 的最新值並計算返回一個新值。
 */
export function createSelector<S1, R>(
    selector1: Observable<S1>,
    projectorFn: ProjectorFn<S1, R>
): Observable<R>;
export function createSelector<S1, S2, R>(
    selector1: Observable<S1>,
    selector2: Observable<S2>,
    projectorFn: ProjectorFn2<S1, S2, R>
): Observable<R>;
// 可以根據需要擴展更多重載
export function createSelector(
    ...args: any[]
): Observable<any> {
    const selectors = args.slice(0, -1) as Observable<any>[];
    const projectorFn = args[args.length - 1] as (...projectorArgs: any[]) => any;

    return combineLatest(selectors).pipe(
        map(latestValues => projectorFn(...latestValues)),
        distinctUntilChanged(), // 確保只有在結果實際更改時才發出
        shareReplay(1) // 共享並重播最新的值給新訂閱者
    );
}


// 類型別名，用於 Feature Selector，它直接從全局狀態選擇一個 FeatureState
export type FeatureSelector<S, F extends Entity> = (state$: Observable<S>) => Observable<EntityState<F>>;

// 類型別名，用於存儲所有相關 Feature Selectors 的 Map
export type RelatedFeatureSelectorsMap<S> = { [entityType: string]: FeatureSelector<S, any> };


/**
 * 建立一個 Selector，它可以為一個主 Feature 的實體填充其在 RelationshipConfigTable 中定義的關聯。
 * 此 Selector 是唯讀的，它會創建主實體狀態的深拷貝並填充關聯，而不會修改原始 Store 狀態。
 *
 * @template MainEntity 主實體的類型，必須繼承自 Entity。
 * @template GlobalState 全局 Store 狀態的類型。
 *
 * @param mainFeatureName 主 Feature 的名稱 (例如 'User', 'Group')。此名稱用於在 relationshipConfigTable 中查找主實體的配置。
 * @param mainFeatureSelector$ 用於選擇主 Feature 狀態的 Observable (通常是 Store.select(selectMainFeatureState))。
 * @param relationshipConfigTable 完整的關聯配置表，定義了實體間的關聯規則。
 * @param relatedFeatureSelectorsMap 一個映射，其鍵為實體類型名 (例如 'Group', 'Department')，
 *                                   值為對應 Feature 狀態的 Observable (例如 Store.select(selectGroupState))。
 * @returns 一個 Observable，發出帶有關聯數據的主 Feature 狀態 (EntityState<MainEntity>) 的深拷貝。
 *          實體列表中的每個實體都將包含其關聯屬性 (根據配置表)。
 */
export function createRelationSelector<MainEntity extends Entity, GlobalState extends object>(
    mainFeatureName: string,
    mainFeatureSelector$: Observable<EntityState<MainEntity>>,
    relationshipConfigTable: RelationshipConfigTable,
    relatedFeatureSelectorsMap: { [entityType: string]: Observable<EntityState<Entity>> }
): Observable<EntityState<MainEntity>> {

    const allRelatedSelectors$ = Object.values(relatedFeatureSelectorsMap);

    // 使用 combineLatest 監聽主 Feature 和所有相關 Feature 的狀態變化
    return combineLatest([mainFeatureSelector$, ...allRelatedSelectors$]).pipe(
        map(([mainState, ...relatedStates]) => {
            // 1. 深拷貝主實體狀態，以防修改原始狀態
            const newState = _.cloneDeep(mainState);

            // 2. 建立一個快速查找相關實體狀態的 Map
            const relatedStatesMap: { [entityType: string]: EntityState<Entity> } = {};
            Object.keys(relatedFeatureSelectorsMap).forEach((key, index) => {
                relatedStatesMap[key] = relatedStates[index];
            });

            // 3. 獲取主實體的關聯配置
            // JDL 中的實體名通常是首字母大寫 (PascalCase)
            const mainEntityConfigKey = mainFeatureName.charAt(0).toUpperCase() + mainFeatureName.slice(1);
            const entityRelationshipConfigs = relationshipConfigTable[mainEntityConfigKey]?._relationshipOptions;

            if (!entityRelationshipConfigs || entityRelationshipConfigs.length === 0) {
                // 如果沒有關聯配置，直接返回深拷貝的原始主狀態
                return newState;
            }

            // 4. 遍歷主實體列表，為每個實體填充關聯
            for (const mainEntityId in newState.entities) {
                if (Object.prototype.hasOwnProperty.call(newState.entities, mainEntityId)) {
                    const mainEntity = newState.entities[mainEntityId]; // 這是深拷貝後的主實體

                    entityRelationshipConfigs.forEach((config: InputRelationshipOption) => {
                        const targetEntityType = config.inputEntityOptions.entity; // JDL中定義的實體名，通常 PascalCase
                        const targetRelationName = config.thisEntityOptions.relationName; // 在主實體上建立的屬性名
                        const mainEntityField = config.thisEntityOptions.displayField || 'id'; // 主實體用於關聯的字段
                        const targetEntityField = config.inputEntityOptions.displayField || 'id'; // 目標實體用於關聯的字段 (外鍵)

                        const targetEntitiesState = relatedStatesMap[targetEntityType];
                        if (!targetEntitiesState || !targetEntitiesState.entities) {
                            Logger.warn(`createRelationSelector`, `Missing target entity state or entities for type: ${targetEntityType}`, { mainFeatureName, targetEntityType });
                            return; // 跳過此關聯配置
                        }

                        switch (config.RelationType) {
                            case 'ManyToOne': // 例如：User 有一個 groupId 指向 Group
                            case 'OneToOne': { // 例如：User 有一個 profileId 指向 Profile
                                const foreignKeyValue = mainEntity[mainEntityField];
                                if (foreignKeyValue !== undefined && foreignKeyValue !== null) {
                                    // 遍歷目標實體，找到匹配的
                                    const foundTarget = Object.values(targetEntitiesState.entities).find(
                                        (target: Entity) => target[targetEntityField] === foreignKeyValue
                                    );
                                    if (foundTarget) {
                                        mainEntity[targetRelationName] = _.cloneDeep(foundTarget);
                                    } else {
                                        mainEntity[targetRelationName] = null; // 或 undefined，視需求而定
                                    }
                                } else {
                                    mainEntity[targetRelationName] = null;
                                }
                                break;
                            }
                            case 'OneToMany': { // 例如：Group 有多個 User (user.groupId === group.id)
                                const relatedEntities = Object.values(targetEntitiesState.entities).filter(
                                    (target: Entity) => target[targetEntityField] === mainEntity[mainEntityField]
                                );
                                mainEntity[targetRelationName] = _.cloneDeep(relatedEntities); // 存儲為數組
                                break;
                            }
                            case 'ManyToMany': { // 例如：User 有多個 roles, Role 有多個 users
                                // 假設 mainEntity[mainEntityField] 是一個 ID 數組 (例如 user.roleIds)
                                // 並且 targetEntityField 在目標實體上是其主鍵 (例如 role.id)
                                const foreignKeyValues = mainEntity[mainEntityField];
                                if (Array.isArray(foreignKeyValues)) {
                                    const relatedEntities = foreignKeyValues.map(fkValue =>
                                        Object.values(targetEntitiesState.entities).find(
                                            (target: Entity) => target[targetEntityField] === fkValue
                                        )
                                    ).filter(Boolean); // 過濾掉未找到的 (undefined)
                                    mainEntity[targetRelationName] = _.cloneDeep(relatedEntities);
                                } else {
                                    mainEntity[targetRelationName] = []; // 如果沒有外鍵值，則為空數組
                                }
                                break;
                            }
                            default:
                                Logger.warn(`createRelationSelector`, `Unsupported relation type: ${config.RelationType}`, { config });
                        }
                    });
                }
            }
            return newState;
        }),
        distinctUntilChanged((prev, curr) => _.isEqual(prev, curr)), // 比較深拷貝後的結果
        shareReplay(1)
    );
}

// 移除舊的 selectRelevanceEntity 和 selectSourceRelevanceEntity，
// 因為它們的邏輯將被 createRelationSelector 內部處理或由更通用的選擇器取代。
// 舊的 createFeatureSelector 和 createRelationSelector<T>(featureName: string) 也移除，
// 採用新的基於 Store.select 的方式。
