# retext-phase-matching

IN DEVELOPMENT

retext plugin for fast dictionary based phase matching using AhoCorasick string matching algorithm

## Whats it do
It finds phrases in a text ie "New York" in the example below. It allows to tag each phrase with string based code and returns the position within the text. It design to be very fast when your are searching for thousands of phrases or words.


## Use example 1
```
import {unified } from 'unified'
import retextEnglish from 'retext-english'
import retextStringify from 'retext-stringify'
import {phraseMatcher, buildDictionary} from '../build/index.js';
import {ParseEnglish} from 'parse-english'
import {toString} from 'nlcst-to-string'

const text = `I have had part time bar jobs in both London and New York`
const phrases = {
    'New York': 'city:1', 
    'London': 'city:2', 
    'part-time': 'employmenttype:parttime'
}

const file = await unified()
  .use(retextEnglish)
  .use(phraseMatcher, {
    phrases, 
    lowercase: true, 
    replaceDashes: true, 
    replaceAccents: true})
  .use(retextStringify)
  .process(text)

console.log(JSON.stringify(file)) 
```

## Use example 2
```
const tree = new ParseEnglish().parse(text);
const changedTree = await unified().use(retextPhaseMatching, {
    phrases, 
    lowercase: true, 
    replaceDashes: true, 
    replaceAccents: true}).run(tree);

console.log(JSON.stringify(changedTree));

```
