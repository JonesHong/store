// import { existsSync, mkdirSync, WriteFileOptions, writeFileSync } from "file-system";

// var fs = require("file-system");
import { DateTime } from "luxon";
import { envType } from "../common/env_checker";
import { Logger } from "../common/logger";
const service_name: String = "fs_extandtion";
const isFolderPathExist = (folderPath): boolean => {
    if (envType !== "nodejs") return;
    var fs = require("file-system");

    let _payload = fs.existsSync(folderPath);
    let _beforeExec = DateTime.now();
    if (!_payload) {
        fs.mkdirSync(folderPath);
        let _afterExec = DateTime.now();
        let execTime = _afterExec.diff(_beforeExec, "milliseconds").toMillis();
        Logger.log(service_name, `Create '${folderPath}'!`, { execTime });
    } else {
        let _afterExec = DateTime.now();
        let execTime = _afterExec.diff(_beforeExec, "milliseconds").toMillis();
        Logger.warn(service_name, `FolderPath '${folderPath}' is existed!`, { execTime })
    }
    return _payload;
};

import { WriteFileOptions } from "node:fs";
// if(envType == "nodejs")
// import fs = require("file-system");
// type WriteFileOptions = fs.WriteFileOptions
const isFilePathExist = (filePath, data: any, options?: WriteFileOptions): boolean => {
    if (envType !== "nodejs") return;
    var fs = require("file-system");
    let _payload = fs.existsSync(filePath);
    let _beforeExec = DateTime.now();
    if (!_payload) {
        fs.writeFileSync(filePath, data, options);
        let _afterExec = DateTime.now();
        let execTime = _afterExec.diff(_beforeExec, "milliseconds").toMillis();
        Logger.log(service_name, `Create '${filePath}'!`, { execTime });
    } else {
        let _afterExec = DateTime.now();
        let execTime = _afterExec.diff(_beforeExec, "milliseconds").toMillis();
        Logger.warn(service_name, `FilePath '${filePath}' is existed!`, { execTime })
    }
    return _payload;
};

export {
    isFolderPathExist,
    isFilePathExist
}