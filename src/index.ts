import { visit } from 'unist-util-visit';
import { toString } from 'nlcst-to-string';
import { ParseEnglish } from 'parse-english';
import AhoCorasick from 'aho-corasick-node';
import RemoveAccents from 'remove-accents';

import type { Root, SentenceContentMap, Word, Literal } from 'nlcst';

interface ExtendedTextNode extends Literal {
  type: 'TextNode';
  normalizedValue: string;
  labels: string[];
  codes: string[];
}

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
  replaceDashes?: boolean;
  replaceFullStops?: boolean;
  replaceAccents?: boolean;
}

// function call by retext to pipeline this module
export function PhraseMatcher(...matchers: Matcher[]): any {
  return (tree: any, file: any, done: Function) => {
    if (!file.data) {
      file.data = {};
    }
    if (!file.data.matched) {
      file.data.matched = [] as Match[];
    }

    for (let i = 0; i < matchers.length; i++) {
      const newMatches = matchers[i].match(tree);
      file.data.matched = file.data.matched.concat(newMatches);
      file.data.matched.sort(byPropertiesOf<Match>(['start']));
    }

    done(null, tree, file);
  };
}

// a matcher class, build object to store dictionary and excute match
export class Matcher {
  lowercase?: boolean;
  replaceDashes?: boolean;
  replaceFullStops?: boolean;
  replaceAccents?: boolean;

  phraseObjs: Phrase;
  phraseKeys: string[] = [];
  phraseNormalized: string[] = [];
  dictionary: PhraseDictionary;

  constructor(options: Options) {
    if (options.phrases === undefined) {
      throw new Error('You need to pass a `phrases` object in the options');
    }

    this.phraseObjs = options.phrases;
    this.lowercase = options.lowercase ? options.lowercase : false;
    this.replaceDashes = options.replaceDashes ? options.replaceDashes : false;
    this.replaceFullStops = options.replaceFullStops ? options.replaceFullStops : false;
    this.replaceAccents = options.replaceAccents
      ? options.replaceAccents
      : false;

    this.dictionary = this.buildDictionary();
  }

  match(tree: Root) {
    const words = this.processTextArray(this.getWordsFromTree(tree));
    const text = words.join(' ');
    const foundMatches = this.dictionary.match(text);

    const matches = foundMatches.filter((phrase: string) => {
      return this.isFullWordMatch(phrase, text);
    });
    return this.getFullMatchData(matches, tree);
  }

  // processes a strings
  private processText(text: string): string {
    if (this.lowercase !== undefined && this.lowercase === true) {
      text = text.toLowerCase();
    }
    if (this.replaceAccents !== undefined && this.replaceAccents === true) {
      text = RemoveAccents(text);
    }
    if (this.replaceDashes !== undefined && this.replaceDashes === true) {
      text = this.replaceDashesInText(text);
    }
    if (this.replaceFullStops !== undefined && this.replaceFullStops === true) {
      text = this.replaceFullStopsInText(text);
    }
    return text;
  }

  // processes an array of strings
  private processTextArray(text: string[]): string[] {
    return text.map((item) => {
      return this.processText(item);
    });
  }

  // replaces dashes with a space so we can match part-time against part time
  private replaceDashesInText(text: string): string {
    // https://www.compart.com/en/unicode/category/Pd - English dash chars
    // ['Hyphen-Minus','Hyphen','Non-Breaking Hyphen','Figure Dash', 'En Dash', 'Em Dash', 'Horizontal Bar', 'Small Em Dash','Small Hyphen-Minus','Fullwidth Hyphen-Minus]
    const patterns = [
      /\u002D/g,
      /\u2010/g,
      /\u2011/g,
      /\u2012/g,
      /\u2013/g,
      /\u2014/g,
      /\u2015/g,
      /\uFE58/g,
      /\uFE63/g,
      /\uFE63/g,
      /\uFF0D/g,
    ];
    return this.replaceWithSpace(text, patterns);
  }

  // replaces dashes with a space so we can match part-time against part time
  private replaceFullStopsInText(text: string): string {
    // https://www.compart.com/en/unicode/category/Po - English dash chars
    // ['Full Stop']
    const patterns = [/\u002E/g];
    return this.replaceWithSpace(text, patterns);
  }

