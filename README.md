# mycena-store

[![NPM Version][npm-image]][npm-url]
[![NPM Downloads][downloads-image]][downloads-url]
[![Node.js Version][node-version-image]][node-version-url]
[![License - MIT](https://img.shields.io/badge/License-MIT-2ea44f?logo=license)](LICENSE)

mycena-store 提供可預測型反應式狀態機的管理機制給 Angular-like 應用程式。啟發來自於 BLoC 設計模式、NgRx 溝通機制、網路資料結構。

## 如何開始使用

```sh
1. 前置設定，更改專案中 tsconfig.json 當中 "target" 為 "ES5" 。
2. 設定 store 當中要有的 Entity ./src/app/mycena-store/<ENTITY>
3. ENTITY 當中需存在 action.ts/ effects.ts/ entity.ts/ model.ts/ reducer.ts/ selectors.ts

[可參考已經建立好的專案]()

4. 建立 store 該有的 index entry
[可參考已經建立好的專案]()

5. (Angular 專案為例)在 ./src/main.ts 中添加到 appModule 如下圖所示
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

### 開發套件

```sh
$ git clone repo
```

尋求相關人士拿到設計文件。

### 部署到 Npm package

```sh
1. 執行 compiler build
$ npm run watch:build

1.5 記得修改 package.json 上的 version

2. 將 build 好的檔案部署到 npm 上
$ npm publish --access public
```

### 建立文件

```sh
1. The src folder is analyzed and documentation is automatically generated using TypeDoc.
npm run doc

2. To generate and publish your documentation to GitHub Pages use the following command:
npm run doc:publish
```

[npm-image]: https://img.shields.io/npm/v/mycena-store.svg?logo=npm
[npm-url]: https://www.npmjs.com/package/mycena-store
[node-version-image]: https://img.shields.io/node/v/mycena-store.svg?logo=node.js
[node-version-url]: https://nodejs.org/en/download
[downloads-image]: https://img.shields.io/npm/dm/mycena-store.svg
[downloads-url]: https://npmjs.org/package/mycena-store
