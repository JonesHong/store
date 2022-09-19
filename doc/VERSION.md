# 歷史版本紀錄

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
