// import { existsSync, mkdirSync, WriteFileOptions, writeFileSync } from "fs";

// var fs = require("fs");
import { WriteFileOptions } from 'fs';

import { DateTime } from 'luxon';

import { envType } from '../common/env_checker';
import { Logger } from '../common/logger';
const service_name = 'fs_extandtion';
const isFolderPathExist = (folderPath): boolean => {
  if (envType !== 'nodejs') return;
  const fs = require('fs');

  const _payload = fs.existsSync(folderPath);
  const _beforeExec = DateTime.now();
  if (!_payload) {
    fs.mkdirSync(folderPath);
    const _afterExec = DateTime.now();
    const execTime = _afterExec.diff(_beforeExec, 'milliseconds').toMillis();
    Logger.log(service_name, `Create '${folderPath}'!`, { execTime });
  } else {
    const _afterExec = DateTime.now();
    const execTime = _afterExec.diff(_beforeExec, 'milliseconds').toMillis();
    Logger.warn(service_name, `FolderPath '${folderPath}' is existed!`, {
      execTime,
    });
  }
  return _payload;
};

// if(envType == "nodejs")
// import fs = require("fs");
// type WriteFileOptions = fs.WriteFileOptions
const isFilePathExist = (
  filePath,
  data: any,
  options?: WriteFileOptions
): boolean => {
  if (envType !== 'nodejs') return;
  const fs = require('fs');
  const _payload = fs.existsSync(filePath);
  const _beforeExec = DateTime.now();
  if (!_payload) {
    fs.writeFileSync(filePath, data, options);
    const _afterExec = DateTime.now();
    const execTime = _afterExec.diff(_beforeExec, 'milliseconds').toMillis();
    Logger.log(service_name, `Create '${filePath}'!`, { execTime });
  } else {
    const _afterExec = DateTime.now();
    const execTime = _afterExec.diff(_beforeExec, 'milliseconds').toMillis();
    Logger.warn(service_name, `FilePath '${filePath}' is existed!`, {
      execTime,
    });
  }
  return _payload;
};

export { isFolderPathExist, isFilePathExist };
