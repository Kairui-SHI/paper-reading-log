import {test} from 'node:test';
import assert from 'node:assert/strict';
import './format.js';
const format = globalThis.formatReadingNote;
test('整理纯文本标题、列表和段落，重复整理结果一致',()=>{
 const text='词语积累：\r\nconcise\r\n\r\n\r\n行文方法：\r\n1、观点\r\n2.例子\r\n• 补充';
 const result=format(text);assert.match(result,/## 词语积累\n\nconcise/);assert.match(result,/1\. 观点\n2\. 例子\n- 补充/);assert.equal(format(result),result);
});
test('保留代码、公式、缩进代码和表格',()=>{
 const text='```js\n标题：\n1.代码\n```\n\n$$\na_b + c\n\n= 1\n$$\n\n| 词 | 含义 |\n| --- | --- |\n| a | b |\n\n    code:  \n    x';
 assert.equal(format(text).trimEnd(),text);
});
