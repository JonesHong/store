# 歷史版本紀錄

### 1.2.0
* 部分變數和型態重新命名並加上註解
* 重新架構 FromJDL的部分，讓 Entity間的關係可以是複數，連帶的 RelationStore也重構了，原本是放在 CqrsMain & relation下面，現在在 Store.withRelation$中
* 修正沒有 Effect ，Action 無法被 dispatch 到 Store
* 新增 Main暫時做為一些設定檔的位置，可藉由它開啟關閉 log模式
### 1.1.8
修正entity中多個key同時指向同一 target entity 無法指定key
### 1.1.7
修正entity中多個key同時指向同一 target entity 關係綁定失敗 ✔️
### 1.1.6
RelationStore最後的 last()要移除否則不會觸發
### 1.1.5
RelationStore被因為 concatWith觸發兩次，已改善
### 1.1.4

修正以下  
* 一開始沒有關係，後來加上去新的關係 ✔️
* 一開始有關係，但關係換了 ✔️
* 一開始有關係後來刪除關係了 ✔️
* 關係綁好以後，刪除其中一邊的entity ✔️
* 關係兩邊 Entity先後加入的順序不影響綁定關係 ✔️
* 綁關係時 Entity如果與同一個 Entity但有複數關係時，永遠只會綁到第一筆關係 ✔️
* 關聯的key為object時可以綁定關係 ✔️
* 單一Entity有關聯對象的資料來源，雙方綁定關係 ✔️
* 
### 1.1.3

* （待測試）新增 `settlementToObject的` Operator用於 `Store.settlement$`，將最後改變的狀態包裝成 Actions的純物件型態傳輸給 Client端。

### 1.1.2

* 原本是依賴 npm上的 `"@felangel/bloc": "~0.0.3"`，因此導致設定時需要將 tsconfig中 `"target": "es5"`，並且 package.json中 `"rxjs": "~6.5.7"`被鎖定的情況下，要用指令 `npm i --force`去避免版本衝突。將專案從 Github拉下來放在路徑 `./src/libs/@felangel/bloc` 之下，並在 Store專案裡 package.json下添加

    ```json
    "paths": {
      "@felangel/bloc": [
        "src/libs/@felangel/bloc/bloc.ts"
      ]
    },
    "plugins": [
      {
        "transform": "typescript-transform-paths"
      },
      {
        "transform": "typescript-transform-paths",
        "afterDeclarations": true
      }
    ]
    ```

    來避免使用此函式庫要做多餘設定。
