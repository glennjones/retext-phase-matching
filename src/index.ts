import { visit, SKIP } from 'unist-util-visit';
import { toString } from 'nlcst-to-string';
import { ParseEnglish } from 'parse-english';
import AhoCorasick from 'aho-corasick-node';
import RemoveAccents from 'remove-accents';


interface Match { 
    [key: string]: string 
}

// basic dictionary - based on aho-corasick-node export
interface MatchDictionary {
    base: any
    check: any
    failurelink: any
    output: any
}

interface Options {
    phrases: Match
    dictionary?: MatchDictionary | undefined
    lowercase?: boolean
    replaceDashes: boolean
    replaceAccents?: boolean
}

const defaults: Options = {
    phrases: {},
    dictionary: undefined,
    lowercase: false,
    replaceDashes: false,
    replaceAccents: false,
}

let ahocorasick: any = undefined;

export function phraseMatcher(options: Options) {

    if(options.phrases === undefined){
        throw new Error('Can not find matches without a phrases object')
    }
    const config = Object.assign(defaults, options);
    if(config.dictionary === undefined){
        ahocorasick = createAhoCorasickObj(config);
    }else{
        ahocorasick = AhoCorasick.from(config.dictionary);
    }


    return (tree: any, file: any) => {

        if(!file.data){
            file.data = {}
        }
        if(!file.data.matched){
            file.data.matched = [] as Match[]
        }

        const words = processTextArray(getWordsFromTree(tree, options), options);
        const text = words.join(' ');
        
        /*
        const keys = Object.keys(config.phrases)
        keys.forEach((key: string) => {
            if(str.indexOf(key as string) > -1){
                file.data.matched.push(config.phrases[key]);
            }
        })
        */
       const foundMatches = ahocorasick.match(text);
       file.data.matched = foundMatches.filter((phrase: string) => {
            return isFullWordMatch(phrase, text, options)
       })
        
    }
}


// use tokenised tree to get an array of words
function getWordsFromTree(node: any, options: Options): string[] {
    const words: string[] = [];
    visit(node, 'WordNode', (word, index, parent_) => {
        words.push(toString(word))
    })
    return words;
}


// use nlcst ParseEnglish to tokenise words
function getWordsFromText(text: string, options: Options) {
    let tree = new ParseEnglish().parse(text);
    return getWordsFromTree(tree, options);
}


// returns if a string is fully matched in a text at a word level
function isFullWordMatch(phrase: string, text: string, options: Options): boolean {
    let hasAllWords = true;
    const phraseWords = processTextArray(getWordsFromText(phrase, options), options);
    const textWords = processTextArray(getWordsFromText(text, options), options);
    phraseWords.forEach((word) => {
      if (textWords.indexOf(word) === -1) {
        hasAllWords = false;
      }
    });
    return hasAllWords;
}


function processText(text:string, options: Options): string{

    if(options.lowercase !== undefined && options.lowercase === true){
        text = text.toLowerCase();
    }
    if(options.replaceAccents !== undefined && options.replaceAccents === true){
        text = RemoveAccents(text);
    }
    if(options.replaceDashes !== undefined && options.replaceDashes === true){
        text = replaceDashes(text);
    }
    return text;
}


function processTextArray(text:string[], options: Options): string[]{
    return text.map((item) => {
        return processText(item, options)
    })
}


function replaceDashes(text: string): string{
    // https://www.compart.com/en/unicode/category/Pd - English dash chars
    // ['Hyphen-Minus','Hyphen','Non-Breaking Hyphen','Figure Dash', 'En Dash', 'Em Dash', 'Horizontal Bar', 'Small Em Dash','Small Hyphen-Minus','Fullwidth Hyphen-Minus]
    const patterns = [/\u002D/g,/\u2010/g,/\u2011/g,/\u2012/g,/\u2013/g,/\u2014/g,/\u2015'/g, /\uFE58/g, /\uFE63/g, /\uFE63/g, /\uFF0D/g]
    patterns.forEach((pattern) => {
        text = text.replace(pattern, ' '); 
    });
    return text
}


// carete a AhoCorasick instance
function createAhoCorasickObj(options: Options): any {
    const phrases = Object.keys(options.phrases);
    const processedPhrases = processTextArray(phrases, options)
    const builder = AhoCorasick.builder();
    processedPhrases.forEach((phrase) => {
        builder.add(phrase)
    });
    return builder.build();
}


// carete a AhoCorasick dictionary
export function buildDictionary(options: Options): MatchDictionary{
    const ahocorasick = createAhoCorasickObj(options);
    return ahocorasick.export() 
}