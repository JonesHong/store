# mycena-store

[![NPM Version][npm-image]][npm-url]
[![NPM Downloads][downloads-image]][downloads-url]
[![Node.js Version][node-version-image]][node-version-url]
[![License - MIT](https://img.shields.io/badge/License-MIT-2ea44f?logo=license)](LICENSE)

mycena-store 是 Redux-like 應用程式。  
啟發來自於 BLoC 設計模式、 NgRx 溝通機制、Neo4j 資料結構、JHipster 關係綁定的方法...。

## 為什麼要用

Angular 有 NgRx，Nestjs 有 CQRS，為什麼還要再做一套呢?  
因為 Angular 和 Nestjs 底層都是 Typescript，我們希望能最大化重複使用程式碼。  
有了這個工具以後，在撰寫系統時要將前後端視為一體去思考設計。

## 架構概念

![ngrx-diagram][ngrx-diagram]
唯一存在的 Store 是門面，有任何訊息傳遞都是以 Action 的形式通知它，用於系統內部邏輯處理的就交給 Reducer, BLoC 處理；要去系統外(Database, Other service)拿資料的話就由 Effect 處理，呼叫對應的 Service 後，等待回覆後再以 Action 形式再丟回 Store 中。  
而有了 Selector 以後，可搭配 Socket, PRC...等即時的通訊方式，有任何改變 Server 端可以主動 broadcast 給所有 Client 端。

![constructor_of_app][constructor_of_app]
[詳細說明書][manual]
## 如何開始使用

- 通用設定

1. (非必要) 可於`./tsconfig.json`

    ```json
    {
      "compilerOptions":{
        "paths":[
          "@<PROJECT_NAME>": ["<PATH_OF_MYCENA_STORE_INSTANCE>"],
        ]
      }
    }
    ```

    (請參考連結: [tsconfig_paths][tsconfig_paths])

- 如果是 Angular 使用：

1. (必要)請到 `./angular.json` 中，將 "mycena-store" 加到 allowCommonJsDependencies 下

    ```json
    {
      "projects": {
        "PROJECT_NAME": {
          "architect": {
            "build": {
              "options": {
                "allowCommonJsDependencies": ["mycena-store"]
              }
            }
          }
        }
      }
    }
    ```

    (請參考連結: [allowed common js dependencies][allowedcommonjsdependencies])
2. (必要)注意 `./tsconfig.json`，可參考以下 Angular Example

    ```json
    {
      "compilerOptions": {
        "sourceMap": true,
        "declaration": false,
        "moduleResolution": "node",
        "emitDecoratorMetadata": true,
        "experimentalDecorators": true,
        "strict": false /* Disable all strict type-checking options. */,
        /* Additional Checks */
        "noUnusedLocals": false /* Report errors on unused locals. */,
        "noUnusedParameters": false /* Report errors on unused parameters. */,
        "noImplicitReturns": false /* Report error when not all code paths in function return a value. */,
        "noFallthroughCasesInSwitch": false /* Report errors for fallthrough cases in switch statement. */,
        "allowSyntheticDefaultImports": true,
        "esModuleInterop": true,
        "importHelpers": true,
        "target": "es2021",
        "module": "esnext",
        "types": ["node"],
        "lib": ["es2017", "es2021", "dom"],
        "skipLibCheck": true,
        "skipDefaultLibCheck": true
      }
    }
    ```

    將來有時間的話要來重寫 @felangel/bloc 裡面的邏輯。  
    (請參考連結: [extend-observable][extend-observable])
3. (必要)`/src/polyfills.ts`中，請加到

    ```ts
    import 'reflect-metadata';
    (window as any).process = {
      env: { DEBUG: undefined },
    };
    ```

    (請參考連結: [reflect-metadata][reflect-metadata], [process][process])

4. (必要)在 `./src/main.ts` 中，將 appModule 添加到 Cqrs 如下所示

    ```ts
    platformBrowserDynamic()
      .bootstrapModule(AppModule)
      .then((appModule) => {
        // Ensure Angular destroys itself on hot reloads.
        /**
          if (window['ngRef']) {
            window['ngRef'].destroy();
          }
          window['ngRef'] = appModule;
        */

        // And this line for adoption
        Cqrs.setAppModule(appModule);
      })
      .catch((err) => console.error(err));
    ```

5. (必要)Effect 中的

    ```ts
    // e.g.
    import { injectable } from 'inversify';
    @injectable()
    class GroupEffect {}
    //↓ ↓ ↓ 請替換成 ↓ ↓ ↓
    import { Injectable } from '@angular/core';
    @Injectable()
    class GroupEffect {}
    ```

    以便於 Dependency-Injection 使用 angular 產生的 service

- 如果是 Nestjs 使用

1. (非必要) 於`./tsconfig.json`設置 paths 時，若是遭遇 Path Aliases 異常  
   (請參考連結: [path_aliases][path_aliases])

2. (必要)在 `./src/main.ts` 中，將 appModule 添加到 Cqrs 如下所示

   ```ts
   async function bootstrap() {
     const app = await NestFactory.create(AppModule);
     await app.listen(3000);
     Cqrs.setAppModule(AppModule, app);
   }
   bootstrap();
   ```

3. (必要)Effect 中

   ```ts
   // e.g.
   import { injectable } from 'inversify';
   @injectable()
   class GroupEffect {}
   //↓ ↓ ↓ 請替換成 ↓ ↓ ↓
   import { Injectable } from '@nest/common';
   @Injectable()
   class GroupEffect {}
   ```

   以便於 Dependency-Injection 使用 nest 產生的 service

## Example 範例

[Nrwl Example][nrwl-example-url]  
The path of `/apps/api` is Nestjs application. (`apps/api/src/app/app.service.ts`)  
The path of `/apps/app` is Angular application. (`apps/app/src/app/app.component.ts`)  
The path of `/libs/mycena-store` is instance of mycena-store. (`libs/mycena-store/src/lib/mycena-store.unittest.ts`)

[Angular Example][angular-example-url]  
[Nest Example][nest-example-url]

## 其他

其他文件放置於專案下 `./doc`  
[NOTE 筆記][note.md]  
[VERSION 歷史版本][version.md]  
[OUTLOOK 未來展望][outlook.md]  
[BUG 已知待修復Bug][bug.md]  

<!-- 說明小圖示 -->

[npm-image]: https://img.shields.io/npm/v/mycena-store.svg?logo=npm
[npm-url]: https://www.npmjs.com/package/mycena-store
[node-version-image]: https://img.shields.io/node/v/mycena-store.svg?logo=node.js
[node-version-url]: https://nodejs.org/en/download
[downloads-image]: https://img.shields.io/npm/dm/mycena-store.svg
[downloads-url]: https://npmjs.org/package/mycena-store

<!-- 圖片 -->
[constructor_of_app]: https://github.com/JonesHong/store/blob/Joneshong/doc/images/consturctor_of_app.png?raw=true "https://drive.google.com/file/d/1xfxVHpPUJM6mJySblGvp27UbfOk0j3d-/view?usp=sharing"
[ngrx-diagram]: https://ngrx.io/generated/images/guide/store/state-management-lifecycle.png 'https://github.com/JonesHong/store/doc/images/state-management-lifecycle.png'

<!-- 參考 -->

[extend-observable]: https://stackoverflow.com/questions/61024321/extend-observable-and-set-external-source
[allowedcommonjsdependencies]: https://angular.io/guide/build#configuring-commonjs-dependencies
[reflect-metadata]: https://stackoverflow.com/questions/49079169/typeerror-reflect-hasownmetadata-is-not-a-function
[process]: https://stackoverflow.com/questions/50313745/angular-6-process-is-not-defined-when-trying-to-serve-application
[tsconfig_paths]: https://stackoverflow.com/questions/43281741/how-to-use-paths-in-tsconfig-json
[path_aliases]: https://javascript.plainenglish.io/a-simple-way-to-use-path-aliases-in-nestjs-ab0db1be1545

<!-- 範例 -->

[nrwl-example-url]: https://github.com/JonesHong/nrwl-testing-store
[angular-example-url]: https://github.com/JonesHong/angular-testing-store
[nest-example-url]: https://github.com/JonesHong/nest-testing-store

<!-- 其他 -->
[manual]: https://docs.google.com/document/d/1bbjQLsijVwKDIq3D7S9yS6Rc9WcenCmREs27ZTU95EM/edit?usp=sharing "https://github.com/JonesHong/store/blob/Joneshong/doc/mycena-store說明書.pdf"
[note.md]: https://github.com/JonesHong/store/blob/Joneshong/doc/NOTE.md
[version.md]: https://github.com/JonesHong/store/blob/Joneshong/doc/VERSION.md
[outlook.md]: https://github.com/JonesHong/store/blob/Joneshong/doc/OUTLOOK.md
[bug.md]: https://github.com/JonesHong/store/blob/Joneshong/doc/BUG.md
