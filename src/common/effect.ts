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
    // let _source, _config;
    // if (!!config['dispatch']) {
    //     _source = source as Observable<Action>
    // // }
    return from(source()).pipe(
        map(sourceFun => {
            return { sourceFun, config }
        }),
        // filter(res => {
        //     console.log(683496, res)
        //     return !!config['dispatch']
        // }),

        // map
        //     map(res => {
        //         // if (dispatch) {
        //         //     return res
        //         // }
        //         // return 1
        //         return res
        //     })
    )
};

export { createEffect }
export const ofType = (...allowedTypes: string[]) => {
    return pipe(
        filter(Action => !!Action),
        mergeMap((Action: Action) => {
            return from(allowedTypes)
                .pipe(
                    filter(type => {
                        // console.log(3333333355555, Action, type)
                        return Action['type'] == type
                    }),
                    map(type => {
                        // console.log()
                        // Action.addTraversal(`${}`)
                        return Action
                    })
                )
        }),
    )
}