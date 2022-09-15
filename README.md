# mycena-store

[![NPM Version][npm-image]][npm-url]
[![NPM Downloads][downloads-image]][downloads-url]
[![Node.js Version][node-version-image]][node-version-url]
[![License - MIT](https://img.shields.io/badge/License-MIT-2ea44f?logo=license)](LICENSE)

mycena-store 是 Redux-like 應用程式。啟發來自於 BLoC 設計模式、NgRx 溝通機制、網路資料結構。

## 如何開始使用

- 如果是 Angular 使用：

1. 請到 `./angular.json` 中，將 "mycena-store" 加到  
   `projects."PROJECT_NAME".architect.build.options.allowCommonJsDependencies`  
    [請參考連結][allowedcommonjsdependencies]
2. 注意 `./tsconfig.json`，可參考以下 Angular Example
3. `/src/polyfills.ts`中，請補上 `import "reflect-metadata";`  
   [請參考連結][reflect-metadata]
4. `/src/polyfills.ts`中，請補上  
   [請參考連結][process]

```sh
(window as any).process = {
  env: { DEBUG: undefined },
};
```

5. 在 `./src/main.ts` 中添加到 appModule 如下所示

```sh
platformBrowserDynamic()
  .bootstrapModule(AppModule)
  .then((appModule) => {
    // Ensure Angular destroys itself on hot reloads.
    if (window['ngRef']) {
      window['ngRef'].destroy();
    }
    window['ngRef'] = appModule;

    // And this line for adoption
    Cqrs.setAppModule(appModule);
  })
  .catch((err) => console.error(err));
```

6. Effect 中的  
   @injectable() -> _import { injectable } from "inversify";_  
   請替換成  
   @Injectable() -> _import { Injectable } from "@angular/core";_

- 如果是 Nestjs 使用
- 通用設定

1. 於`./tsconfig.json`

```sh
{
  ...,
  compilerOptions:{
    ...,
    paths:[
      "@<PROJECT_NAME>": ["<PATH_OF_MYCENA_STORE_INSTANCE>"],
    ]
    }
}
```

[請參考連結][tsconfig_paths]

## Example 範例

[Nrwl Example][example-nrwl-url]  
The path of `/apps/api` is Nestjs application. (`apps/api/src/app/app.service.ts`)  
The path of `/apps/app` is Angular application. (`apps/app/src/app/app.component.ts`)  
The path of `/libs/mycena-store` is instance of mycena-store. (`libs/mycena-store/src/lib/mycena-store.unittest.ts`)

[Angular Example][example-angular-url]

## 其他

其他筆記放置於專案下 `./doc`

[npm-image]: https://img.shields.io/npm/v/mycena-store.svg?logo=npm
[npm-url]: https://www.npmjs.com/package/mycena-store
[node-version-image]: https://img.shields.io/node/v/mycena-store.svg?logo=node.js
[node-version-url]: https://nodejs.org/en/download
[downloads-image]: https://img.shields.io/npm/dm/mycena-store.svg
[downloads-url]: https://npmjs.org/package/mycena-store
[example-nrwl-url]: https://github.com/JonesHong/testing-store-nrwl
[example-angular-url]: https://github.com/JonesHong/testing-store-angular
[allowedcommonjsdependencies]: https://angular.io/guide/build#configuring-commonjs-dependencies
[reflect-metadata]: https://stackoverflow.com/questions/49079169/typeerror-reflect-hasownmetadata-is-not-a-function
[process]: https://stackoverflow.com/questions/50313745/angular-6-process-is-not-defined-when-trying-to-serve-application
[tsconfig_paths]: https://stackoverflow.com/questions/43281741/how-to-use-paths-in-tsconfig-json
