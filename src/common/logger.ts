// src/common/logger.ts
// 此檔案提供了一個可配置的 Logger 服務，用於在應用程式中記錄不同級別的訊息。
// 它支援日誌級別控制、Node.js 環境下的檔案日誌記錄，並使用 chalk 為 Node.js 控制台輸出添加顏色。

import { DateTime } from 'luxon';
import chalk from 'chalk';       // 用於為控制台輸出添加顏色 (Node.js)
import stripAnsi from 'strip-ansi'; // 用於從字串中移除 ANSI escape codes (用於檔案日誌)
import { envType } from './env_checker'; // 判斷當前運行環境

// #region LogLevel Enum and Types - 日誌級別枚舉和相關類型定義

/**
 * 定義日誌的級別。
 * 級別越低，輸出的日誌越詳細。
 */
export enum LogLevel {
  /** 詳細的調試資訊，通常僅在開發階段使用。 */
  DEBUG = 0,
  /** 一般的資訊性訊息，用於追蹤應用程式的正常流程。 */
  INFO = 1,
  /** 警告訊息，表示可能出現潛在問題，但應用程式仍可繼續運行。 */
  WARN = 2,
  /** 錯誤訊息，表示發生了阻止正常操作的錯誤。 */
  ERROR = 3,
  /** 不處理或輸出任何日誌。 */
  SILENT = 4,
}

/**
 * 日誌級別的字串表示類型 (例如 'DEBUG', 'INFO')。
 */
export type LogLevelString = keyof typeof LogLevel;

/**
 * Logger 的配置介面。
 */
export interface LoggerConfig {
  /** 
   * 設定 Logger 的日誌級別。
   * 可以是 `LogLevel` 枚舉值或其字串表示 (例如 'DEBUG', LogLevel.DEBUG)。
   * 只有級別等於或高於此設定的日誌才會被處理。
   * 預設為 `LogLevel.INFO`。
   */
  level?: LogLevelString | LogLevel;

  /** 
   * (Node.js 環境專用) 是否啟用檔案日誌記錄。
   * 如果為 `true`，日誌將被寫入到 `logFolderPath` 指定的檔案夾中。
   * 預設為 `false`。
   */
  enableFileLog?: boolean;

  /** 
   * (Node.js 環境專用) 日誌檔案夾的路徑。
   * 預設為 `'./_logs'`。
   */
  logFolderPath?: string;

  /** 
   * (可選) 控制日誌時間戳的格式，遵循 Luxon 的格式化規則。
   * 預設為 'yyyy/LL/dd HH:mm:ss'。
   */
  timestampFormat?: string;
}
// #endregion

// #region Chalk 顏色定義 (用於 Node.js 控制台輸出)
const originalConsoleLog = console.log;
const errorChalk = chalk.bold.red;
const warnChalk = chalk.hex('#FFA500'); // Orange color
const infoChalk = chalk.green;
const debugChalk = chalk.blue;
// #endregion

/**
 * (Node.js 環境專用) 標記檔案日誌的檔案夾創建是否已嘗試過。
 * @private
 */
let _logFolderCreationFailed = false;

/**
 * Logger 類別，提供不同級別的日誌記錄方法。
 * 採用手動管理的單例模式，允許在首次獲取實例時進行配置。
 *
 * @example
 * // 在應用程式入口處初始化 Logger
 * Logger.initialize({ level: 'DEBUG', enableFileLog: true });
 *
 * // 在其他模組中使用 Logger
 * const logger = Logger.getInstance();
 * logger.info('UserService', 'User created successfully.', { payload: { userId: '123' } });
 * logger.debug('DatabaseService', 'Executing query:', { payload: 'SELECT * FROM users' });
 */
class _Logger {
  private static _instance: _Logger;

  /**
   * Logger 的預設配置。
   * @private
   */
  private static readonly DEFAULT_CONFIG: Required<LoggerConfig> = {
    level: LogLevel.INFO,
    enableFileLog: false,
    logFolderPath: './_logs',
    timestampFormat: 'yyyy/LL/dd HH:mm:ss',
  };

