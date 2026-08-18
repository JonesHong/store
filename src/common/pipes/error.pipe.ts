import { Observable, of, pipe, UnaryFunction } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { Action, ErrorResponse } from '../action';
import { envType } from '../env_checker';
import { Logger } from '../logger';

// export const ErrorHandelPipe: (event: Action) => UnaryFunction<Observable<Action>, Observable<Action | ErrorResponse>> = (event:Action) => {
//     return pipe(
//         catchError(err => {
//             return of(new ErrorResponse({ "failedAction": event, error: err }))
//         })
//     )
// }

export const ErrorHandelPipe: <T extends Action>(
  event: T,
  fromDir: string
) => UnaryFunction<Observable<any>, Observable<T | ErrorResponse>> = (
  event,
  fromDir?: string
) => {
  return pipe(
    catchError((err: string) => {
      const _logger = Logger.error(
        'ErrorHandelPipe',
        `fromDir: ${fromDir} / ${err}`
      );
      if (envType == 'browser') console.error(_logger['_str']);
      return of(
        new ErrorResponse({ failedAction: event, error: err, fromDir })
      );
    })
  );
};
