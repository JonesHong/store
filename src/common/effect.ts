import { from, Observable, of, pipe, Subscription, throwError } from 'rxjs';
import { filter, map, mergeMap, tap } from 'rxjs/operators';

import { Action } from './action';

type SourceAction<T extends Action> = () => Observable<T | T[]>;
type SourceAny = () => Observable<any | any[]>;
type Source<T extends Action> = () => Observable<T | any | T[] | any[]>;
interface Config {
  dispatch: boolean;
  // effectName?: string
}
interface ConfigWithDispatch extends Config {
  dispatch: true;
}
interface ConfigWithKeep extends Config {
  dispatch: false;
}
export type Effect<R = any> = Observable<R | R[]>;
// Overloads
function createEffect<S extends Action>(
  source: SourceAction<S>,
  config?: ConfigWithDispatch
): Effect<S | S[]>;
function createEffect(
  source: SourceAny,
  config: ConfigWithKeep
): Effect<any | any[]>;
// Actual implementation
function createEffect<S extends Action>(
  source: Source<S>,
  config: Config = { dispatch: true }
): Effect {
  // if (config.dispatch) {
  //     return from(source()).pipe(
  //         map(result => {
  //             if (!(result instanceof Action)) {
  //                 throw new Error('Expected an Action when dispatch is true.');
  //             }
  //             return { result, config };
  //         })
  //     );
  // }
  return from(source()).pipe(
    map((result) => {
      return { result, config };
    })
  );
}

export { createEffect };
export const ofType = <T extends Action>(...allowedTypes: string[]) => {
  return pipe(
    filter((action: Action) => !!action),
    mergeMap((action: Action) => {
      return from(allowedTypes).pipe(
        filter((type) => action['type'] == type),
        map(() => action as T)
      );
    })
  );
};