  /**
   * 當前 Logger 實例的配置。
   * @private
   */
  private currentConfig: Required<LoggerConfig>;

  /** 
   * (Node.js 環境專用) 當前日誌檔案的完整路徑。
   * @private
   */
  private _logPath: string | undefined;

  /**
   * Logger 的私有構造函式，用於實現單例和接收初始配置。
   * @param config (可選) 初始 Logger 配置。
   * @private
   */
  private constructor(config?: LoggerConfig) {
    this.currentConfig = { ..._Logger.DEFAULT_CONFIG, ...(config || {}) };
    this.normalizeConfigLevel(); // 確保 level 是數字
    
    if (envType === 'nodejs' && this.currentConfig.enableFileLog) {
      this.initializeFileLoggingSystem(); // 嘗試創建檔案夾
      this.initializeInstanceFileLogging(); // 嘗試創建日誌檔案
    }
  }

  /**
   * 將配置中的 level (可能是字串) 標準化為 LogLevel 枚舉值。
   * @private
   */
  private normalizeConfigLevel(): void {
    if (typeof this.currentConfig.level === 'string') {
      const levelKey = this.currentConfig.level.toUpperCase() as LogLevelString;
      if (LogLevel[levelKey] !== undefined) {
        this.currentConfig.level = LogLevel[levelKey];
      } else {
        originalConsoleLog(errorChalk(`[LoggerConfig] Invalid log level string: "${this.currentConfig.level}". Defaulting to INFO.`));
        this.currentConfig.level = LogLevel.INFO;
      }
    }
  }
  
