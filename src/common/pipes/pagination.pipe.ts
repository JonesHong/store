import * as _ from "lodash"
import { from, pipe, range } from "rxjs"
import { filter, map, mapTo, mergeMap, tap } from "rxjs/operators";
import { EntityState } from "../adapter"


/**
 * 待測試
 * @param socket  
 * @returns 
 */
export const ReducerAllPaginationSocketPipe = (socket: WebSocket) => {
    let _pageMax = 0, _limit = 300;
    // socket.send()
    return pipe(
        mergeMap((state: EntityState<any>) => {
            _pageMax = _.ceil(_.divide(state['ids'].length, _limit));
            // if (state['ids'].length % _limit !== 0) _pageMax += 1;
            return range(1, _pageMax).
                pipe(
                    mapTo(state),
                    ReducerPaginationPipe({ "limit": _limit }),
                    tap((statePagination: any) => {
                        socket.send(statePagination)
                    })
                )
        })
    )
}

export const ReducerPaginationPipe = ({ limit, offset = 0 }) => {
    return pipe(
        map((state: EntityState<any>) => {
            let _payload = _.cloneDeep(state);
            // handle other property
            // let _entriesPayload = Object.entries(_payload).filter(entry => {
            //     let _key = entry[0], _val = entry[1];
            //     return _key !== "ids" && _key !== "entities"
            // });
            _payload['ids'] = _payload['ids'].filter((id, index) => {
                if (offset < index && index <= _.add(limit, offset)) {
                    return true;
                }
                else {
                    delete _payload['entities'][id];
                    // handle other property
                    // _entriesPayload.map(entry => {
                    //     let _key = entry[0], _val = entry[1];
                    //     if (Array.isArray(_val)) {
                    //         _payload[_key] = _val.filter(item => item['id'] !== id);
                    //     }
                    //     else if (typeof (_val) == "object" && !!_payload[_key][id]) {
                    //         delete _payload[_key][id];
                    //     }
                    // })
                    return false;
                }
            })
            return _payload;
        })
    )
}