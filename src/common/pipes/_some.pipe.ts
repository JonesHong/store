import { BehaviorSubject, filter, pipe } from "rxjs"
import { Settlement } from "../interface/store.interface";

// export const SettlementChanged = (settlement$?: BehaviorSubject<Settlement>) => {
export const SettlementChanged = () => {
    return pipe(
        filter((settlement: Settlement) => {
            let conditions = !!settlement && !!settlement['lastSettlement']['isChanged']
            // &&   (settlement$.value['_currentHash'] !== settlement['_currentHash']);
            return conditions;
        })
    )
}