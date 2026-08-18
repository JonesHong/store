import { readdirSync } from 'fs';

import { JSONFile, Low } from 'lowdb';
import { DateTime } from 'luxon';
import { BehaviorSubject } from 'rxjs';

import { Logger } from '../common/logger';

import { isFilePathExist, isFolderPathExist } from './fs_extandtion';

// https://github.com/typicode/lowdb/tree/v1.0.0

// import { JSONFile } from "lowdb/node";

// import FileSync from 'lowdb/adapters/FileSync';

const service_name = 'LowDBManager';

class _LowDBManager {
  // https://refactoring.guru/design-patterns/singleton/typescript/example
  private static instance: _LowDBManager;
  //simplified store (is it worth?)
  private _store = new BehaviorSubject({});
  private _entityDBManager: { [key: string]: any } = {};
  private _pathManager: { [key: string]: string } = {};
  private _dbFolderPath = './db';
  private _todayFolder = `${this._dbFolderPath}/${DateTime.now().toFormat(
    'yyyy_LL_dd'
  )}`;
  /**
   * The Singleton's constructor should always be private to prevent direct
   * construction calls with the `new` operator.
   */
  private constructor() {}

  /**
   * The static method that controls the access to the singleton instance.
   *
   * This implementation let you subclass the Singleton class while keeping
   * just one instance of each subclass around.
   */
  public static getInstance(): _LowDBManager {
    if (!_LowDBManager.instance) {
      _LowDBManager.instance = new _LowDBManager();
    }

    return _LowDBManager.instance;
  }

  initialDB() {
    isFolderPathExist(this._dbFolderPath);
    isFolderPathExist(this._todayFolder);
    const _beforeExec = DateTime.now();
    try {
      const files = readdirSync(this._todayFolder);
      for (const file of files) {
        const _jsonRegrx = new RegExp('.json');
        if (_jsonRegrx.test(file)) {
          const name = file.replace(_jsonRegrx, '');
          this.createDB({ name });
        }
        // this._pathManager[file.replace(".json", "")] = `${this._todayFolder}/${file}`;
        // this.addDB()
        console.log(file);
      }
      const _afterExec = DateTime.now();
      const execTime = _afterExec.diff(_beforeExec, 'milliseconds').toMillis();

      Logger.log(service_name, `initalDB:`, { execTime, payload: files });
    } catch (err) {
      const _afterExec = DateTime.now();
      const execTime = _afterExec.diff(_beforeExec, 'milliseconds').toMillis();

      Logger.error(service_name, `initalDB Error:`, { execTime, payload: err });
    }

    const _afterExec = DateTime.now();
    const execTime = _afterExec.diff(_beforeExec, 'milliseconds').toMillis();

    Logger.log(service_name, `initialDB:`, { execTime });
  }

  public createDB({ name }: { name: string }) {
    if (name !== name.toLowerCase()) {
      name = name.split('').reduce((acc, curr, index) => {
        if (curr !== curr.toLowerCase()) {
          if (index !== 0) acc += '_';
          curr = curr.toLowerCase();
        }
        acc += curr;
        return acc;
      }, '');
    }
    if (Object.prototype.hasOwnProperty.call(this._entityDBManager, name)) {
      Logger.warn(service_name, `_entityDBManager.${name} is existed!`);
      return this._entityDBManager[name];
    }
    const _path = `${this._todayFolder}/${name}.json`;
    // isFolderPathExist(name);
    isFilePathExist(_path, '{}', { encoding: 'utf-8' });

    const adapter = new JSONFile(_path);
    const db = new Low(adapter, null);
    this._entityDBManager[name] = db;
    this._pathManager[name] = _path;

    return db;
  }
}
const LowDBManager = _LowDBManager.getInstance();

// LowDBManager.createDB({ name: "LunarCalendarAAAA" })

export { LowDBManager };
