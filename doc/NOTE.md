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
