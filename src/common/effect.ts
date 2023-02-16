import { from, Observable, of, pipe, Subscription, throwError } from 'rxjs';
import { filter, map, mergeMap, tap } from 'rxjs/operators';
import { Action } from './action';


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
export type Effect = Observable<any>;
function createEffect(source: () => Observable<Action>, config?: ConfigWithDispatch): Effect;
function createEffect(source: () => Observable<any>, config: ConfigWithKeep): Effect;
function createEffect(source: Source, config: Config = { dispatch: true }) {
    return from(source()).pipe(
        map(sourceFun => {
            return { sourceFun, config }
        }),
    )
};

export { createEffect }
export const ofType = (...allowedTypes: string[]) => {
    return pipe(
        filter(Action => !!Action),
        mergeMap((Action: Action) => {
            return from(allowedTypes)
                .pipe(
                    filter(type => Action['type'] == type),
                    map(() => Action)
                )
        }),
    )
}