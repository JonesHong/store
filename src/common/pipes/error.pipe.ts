import { Observable, of, pipe, UnaryFunction } from "rxjs"
import { catchError } from "rxjs/operators"
import { Action, ErrorResponse } from "../action"

export const ErrorHandelPipe: (event: Action) => UnaryFunction<Observable<Action>, Observable<Action>> = (event: Action) => {
    return pipe(
        catchError(err => {
            return of(new ErrorResponse({ "failedAction": event, error: err }))
        })
    )
}