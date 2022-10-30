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
}
interface Options {
    phrases: Phrase;
    dictionary?: PhraseDictionary | undefined;
    lowercase?: boolean;
    replaceDashes: boolean;
    replaceAccents?: boolean;
}
export declare function phraseMatcher(options: Options): (tree: any, file: any) => void;
export declare function buildDictionary(options: Options): PhraseDictionary;
export {};
