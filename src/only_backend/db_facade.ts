import { readdirSync, writeFileSync } from 'fs';
import { DateTime } from 'luxon';
import { BehaviorSubject } from 'rxjs';
import { isFilePathExist, isFolderPathExist } from './fs_extandtion';
import { Logger } from '../common/logger';

// https://github.com/typicode/lowdb/tree/v1.0.0
import { JSONFile, Low } from 'lowdb';
// import FileSync from 'lowdb/adapters/FileSync';

const service_name: string = "LowDBManager";

class _LowDBManager {
    // https://refactoring.guru/design-patterns/singleton/typescript/example
    private static instance: _LowDBManager;
    //simplified store (is it worth?)
    private _store = new BehaviorSubject({});
    private _entityDBManager: { [key: string]: any } = {};
    private _pathManager: { [key: string]: string } = {};
    private _dbFolderPath = './db';
    private _todayFolder = `${this._dbFolderPath}/${DateTime.now().toFormat("yyyy_LL_dd")}`;
    /**
     * The Singleton's constructor should always be private to prevent direct
     * construction calls with the `new` operator.
     */
    private constructor() {
        isFolderPathExist(this._dbFolderPath);
        isFolderPathExist(this._todayFolder);
        this._initalDB();
    }

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

    private _initalDB() {
        let _beforeExec = DateTime.now();
        try {
            const files = readdirSync(this._todayFolder);
            for (const file of files) {
                let _jsonRegrx = new RegExp(".json")
                if (_jsonRegrx.test(file)) {
                    let name = file.replace(_jsonRegrx, "");
                    this.createDB({ name });
                }
                // this._pathManager[file.replace(".json", "")] = `${this._todayFolder}/${file}`;
                // this.addDB()
                console.log(file);
            }
            let _afterExec = DateTime.now();
            let execTime = _afterExec.diff(_beforeExec, "milliseconds").toMillis();

            Logger.log(service_name, `initalDB:`, { execTime, payload: files });
        } catch (err) {
            let _afterExec = DateTime.now();
            let execTime = _afterExec.diff(_beforeExec, "milliseconds").toMillis();

            Logger.error(service_name, `initalDB Error:`, { execTime, payload: err });
        }



        let _afterExec = DateTime.now();
        let execTime = _afterExec.diff(_beforeExec, "milliseconds").toMillis();

        Logger.log(service_name, `initalDB:`, { execTime });

    }

    public createDB({ name }: { name: string }) {
        if (name !== name.toLowerCase()) {
            name = name.split("").reduce((acc, curr, index) => {
                if (curr !== curr.toLowerCase()) {
                    if (index !== 0) acc += '_';
                    curr = curr.toLowerCase();
                }
                acc += curr;
                return acc;
            }, "")
        }
        if (this._entityDBManager.hasOwnProperty(name)) {
            Logger.warn(service_name, `_entityDBManager.${name} is existed!`)
            return this._entityDBManager[name];
        }
        let _path = `${this._todayFolder}/${name}.json`;
        // isFolderPathExist(name);
        isFilePathExist(_path, '{}', { encoding: "utf-8" });

        const adapter = new JSONFile(_path);
        const db = new Low(adapter);
        this._entityDBManager[name] = db;
        this._pathManager[name] = _path;

        return db;
    }
}
const LowDBManager = _LowDBManager.getInstance();

// LowDBManager.createDB({ name: "LunarCalendarAAAA" })

export { LowDBManager };