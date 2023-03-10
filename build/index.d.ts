import type { Root } from 'nlcst';
interface PhraseMetadata {
    label?: string;
    code?: string;
    normalizedValue?: string;
}
interface Phrase {
    [key: string]: PhraseMetadata;
}
interface PhraseDictionary {
    base: any;
    check: any;
    failurelink: any;
    output: any;
    match: Function;
}
interface Match {
    match: string;
    start: number;
    end: number;
    label?: string;
    code?: string;
}
interface Options {
    phrases: Phrase;
    dictionary?: PhraseDictionary | undefined;
    lowercase?: boolean;
    normalize?: boolean;
}
export declare function PhraseMatcher(...matchers: Matcher[]): any;
export declare class Matcher {
    lowercase?: boolean;
    normalize?: boolean;
    phraseObjs: Phrase;
    phraseKeys: string[];
    phraseNormalized: string[];
    dictionary: PhraseDictionary;
    constructor(options: Options);
    match(tree: Root): Match[];
    private processText;
    private processTextArray;
    private replaceWithSpace;
    private buildDictionary;
    private getWordsFromTree;
    private extendTextNodeChildren;
    private getWordNodesFromTree;
    private getWordsFromText;
    private getWordNodesFromText;
    private isFullWordMatch;
    private getFullMatchData;
    private getNormalizedValue;
    private buildMatchData;
    private findObjByNormalizedValue;
}
declare type sortArg<T> = keyof T | `-${string & keyof T}`;
/**
 * Returns a comparator for objects of type T that can be used by sort
 * functions, were T objects are compared by the specified T properties.
 *
 * @param sortBy - the names of the properties to sort by, in precedence order.
 *                 Prefix any name with `-` to sort it in descending order.
 */
export declare function byPropertiesOf<T extends object>(sortBy: Array<sortArg<T>>): (obj1: T, obj2: T) => number;
/**
 * Sorts an array of T by the specified properties of T.
 *
 * @param arr - the array to be sorted, all of the same type T
 * @param sortBy - the names of the properties to sort by, in precedence order.
 *                 Prefix any name with `-` to sort it in descending order.
 */
export declare function sort<T extends object>(arr: T[], ...sortBy: Array<sortArg<T>>): void;
export {};
