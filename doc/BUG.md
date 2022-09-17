# 已知待修復 BUG

- 更新 Entity 的關係時，舊的沒刪除掉，新的沒綁定成功
- 設定關係時必須以兩行，可改進
  ```ts
  Cqrs.setRelationshipByType(RelationshipByTypeMap);
  Cqrs.setRelationConfig(
    Relation.getInstance().fromJDL(Cqrs.relationshipByType)
  );
  ```
- OneToOne, ManyTOMany 需要再仔細排查過一輪
