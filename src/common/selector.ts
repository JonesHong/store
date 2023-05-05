import { Bloc } from '@felangel/bloc';
import * as _ from 'lodash';
import { asapScheduler, combineLatest, Observable, Subscription, zip } from 'rxjs';
import { filter, map, mergeMap, tap } from 'rxjs/operators';
import { inspect } from 'util';
import { Entity } from './entity';
import { envType } from './env_checker';
import { Settlement } from './interface/store.interface';
import { Logger } from './logger';
import { Main } from './main';

export function createFeatureSelector<T>(featureName: string): Observable<T> {
  let stream$: Observable<T> = new Observable((observer) => {
    let subscription: Subscription = new Subscription();
    const subscribeReducer = (reducer: Bloc<any, any>) => {
      observer.next(reducer.state);
      subscription.add(
        reducer.listen((res) => {
          let newRes = _.cloneDeep(res);
          observer.next(newRes);
        })
      );
    };
    if (!this.Store['_reducers'][featureName]) {
      let _logger = Logger.error(
        'createFeatureSelector',
        `Can't find the name ${featureName} of reducer in Store.`,
        { isPrint: Main.printMode !== "none" }
      );
      if (envType == 'browser' && _logger['options']['isPrint'])
        console.error(_logger['_str']);

    } else {
      subscribeReducer(this.Store['_reducers'][featureName]);
    }
    return {
      unsubscribe: () => {
        subscription.unsubscribe();
      },
    };
  });

  return stream$;
}

export function createRelationSelector<T>(featureName: string): Observable<T> {
  let stream$: Observable<T> = new Observable((observer) => {
    let subscription: Subscription = new Subscription();
    if (!this.Store['_reducers'][featureName]) {
      let _logger = Logger.error(
        'createFeatureSelector',
        `Can't find the name ${featureName} of reducer in Store.`,
        { isPrint: Main.printMode !== "none" }
      );
      if (envType == 'browser' && _logger['options']['isPrint'])
        console.error(_logger['_str']);
    } else {
      // 第一次
      observer.next(this.Store['withRelation'][featureName]);
      let withRelationSub = this.Store['withRelation$']
        .pipe(
        // filter(withRelation => !!withRelation && !!withRelation['_']['settlement'] && withRelation['_']['settlement']['reducerName'] == featureName),
      )
        .subscribe(withRelation => {
          observer.next(withRelation[featureName]);
        })
      subscription.add(withRelationSub)
    }
    return {
      unsubscribe: () => {
        subscription.unsubscribe();
      },
    };
  });

  return stream$;
}

type Result = (s1?, s2?, s3?, s4?, s5?, s6?) => any;

export const createSelector = (
  streams: Observable<any>[],
  resultFunc: Result
): Observable<any> => {
  return combineLatest(streams).pipe(
    map((streamList) => {
      let options = {};
      return resultFunc(...streamList, options);
    })
  );
};


