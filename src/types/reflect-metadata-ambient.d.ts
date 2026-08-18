// TS5 收緊了 compilerOptions.types 的解析範圍，只在 typeRoots 目錄下逐層找子資料夾，
// 不再像 TS4 那樣退回一般 node module 解析。reflect-metadata 不是 @types/* 套件，
// 放進 types 陣列會直接 TS2688 找不到。改用 triple-slash reference（走一般模組解析）
// 把 inversify decorator 需要的 Reflect.getMetadata 型別帶進來，同時維持不在編譯輸出
// 裡夾帶 runtime side-effect import（library 不該替 consumer 決定何時載入 polyfill）。
/// <reference types="reflect-metadata" />
