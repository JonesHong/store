// lowdb.d.ts low 7.0.1
// declare module "lowdb/node" {
//     export * from "lowdb/lib/node";
// }

/**
 * https://github.com/typicode/lowdb/issues/554#issuecomment-1377222760
 *  另一個選擇是修補 lowdb （並保留其他所有內容）：

 *  npm i -D patch-package（如果您還沒有）
 *  添加到and export * from './node.js'的末尾node_modules/lowdb/lib/index.jsnode_modules/lowdb/lib/index.d.ts
 *  npx patch-package lowdb
 *  添加"postinstall": "patch-package"到 package.json 中的腳本（如果您還沒有這個或類似的東西）
 *  最後一步確保每次重新安裝模組時都會重新套用該補丁。

 *  您現在將從 lowdb 匯入 JSONFile，即。import { Low, JSONFile } from 'lowdb';
 */
