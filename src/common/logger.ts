import { DateTime } from 'luxon';
import chalk from 'chalk';
import stripAnsi from 'strip-ansi';
import { envType } from './env_checker';
import { Singleton } from './decoratios/singleton';
import { Main } from './main';
import { take } from 'rxjs';
import { LowDBManager } from '../only_backend/db_facade';

const log = console.log;
const error = chalk.bold.red;
const warn = chalk.hex('#FFA500'); // Orange color


//
let _logFolderPath;
Main.isLogByFIle$.asObservable().subscribe(isLogByFIle => {
  if (!!isLogByFIle && envType == 'nodejs') {
    LowDBManager.initialDB();
    var fs = require('fs');
    _logFolderPath = './_logs';
    if (!fs.existsSync(_logFolderPath)) {
      fs.mkdirSync(_logFolderPath);
      Main.printMode == "detail" ? log(`Create '${_logFolderPath}'!`) : null;
    } else {
      Main.printMode == "detail" ? log(warn(`Filepath '${_logFolderPath}' is existed!`)) : null;
    }
  }

});

// https://moment.github.io/luxon/#/formatting?id=table-of-tokens
const DateString = (fmt: string = 'yyyy/LL/dd HH:mm:ss') => {
  return DateTime.now().toFormat(fmt);
};

type LoggerType = 'Loaded' | 'Test' | 'Dev' | 'Error' | 'Warn' | String;
interface Options {
  isPrint?: boolean;
  execTime?: number;
  payload?: any;
}
@Singleton
class _Logger {
  // https://refactoring.guru/design-patterns/singleton/typescript/example
  private static instance: _Logger;
  /**
   * The static method that controls the access to the singleton instance.
   *
   * This implementation let you subclass the Singleton class while keeping
   * just one instance of each subclass around.
   */
  public static getInstance: () => _Logger
  /**
   * The Singleton's constructor should always be private to prevent direct
   * construction calls with the `new` operator.
   */

  private _logPath;
  private constructor() {
    Main.isLogByFIle$.asObservable().subscribe(isLogByFIle => {
      if (!!isLogByFIle) this.init();
    });
    // this.init();
  }
  private init() {

    if (envType == 'nodejs') {
      var fs = require('fs');
      var path = require('path');
      this._logPath = path.resolve(
        `${_logFolderPath}/${DateString('yyyy.LL.dd.HH.mm.ss')}.log`
      );
      fs.writeFileSync(this._logPath, `Log file open, ${DateString()}`, {
        encoding: 'utf-8',
      });
    }
  };


  private _baseHandler({ _str, options }: { _str: string; options: Options }) {
    // let _str, options;
    if (!!options) {
      const isOptionsProp = (prop: 'isPrint' | 'execTime' | 'payload') =>
        options.hasOwnProperty(prop);
      if (!isOptionsProp('isPrint')) {
        options['isPrint'] = true;
      }
      if (isOptionsProp('execTime')) {
        _str += chalk.italic.yellow(` +${options['execTime']}ms`);
      }
      // if (isOptionsProp('payload')) {
      //   _str += `\n${JSON.stringify(options['payload'])}`;
      // }

      if (!!options['isPrint'] && envType == 'nodejs') {
        if (isOptionsProp('payload')) {
          log(_str, " payload:\n", options['payload']);
        } else {
          log(_str);
        }
      }
    }

    if (!!Main.isLogByFIle$.value && envType == 'nodejs') {
      var fs = require('fs');
      let _logsData = fs.readFileSync(this._logPath, { encoding: 'utf-8' });
      let _payload = `${_logsData}\n${stripAnsi(_str)}`;
      fs.writeFileSync(this._logPath, _payload, { encoding: 'utf-8' });
    }
    return { _str, options };
  }

  private _processId: number | '' = process.pid || '';

  public log(
    type: LoggerType,
    message: string,
    options: Options = { isPrint: true }
  ): void | { _str: string; options: Options } {
    let _str = `${chalk.green(
      `[Nrwl] ${this._processId} - `
    )}${DateString()}  ${chalk.yellow.bold(`[${type}]`)} ${chalk.green(
      message
    )}`;
    ({ _str, options } = this._baseHandler({ _str, options }));
    if (envType == 'browser') {
      return { _str, options };
    }
  }

  public error(
    type: LoggerType,
    message: string,
    options: Options = { isPrint: true }
  ): void | { _str: string; options: Options } {
    let _str = `${chalk.green(
      `[Nrwl] ${this._processId} - `
    )}${DateString()}  ${error(`[${type}] ${message}`)}`;
    ({ _str, options } = this._baseHandler({ _str, options }));
    if (envType == 'browser') {
      return { _str, options };
    }
  }
  public warn(
    type: LoggerType,
    message: string,
    options: Options = { isPrint: true }
  ): void | { _str: string; options: Options } {
    let _str = `${chalk.green(
      `[Nrwl] ${this._processId} - `
    )}${DateString()}  ${warn(`[${type}] ${message}`)}`;
    ({ _str, options } = this._baseHandler({ _str, options }));
    if (envType == 'browser') {
      return { _str, options };
    }
  }

  // public trace
}
const Logger = _Logger.getInstance();

export { Logger, DateString };
