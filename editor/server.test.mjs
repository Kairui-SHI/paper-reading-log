import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseNote, serializeNote} from './server.mjs';
test('保存后保留未知字段、中文标签、冒号和多行正文',()=>{
 const note={metadata:{title:'论文: "接触"',date:'2026-10-05',tags:['3D Vision','抓取'],custom:{value:true}},body:'## 我的想法\n\n$$a_b$$\n'};
 const parsed=parseNote(serializeNote(note));
 assert.deepEqual(parsed.metadata,note.metadata);assert.equal(parsed.body.trimEnd(),note.body.trimEnd());
});
test('拒绝不存在的日期与空标题',()=>{
 assert.throws(()=>serializeNote({metadata:{title:'A',date:'2026-02-30'}}));
 assert.throws(()=>serializeNote({metadata:{title:' ',date:'2026-10-05'}}));
});
