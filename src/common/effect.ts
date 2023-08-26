import { from, Observable, of, pipe, Subscription, throwError } from 'rxjs';
import { filter, map, mergeMap, tap } from 'rxjs/operators';
import { Action } from './action';


type SourceAction = () => Observable<Action>;
type SourceAny = () => Observable<any>;
type Source = () => Observable<Action | any>;
interface Config {
    dispatch: boolean;
    // effectName?: string
}
interface ConfigWithDispatch extends Config {
    dispatch: true
}
interface ConfigWithKeep extends Config {
    dispatch: false
}
export type Effect<T = any> = Observable<T>;
// Overloads
function createEffect(source: SourceAction, config?: ConfigWithDispatch): Effect<Action>;
function createEffect(source: SourceAny, config: ConfigWithKeep): Effect<any>;
// Actual implementation
function createEffect(source: Source, config: Config = { dispatch: true }): Effect {
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
        map(result => {
            return { result, config };
        })
    );
};

export { createEffect }
export const ofType = <T extends Action>(...allowedTypes: string[]) => {
    return pipe(
        filter((action: Action) => !!action),
        mergeMap((action: Action) => {
            return from(allowedTypes)
                .pipe(
                    filter(type => action['type'] == type),
                    map(() => action as T)
                )
        }),
    )
}