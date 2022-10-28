interface Match {
    [key: string]: string;
}
interface MatchDictionary {
    base: any;
    check: any;
    failurelink: any;
    output: any;
}
interface Options {
    phrases: Match;
    dictionary?: MatchDictionary | undefined;
    lowercase?: boolean;
    replaceDashes: boolean;
    replaceAccents?: boolean;
}
export declare function phraseMatcher(options: Options): (tree: any, file: any) => void;
export declare function buildDictionary(options: Options): MatchDictionary;
export {};
