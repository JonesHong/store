
import { customAlphabet } from 'nanoid/non-secure'
const nanoid = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ', 10);

export const v4Generator = () => nanoid(32).split("").reduce((acc, curr, index) => {
    if (index === 8 || index === 13 || index === 18 || index === 23) curr = `-${curr}`;
    return acc += curr
}, "")