  /**
   * (Node.js 環境專用) 初始化檔案日誌系統，主要是創建日誌檔案夾。
   * 此方法應僅在 Node.js 環境且啟用檔案日誌時被調用一次。
   * @private
   */
  private initializeFileLoggingSystem(): void {
    if (envType !== 'nodejs' || !this.currentConfig.enableFileLog || _logFolderCreationFailed) return;

    try {
      var fs = require('fs');
      const folderPath = this.currentConfig.logFolderPath;
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
        originalConsoleLog(chalk.blue(`[Logger] Log folder created: '${folderPath}'`));
      }
    } catch (e: any) {
      originalConsoleLog(errorChalk(`[Logger] Error creating log folder '${this.currentConfig.logFolderPath}': ${e.message}`));
      _logFolderCreationFailed = true; // 標記創建失敗，避免重複嘗試
    }
  }

  /**
   * (Node.js 環境專用) 初始化此 Logger 實例的檔案日誌，創建當前會話的日誌檔案。
   * @private
   */
  private initializeInstanceFileLogging(): void {
    if (envType !== 'nodejs' || !this.currentConfig.enableFileLog || this._logPath || _logFolderCreationFailed) {
      // 如果不是 Node.js，或未啟用檔案日誌，或已初始化過，或檔案夾創建失敗，則返回
      return;
    }
    try {
      var fs = require('fs');
      var path = require('path');
      const timestamp = DateTime.now().toFormat('yyyy.LL.dd_HH.mm.ss');
      const fileName = `app_log_${timestamp}.log`;
      this._logPath = path.resolve(this.currentConfig.logFolderPath, fileName);
      
      fs.writeFileSync(this._logPath, `Log file session started at ${this.DateString()}\n------------------------------------\n`, {
        encoding: 'utf-8',
      });
      // originalConsoleLog(chalk.blue(`[Logger] Instance logging to file: ${this._logPath}`));
    } catch (e: any) {
      originalConsoleLog(errorChalk(`[Logger] Error creating instance log file in '${this.currentConfig.logFolderPath}': ${e.message}`));
      this._logPath = undefined;
    }
  }

  /**
   * 公共方法，用於在 Logger 實例化後更新其配置。
   * @param config 部分 Logger 配置物件。
   */
  public configure(config: Partial<LoggerConfig>): void {
    this.currentConfig = { ...this.currentConfig, ...config };
    this.normalizeConfigLevel();

    if (envType === 'nodejs') {
      if (this.currentConfig.enableFileLog) {
        // 如果之前未啟用檔案日誌，或檔案夾路徑改變，則嘗試重新初始化
        if (!_logFolderCreationFailed) {
            this.initializeFileLoggingSystem(); // 確保檔案夾存在
            // 如果檔案夾路徑改變或之前未初始化路徑，則重新初始化實例日誌檔案
            // (注意：簡單起見，這裡不處理運行中切換日誌檔案的複雜情況，而是假設配置在早期設定)
            if (!this._logPath && !_logFolderCreationFailed) {
                 this.initializeInstanceFileLogging();
            }
        }
      } else {
        // 如果從啟用到禁用檔案日誌，可以考慮關閉檔案流等，但目前實現簡單移除路徑
        this._logPath = undefined; 
      }
    }
    Logger.getInstance().info('LoggerConfig', 'Logger configuration updated.', {payload: this.currentConfig});
  }
  
  /**
   * 格式化當前日期和時間為字串，使用當前配置的時間戳格式。
   * @returns 格式化後的日期時間字串。
   */
  private DateString(): string {
    return DateTime.now().toFormat(this.currentConfig.timestampFormat);
  }

  /**
   * 基礎的日誌處理函式。
   * @param level 此條日誌的級別。
   * @param prefix 日誌前綴 (通常包含時間戳、類型等)。
   * @param message 日誌訊息。
   * @param options Logger 選項。
   * @private
   */
  private _baseHandler(level: LogLevel, prefix: string, message: string, options: LoggerOptions): void {
    if (this.currentConfig.level > level) {
      return; // 如果配置的日誌級別更高，則不處理此日誌
    }

    let logString = `${prefix} ${message}`;
    if (options.execTime !== undefined && typeof options.execTime === 'number') {
      logString += chalk.italic.yellow(` +${options.execTime}ms`);
    }

    // Node.js 環境下的控制台輸出
    if (envType === 'nodejs') {
      if (options.payload !== undefined) {
        originalConsoleLog(logString, "\nPayload:", options.payload);
      } else {
        originalConsoleLog(logString);
      }
    }

    // 瀏覽器環境的控制台輸出
    if (envType === 'browser') {
        const strippedString = stripAnsi(logString); // 瀏覽器控制台不需要 chalk 顏色
        const consoleArgs = [strippedString];
        if (options.payload !== undefined) {
            consoleArgs.push("\nPayload:", options.payload);
        }
        switch (level) {
            case LogLevel.DEBUG: console.debug(...consoleArgs); break;
            case LogLevel.INFO: console.info(...consoleArgs); break;
            case LogLevel.WARN: console.warn(...consoleArgs); break;
            case LogLevel.ERROR: console.error(...consoleArgs); break;
        }
    }

    // Node.js 環境下的檔案寫入
    if (envType === 'nodejs' && this.currentConfig.enableFileLog && this._logPath && !_logFolderCreationFailed) {
      try {
        var fs = require('fs');
        const strippedLogString = stripAnsi(logString);
        const filePayload = options.payload !== undefined ? `\nPayload: ${JSON.stringify(options.payload, null, 2)}` : '';
        fs.appendFileSync(this._logPath, `${strippedLogString}${filePayload}\n`, { encoding: 'utf-8' });
      } catch (e: any) {
        originalConsoleLog(errorChalk(`[Logger] Error writing to log file ${this._logPath}: ${e.message}`));
      }
    }
  }

  /** Node.js 環境下的進程 ID，用於日誌前綴。 */
  private _processId: string | number = (typeof process !== 'undefined' && process.pid) ? process.pid : '';
  
  /** 格式化 Node.js 日誌前綴。 */
  private getNodeJsPrefix(): string {
      return chalk.dim(`[PID:${this._processId}] ${this.DateString()} - `);
  }

  /**
   * 記錄 DEBUG 級別的訊息 (藍色)。
   * @param type 日誌類型或模組名稱。
   * @param message 訊息內容。
   * @param options (可選) {@link LoggerOptions}。
   */
  public debug(type: LoggerType, message: string, options: LoggerOptions = {}): void {
    const prefix = envType === 'nodejs' ? `${this.getNodeJsPrefix()}${debugChalk(`[${String(type)}]`)}` : `[${String(type)}]`;
    this._baseHandler(LogLevel.DEBUG, prefix, debugChalk(message), options);
  }

  /**
   * 記錄 INFO 級別的訊息 (綠色)。
   * @param type 日誌類型或模組名稱。
   * @param message 訊息內容。
   * @param options (可選) {@link LoggerOptions}。
   */
  public info(type: LoggerType, message: string, options: LoggerOptions = {}): void {
    const prefix = envType === 'nodejs' ? `${this.getNodeJsPrefix()}${infoChalk(`[${String(type)}]`)}` : `[${String(type)}]`;
    this._baseHandler(LogLevel.INFO, prefix, infoChalk(message), options);
  }

  /**
   * 記錄 WARN 級別的訊息 (橘色)。
   * @param type 日誌類型或模組名稱。
   * @param message 警告訊息內容。
   * @param options (可選) {@link LoggerOptions}。
   */
  public warn(type: LoggerType, message: string, options: LoggerOptions = {}): void {
    const prefix = envType === 'nodejs' ? `${this.getNodeJsPrefix()}${warnChalk(`[${String(type)}]`)}` : `[${String(type)}]`;
    this._baseHandler(LogLevel.WARN, prefix, warnChalk(message), options);
  }

  /**
   * 記錄 ERROR 級別的訊息 (粗體紅色)。
   * @param type 日誌類型或模組名稱。
   * @param message 錯誤訊息內容。
   * @param options (可選) {@link LoggerOptions}。
   */
  public error(type: LoggerType, message: string, options: LoggerOptions = {}): void {
    const prefix = envType === 'nodejs' ? `${this.getNodeJsPrefix()}${errorChalk(`[${String(type)}]`)}` : `[${String(type)}]`;
    this._baseHandler(LogLevel.ERROR, prefix, errorChalk(message), options);
  }

  /**
   * 初始化 Logger 單例。應在應用程式啟動時盡早調用一次。
   * 如果 Logger 已被實例化，則會使用新配置更新現有實例。
   * @param config (可選) 初始 Logger 配置。
   */
  public static initialize(config?: LoggerConfig): void {
    if (!this._instance) {
      this._instance = new _Logger(config);
    } else {
      this._instance.configure(config || {});
    }
  }

  /**
   * 獲取 Logger 的單例實例。
   * 如果 Logger 尚未通過 `initialize` 方法初始化，則會使用預設配置創建實例。
   * @returns Logger 的單例實例。
   */
  public static getInstance(): _Logger {
    if (!this._instance) {
      this._instance = new _Logger(); // 使用預設配置創建
      originalConsoleLog(warnChalk('[Logger] Logger.getInstance() called before Logger.initialize(). Using default configuration. It is recommended to call Logger.initialize() at application startup.'));
    }
    return this._instance;
  }
}

/**
 * Logger 的導出單例實例。
 * **重要：** 建議在應用程式入口處調用 `Logger.initialize(config)` 來配置 Logger，
 * 然後再通過 `Logger.getInstance()` 或直接使用此導出的 `Logger` 實例。
 * 如果直接使用此 `Logger` 實例而未調用 `initialize`，它將使用預設配置。
 * 
 * @example
 * // main.ts (應用程式入口)
 * // Logger.initialize({ level: 'DEBUG', enableFileLog: true });
 * 
 * // other-module.ts
 * // import { Logger } from './logger';
 * // Logger.info('MyModule', 'Module initialized.');
 */
const Logger = _Logger.getInstance(); // 這裡會創建一個預設配置的實例，如果 initialize 未被調用

export { Logger }; // 導出 Logger 實例
// DateString 已在頂部導出
// 不再需要導出 _Logger 類本身，因為它通過靜態方法管理
// 移除舊的導出： export { Logger, DateString };
