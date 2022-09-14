// // import { FixedSizeArray } from 'fixed-size-array';
// // import { add, multiply, subtract } from 'mathjs';
// import { DateTime } from 'luxon';
// import { catchError, fromEvent, interval, of } from 'rxjs';
// import * as _ from 'lodash';
// import { createClient, RedisClientOptions, RedisClientType, RedisDefaultModules, RedisModules, RedisScripts } from 'redis';


// export type RedisType = RedisClientType<RedisDefaultModules & RedisModules, RedisScripts>;
// export type RedisOptions = RedisClientOptions<RedisModules, RedisScripts>;
// /**
//  * 參考 NestJs的 Caching  
//  * * https://docs.nestjs.com/techniques/caching  
//  *   
//  * 參考 Redis  
//  * * https://redis.io/documentation
//  * * https://www.runoob.com/redis/redis-commands.html
//  */
// export class Cache {
//     private _name = "CacheService";
//     private _formatStr = "yyyy/MM/dd HH:mm:ss.SSS";
//     private static _instance: Cache;
//     public static get instance(): Cache {
//         if (!Cache._instance) {
//             Cache._instance = new Cache();
//         }
//         return Cache._instance;
//     }
//     private _maxConfig = {
//         "_eventsLogSize": 1000,
//         "_settlementsLogSize": 100,
//     };

//     public get name(): string {
//         return this._name;
//     }
//     public get maxConfig() {
//         return this._maxConfig
//     }
//     private _Redis: RedisType;
//     public async createRedis(options?: RedisOptions) {
//         this._Redis = createClient(options);
//         await this._Redis.connect();
//         // console.log()
//         fromEvent(this._Redis, "error")
//             .pipe(
//                 catchError(err => of(err))
//             )
//             .subscribe(error => {
//                 console.error(error);
//             });
//     }
//     public get Redis() {
//         return this._Redis;
//     }


// }

// export const CacheService = Cache.instance;