  // replaces a regex pattern with a space
  private replaceWithSpace(text: string, patterns: RegExp[]): string {
    patterns.forEach((pattern) => {
      text = text.replace(pattern, ' ');
    });
    return text;
  }

  // carete a AhoCorasick instance
  private buildDictionary(): PhraseDictionary {
    this.phraseKeys = Object.keys(this.phraseObjs);
    this.phraseNormalized = this.processTextArray(this.phraseKeys);
    const builder = AhoCorasick.builder();
    this.phraseNormalized.forEach((phrase, i) => {
      //const keys = Object.keys(options.phrases);
      this.phraseObjs[this.phraseKeys[i]].normalizedValue = phrase;
      builder.add(phrase);
    });
    return builder.build();
  }

  // use tokenised tree to get an array of words - uses 'nlcst-to-string' to return word list
  private getWordsFromTree(tree: Root): string[] {
    const words: string[] = [];
    visit(tree, 'WordNode', (word, index, parent_) => {
      this.extendTextNodeChildren(word);
      words.push(toString(word));
    });
    return words;
  }

  // extend TextNode object and add normalizedValue based on options
  // we add new property as we want to use the orginal input value later
  private extendTextNodeChildren(wordNode: Word): void {
    if (wordNode.children[0]) {
      wordNode.children.forEach((item) => {
        if (item.type == 'TextNode') {
          const extendedTextNode = item as ExtendedTextNode;
          extendedTextNode.normalizedValue = this.processText(item.value);
        }
      });
    }
  }

  // use tokenised tree to get an array of word nodes
  private getWordNodesFromTree(tree: Root): Word[] {
    const wordNodes: any[] = [];
    visit(tree, 'WordNode', (word, index, parent_) => {
      this.extendTextNodeChildren(word);
      wordNodes.push(word);
    });
    return wordNodes;
  }

  // use nlcst ParseEnglish to tokenise word strings
  private getWordsFromText(text: string): string[] {
    let tree = new ParseEnglish().parse(text);
    return this.getWordsFromTree(tree);
  }

  // use nlcst ParseEnglish to tokenise word nodes
  private getWordNodesFromText(text: string): Word[] {
    let tree = new ParseEnglish().parse(text);
    return this.getWordNodesFromTree(tree);
  }

  // returns if a string is fully matched in a text at a word level
  private isFullWordMatch(phrase: string, text: string): boolean {
    let hasAllWords = true;
    const phraseWords = this.processTextArray(this.getWordsFromText(phrase));
    const textWords = this.processTextArray(this.getWordsFromText(text));
    phraseWords.forEach((word) => {
      if (textWords.indexOf(word) === -1) {
        hasAllWords = false;
      }
    });
    return hasAllWords;
  }

  private getFullMatchData(phrasesMatched: string[], tree: Root): Match[] {
    const matches: Match[] = [];
    const fullText = toString(tree);
    const wordNodes = this.getWordNodesFromTree(tree);
    const phrasesObjArr = phrasesMatched.map((phraseText) => {
      return {
        phraseText,
        phraseWordNode: this.getWordNodesFromText(phraseText),
      };
    });
    phrasesObjArr.forEach((phraseObj) => {
      const { phraseText, phraseWordNode } = phraseObj;

      let startNode = undefined;
      let allNodes: Word[] = [];

      const firstWordValue = this.getNormalizedValue(phraseWordNode[0]);
      wordNodes.forEach((wordNode: Word, i) => {
        const wordValue = this.getNormalizedValue(wordNode);
        if (firstWordValue === wordValue) {
          startNode = wordNode;

          if (phraseWordNode.length === 1) {
            allNodes.push(wordNode);
            const match = this.buildMatchData(allNodes, fullText, phraseText);
            matches.push(match);
            startNode = undefined;
            allNodes = [];
          } else {
            let subset = wordNodes.slice(i, i + phraseWordNode.length);
            let hasAllWords = true;
            phraseWordNode.forEach((item, i: number) => {
              if (subset[i] && phraseWordNode[i]) {
                if (
                  (this.getNormalizedValue(subset[i]) ===
                    this.getNormalizedValue(phraseWordNode[i])) ===
                  false
                ) {
                  hasAllWords = false;
                }
              } else {
                hasAllWords = false;
              }
            });
            if (hasAllWords === true) {
              const match = this.buildMatchData(subset, fullText, phraseText);
              matches.push(match);
              hasAllWords = true;
              startNode = undefined;
              allNodes = [];
              subset = [];
            }
          }
        }
      });
    });

    return matches;
  }