export const selectRelevanceEntity = (
  state,
  parameter: { key: string; value: any }
) => {
  let entities: Entity[] = Object.keys(state['entities']).map((key) => state['entities'][key]);
  let payload = [];
  entities.map((entity) => {
    if (!!!entity[parameter['key']]) {

      let _logger = Logger.warn(
        `selectRelevanceEntity<${entity['id']}>`,
        `There is no ${parameter['key']} in this entity(${entity['_name']}).`,
        { isPrint: Main.printMode !== "none" }
      );
      if (envType == 'browser' && _logger['options']['isPrint'])
        console.warn(_logger['_str']);
    }

    let typeofParameterKey = typeof entity[parameter['key']];

    switch (typeofParameterKey) {
      case 'string':
        if (entity[parameter['key']] == parameter['value']) {
          payload.push(entity);
        }
        break;
      case 'object':
        if (Array.isArray(entity[parameter['key']])) {
          // let parameterIdList;
          // const includesObj = (element) => typeof element === 'object';

          // entityValue[parameter['key']].some(includesObj)
          //   ? (parameterIdList = entityValue[parameter['key']].map(
          //     (entity) => entity.id
          //   ))
          //   : (parameterIdList = entityValue[parameter['key']]);
          // parameterIdList.map((item) => {
          //   switch (typeof item) {
          //     case 'string':
          //       if (item == parameter['value']) {
          //         payload.push(entityValue);
          //       }
          //       break;
          //     default:
          //       Logger.error(
          //         'selectRelevanceEntity',
          //         `There doesn't handle type(${typeof item}).\n${entityValue[parameter['key']]
          //         }\n`
          //       );
          //       // console.error(
          //       //   `[Error/selectRelevanceEntity] There doesn't handle type(${typeof item}).\n${entityValue[parameter['key']]
          //       //   }\n`
          //       // );
          //       break;
          //   }
          // });
        } else {
          // if (entityValue[parameter['key']].id == parameter['value']) {
          //   payload.push(entityValue);
          // }
        }
        break;
      case "undefined":
        break
      default:
        let _logger = Logger.error(
          'selectRelevanceEntity',
          `There doesn't handle type(${typeofParameterKey}).\n${inspect(entity[parameter['key']], { "depth": 1 })}\n`,
          { isPrint: Main.printMode !== "none" }
        );
        if (envType == 'browser' && _logger['options']['isPrint'])
          console.error(_logger['_str']);
        break;
    }
  });
  return payload;
};

/**
 * 
 * 適用於舊版的 relationConfigOptions，
 * 重新架 RelationConfigTable以後這段將被棄用
 * @param state 
 * @param parameter 
 * @returns 
 */
export const selectSourceRelevanceEntity = (
  state,
  parameter: { key: string; value: any }
) => {
  let entities: [string, {}][] = Object.entries(state['entities']);
  let payload = [];

  entities.map((entity) => {
    let entityId = entity[0], // e.g.: "u-1"
      entityValue = entity[1]; // e.g.: {id:"u-1", name:"Jones"}
    if (!!!parameter['value'][parameter['key']]) {
      console.warn(
        `[Error/selectRelevanceEntity<${entity[0]}>] There is no ${parameter['key']} in this entity.`
      );

      parameter['key'] = parameter['key'].substring(0, parameter['key'].length - 2);
      if (!!!parameter['value'][parameter['key']]) return;
    }

    let typeofParameterKey = typeof parameter['value'][parameter['key']];

    switch (typeofParameterKey) {
      case 'string':
        if (parameter['value'][parameter['key']] == entityId) {
          payload.push(entityValue);
        }
        if (
          typeof parameter['value'] == 'object' &&
          parameter['value'][parameter['key']] == entityId
        )
          payload.push(entityValue);
        break;
      case 'object':
        if (Array.isArray(parameter['value'][parameter['key']])) {
          // await Promise.all(
          let parmeterIdList;
          const includesObj = (element) => typeof element === 'object';

          parameter['value'][parameter['key']].some(includesObj) ?
            (parmeterIdList = parameter['value'][parameter['key']].map((entity) => entity.id)) :
            (parmeterIdList = parameter['value'][parameter['key']]);

          parmeterIdList.map((item) => {
            switch (typeof item) {
              case 'string':
                if (item == entityId) {
                  payload.push(entityValue);
                }
                break;
              default:
                console.error(
                  `[Error/selectRelevanceEntity] There doesn't handle type(${typeof item}).\n${parameter['value'][parameter['key']]
                  }\n`
                );
                break;
            }
          });
          // )
        } else {
          if (parameter['value'][parameter['key']].id == entityId) {
            payload.push(entityValue);
            // console.log(123, payload, entityValue)
          }
          // console.error(
          //   `[Error/selectRelevanceEntity] There doesn't handle type(${typeofParameterKey}).\n${
          //     parameter['value'][parameter['key']]
          //   }\n`
          // );
        }
        break;
      // case "undefined":
      //   break
      default:
        console.error(
          `[Error/selectRelevanceEntity] There doesn't handle type(${typeofParameterKey}).\n${parameter['value'][parameter['key']]
          }\n`
        );
        break;
    }
  });
  // );
  return payload;
};
