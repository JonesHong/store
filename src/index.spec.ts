import test from 'ava';

import * as mycenaStore from './index';

// 這些符號是套件的公開進入點；任一為 undefined 代表 build 產物缺件、
// export 鏈斷掉、或循環依賴讓模組在初始化期就拿到空值。
const EXPECTED_CLASSES = [
  'Store',
  'Action',
  'Entity',
  'Reducer',
  'Broker',
  'CQRS',
] as const;

const EXPECTED_FACTORIES = [
  'createEntityAdapter',
  'createSelector',
  'ofType',
] as const;

test('公開進入點可被載入且非空', (t) => {
  t.truthy(mycenaStore);
  t.true(Object.keys(mycenaStore).length > 0);
});

EXPECTED_CLASSES.forEach((name) => {
  test(`export ${name} 是 constructor`, (t) => {
    t.is(typeof (mycenaStore as Record<string, unknown>)[name], 'function');
  });
});

EXPECTED_FACTORIES.forEach((name) => {
  test(`export ${name} 是 function`, (t) => {
    t.is(typeof (mycenaStore as Record<string, unknown>)[name], 'function');
  });
});