  private getNormalizedValue(wordNode: Word): string {
    let out = '';
    if (wordNode.children[0]) {
      wordNode.children.forEach((item) => {
        if (item.type == 'TextNode') {
          const extendedTextNode = item as ExtendedTextNode;
          out += extendedTextNode.normalizedValue;
        }
      });
    }
    return out;
  }

  private buildMatchData(
    wordNodes: Word[],
    fullText: string,
    phraseText: string
  ): Match {
    const out = {
      match: '',
      start: 0,
      end: 0,
      label: '',
      code: '',
    };
    let startLine = 0;
    let endLine = 0;
    const firstNode = wordNodes[0];
    if (
      firstNode.position &&
      firstNode.position.start &&
      firstNode.position.start.offset
    ) {
      out.start = firstNode.position.start.offset;
      startLine = firstNode.position.start.line;
    }
    const lastNode = wordNodes[wordNodes.length - 1];
    if (
      lastNode.position &&
      lastNode.position.start &&
      lastNode.position.start.offset !== undefined
    ) {
      out.end = lastNode.position.end.offset || out.start;
      endLine = lastNode.position.start.line;
    }
    out.match = fullText.substring(out.start, out.end);
    const phraseObj = this.findObjByNormalizedValue(phraseText);
    if (phraseObj) {
      if (phraseObj.label) {
        out.label = phraseObj.label;
      }
      if (phraseObj.code) {
        out.code = phraseObj.code;
      }
    }

    return out;
  }

  private findObjByNormalizedValue(
    normalizedValue: string
  ): PhraseMetadata | undefined {
    let out = undefined;
    this.phraseKeys.forEach((item) => {
      const phraseObj = this.phraseObjs[item];
      if (
        phraseObj.normalizedValue &&
        phraseObj.normalizedValue === normalizedValue
      ) {
        out = phraseObj;
      }
    });
    return out;
  }
}

type sortArg<T> = keyof T | `-${string & keyof T}`;

/**
 * Returns a comparator for objects of type T that can be used by sort
 * functions, were T objects are compared by the specified T properties.
 *
 * @param sortBy - the names of the properties to sort by, in precedence order.
 *                 Prefix any name with `-` to sort it in descending order.
 */
export function byPropertiesOf<T extends object>(sortBy: Array<sortArg<T>>) {
  function compareByProperty(arg: sortArg<T>) {
    let key: keyof T;
    let sortOrder = 1;
    if (typeof arg === 'string' && arg.startsWith('-')) {
      sortOrder = -1;
      // Typescript is not yet smart enough to infer that substring is keyof T
      key = arg.substr(1) as keyof T;
    } else {
      // Likewise it is not yet smart enough to infer that arg here is keyof T
      key = arg as keyof T;
    }
    return function (a: T, b: T) {
      const result = a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0;

      return result * sortOrder;
    };
  }

  return function (obj1: T, obj2: T) {
    let i = 0;
    let result = 0;
    const numberOfProperties = sortBy?.length;
    while (result === 0 && i < numberOfProperties) {
      result = compareByProperty(sortBy[i])(obj1, obj2);
      i++;
    }

    return result;
  };
}

/**
 * Sorts an array of T by the specified properties of T.
 *
 * @param arr - the array to be sorted, all of the same type T
 * @param sortBy - the names of the properties to sort by, in precedence order.
 *                 Prefix any name with `-` to sort it in descending order.
 */
export function sort<T extends object>(arr: T[], ...sortBy: Array<sortArg<T>>) {
  arr.sort(byPropertiesOf<T>(sortBy));
}
