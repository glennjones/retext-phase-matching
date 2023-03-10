# retext-phase-matching

IN DEVELOPMENT - NOT STABLE

retext plugin for fast dictionary based phrase or word matching using AhoCorasick string matching algorithm


## Whats does it do
It finds phrases in a text ie "New York" in the example text below. It allows you to tag each phrase with label and code and returns the position of the match within the orginal text. It is designed to be very fast when your are searching a text using thousands of phrases or words.



## Use example 1
```
import {unified } from 'unified'
import retextEnglish from 'retext-english'
import retextStringify from 'retext-stringify'
import {phraseMatcher, buildDictionary} from '../build/index.js';
import {ParseEnglish} from 'parse-english'
import {toString} from 'nlcst-to-string'

const text1 = `I have had part time bar jobs in both London and New York. Then I worked in London a second time managing a bar.`

const text2 = `I was working full time in a Berlin bar.`

const cityPhrases = {
    'New York': {'label': 'city', 'code': '1'}, 
    'London': {'label': 'city', 'code': '2'},
    'City of London': {'label': 'city', 'code': '2'}, 
    'Berlin': {'label': 'city', 'code': '3'}
}

const employmentPhrases = {
    'part-time': {'label': 'employmenttype', 'code': 'parttime'},
    'full-time': {'label': 'employmenttype', 'code': 'fulltime'}
}

const cityMatcher = new Matcher({
    phrases: cityPhrases, 
    lowercase: true, 
    replaceDashes: false, 
    replaceAccents: false})

const employmentMatcher = new Matcher({
    phrases: employmentPhrases, 
    lowercase: true, 
    replaceDashes: true, 
    replaceAccents: false})

    

const file1 = await unified()
  .use(retextEnglish)
  .use(PhraseMatcher, cityMatcher, employmentMatcher)
  .use(retextStringify)
  .process(text1)

console.log(JSON.stringify(file1)) 


const file2 = await unified()
  .use(retextEnglish)
  .use(PhraseMatcher, employmentMatcher)
  .use(retextStringify)
  .process(text2)

console.log(JSON.stringify(file2)) 
```

## Use example 2
```
const tree = new ParseEnglish().parse(text1);
const changedTree = await unified().use(PhraseMatcher, cityMatcher).run(tree);

console.log(JSON.stringify(changedTree));

```
