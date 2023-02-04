import { LastSettlement } from "./adapter.interface";

export type Settlement = {
    reducerName: string;
    _previousHash: string;
    _currentHash: string;
    lastSettlement: LastSettlement<any>;
}