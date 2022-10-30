import { visit } from 'unist-util-visit';
import { toString } from 'nlcst-to-string';
import { ParseEnglish } from 'parse-english';
import AhoCorasick from 'aho-corasick-node';
import RemoveAccents from 'remove-accents';
const defaults = {
    phrases: {},
    dictionary: undefined,
    lowercase: false,
    replaceDashes: false,
    replaceAccents: false,
};
let ahocorasick = undefined;
export function phraseMatcher(options) {
    if (options.phrases === undefined) {
        throw new Error('Can not find matches without a word `phrases` object');
    }
    const config = Object.assign(defaults, options);
    if (config.dictionary === undefined) {
        ahocorasick = createAhoCorasickObj(config);
    }
    else {
        ahocorasick = AhoCorasick.from(config.dictionary);
    }
    return (tree, file) => {
        if (!file.data) {
            file.data = {};
        }
        if (!file.data.matched) {
            file.data.matched = [];
        }
        const words = processTextArray(getWordsFromTree(tree, options), options);
        const text = words.join(' ');
        const foundMatches = ahocorasick.match(text);
        const matches = foundMatches.filter((phrase) => {
            return isFullWordMatch(phrase, text, options);
        });
        file.data.matched = getFullMatchData(matches, tree, options);
    };
}
// extend TextNode object and add normalizedValue based on options
// we add new property as we want to use the orginal input value later
function extendTextNodeChildren(wordNode, options) {
    if (wordNode.children[0]) {
        wordNode.children.forEach((item) => {
            if (item.type == 'TextNode') {
                const extendedTextNode = item;
                extendedTextNode.normalizedValue = processText(item.value, options);
            }
        });
    }
}
function getNormalizedValue(wordNode) {
    let out = '';
    if (wordNode.children[0]) {
        wordNode.children.forEach((item) => {
            if (item.type == 'TextNode') {
                const extendedTextNode = item;
                out += extendedTextNode.normalizedValue;
            }
        });
    }
    return out;
}
// use tokenised tree to get an array of words - uses 'nlcst-to-string' to return word list
function getWordsFromTree(tree, options) {
    const words = [];
    visit(tree, 'WordNode', (word, index, parent_) => {
        extendTextNodeChildren(word, options);
        words.push(toString(word));
    });
    return words;
}
// use tokenised tree to get an array of word nodes
function getWordNodesFromTree(tree, options) {
    const wordNodes = [];
    visit(tree, 'WordNode', (word, index, parent_) => {
        extendTextNodeChildren(word, options);
        wordNodes.push(word);
    });
    return wordNodes;
}
// use nlcst ParseEnglish to tokenise word strings
function getWordsFromText(text, options) {
    let tree = new ParseEnglish().parse(text);
    return getWordsFromTree(tree, options);
}
// use nlcst ParseEnglish to tokenise word nodes
function getWordNodesFromText(text, options) {
    let tree = new ParseEnglish().parse(text);
    return getWordNodesFromTree(tree, options);
}
// returns if a string is fully matched in a text at a word level
function isFullWordMatch(phrase, text, options) {
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
function processText(text, options) {
    if (options.lowercase !== undefined && options.lowercase === true) {
        text = text.toLowerCase();
    }
    if (options.replaceAccents !== undefined && options.replaceAccents === true) {
        text = RemoveAccents(text);
    }
    if (options.replaceDashes !== undefined && options.replaceDashes === true) {
        text = replaceDashes(text);
    }
    return text;
}
function processTextArray(text, options) {
    return text.map((item) => {
        return processText(item, options);
    });
}
function replaceDashes(text) {
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
    patterns.forEach((pattern) => {
        text = text.replace(pattern, ' ');
    });
    return text;
}
function buildMatchData(wordNodes, fullText, phraseText, options) {
    const out = {
        match: '',
        start: 0,
        end: 0,
        label: '',
        code: ''
    };
    let startLine = 0;
    let endLine = 0;
    const firstNode = wordNodes[0];
    if (firstNode.position
        && firstNode.position.start
        && firstNode.position.start.offset) {
        out.start = firstNode.position.start.offset;
        startLine = firstNode.position.start.line;
    }
    const lastNode = wordNodes[wordNodes.length - 1];
    if (lastNode.position
        && lastNode.position.start
        && lastNode.position.start.offset !== undefined) {
        out.end = lastNode.position.end.offset || out.start;
        endLine = lastNode.position.start.line;
    }
    out.match = fullText.substring(out.start, out.end);
    const phraseObj = findObjByNormalizedValue(phraseText, options);
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
function findObjByNormalizedValue(normalizedValue, options) {
    let out = undefined;
    const keys = Object.keys(options.phrases);
    keys.forEach((item) => {
        const phraseObj = options.phrases[item];
        if (phraseObj.normalizedValue && phraseObj.normalizedValue === normalizedValue) {
            out = phraseObj;
        }
    });
    return out;
}
function getFullMatchData(phrasesMatched, tree, options) {
    // - add normalisedValue to TextNode for text to be search 
    // loop each phrase and create tree with normalisedValue
    // search for a match of first word
    // check for n-words in phase come in same order in text - make sure it does not cross line boundry
    // mark the start and end WordNode with label
    // get the start and end positions
    // add to file out put as a match object 
    const matches = [];
    const fullText = toString(tree);
    const wordNodes = getWordNodesFromTree(tree, options);
    const phrasesObjArr = phrasesMatched.map((phraseText) => {
        return { phraseText, phraseWordNode: getWordNodesFromText(phraseText, options) };
    });
    phrasesObjArr.forEach((phraseObj) => {
        const { phraseText, phraseWordNode } = phraseObj;
        let startNode = undefined;
        let allNodes = [];
        const firstWordValue = getNormalizedValue(phraseWordNode[0]);
        wordNodes.forEach((wordNode, i) => {
            const wordValue = getNormalizedValue(wordNode);
            if (firstWordValue === wordValue) {
                console.log('we have a match');
                startNode = wordNode;
                if (phraseWordNode.length === 1) {
                    allNodes.push(wordNode);
                    const match = buildMatchData(allNodes, fullText, phraseText, options);
                    //console.log(JSON.stringify(match));
                    matches.push(match);
                    startNode = undefined;
                    allNodes = [];
                }
                else {
                    let subset = wordNodes.slice(i, i + phraseWordNode.length);
                    let hasAllWords = true;
                    phraseWordNode.forEach((item, i) => {
                        if (subset[i] && phraseWordNode[i]) {
                            if ((getNormalizedValue(subset[i]) === getNormalizedValue(phraseWordNode[i])) === false) {
                                hasAllWords = false;
                            }
                        }
                        else {
                            hasAllWords = false;
                        }
                    });
                    if (hasAllWords === true) {
                        const match = buildMatchData(subset, fullText, phraseText, options);
                        //console.log(JSON.stringify(match));
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
// carete a AhoCorasick instance
function createAhoCorasickObj(options) {
    const phrases = Object.keys(options.phrases);
    const processedPhrases = processTextArray(phrases, options);
    const builder = AhoCorasick.builder();
    processedPhrases.forEach((phrase, i) => {
        const keys = Object.keys(options.phrases);
        options.phrases[keys[i]].normalizedValue = phrase;
        builder.add(phrase);
    });
    return builder.build();
}
// carete a AhoCorasick dictionary
export function buildDictionary(options) {
    const ahocorasick = createAhoCorasickObj(options);
    return ahocorasick.export();
}
function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
}
//# sourceMappingURL=index.js.map