import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseNote, serializeNote, githubError, activitySource, mergeActivities} from './server.mjs';
import YAML from 'yaml';
test('今日打卡保留其他日期，允许取消，不创建阅读记录',()=>{
 const source='"2026-10-05":\n  exercise: true\n  piano: true\n';
 const result=YAML.parse(activitySource(source,{date:'2026-10-06',exercise:true,piano:false}));
 assert.deepEqual(result['2026-10-05'],{exercise:true,piano:true});
 assert.deepEqual(result['2026-10-06'],{exercise:true,piano:false});
 assert.equal(YAML.parse(activitySource(YAML.stringify(result),{date:'2026-10-06',exercise:false,piano:false}))['2026-10-06'].exercise,false);
 assert.throws(()=>activitySource(source,{date:'2026-02-30',exercise:true,piano:true}));
});
test('保存后保留未知字段、中文标签、冒号和多行正文',()=>{
 const note={metadata:{title:'论文: "接触"',date:'2026-10-05',tags:['3D Vision','抓取'],custom:{value:true}},body:'## 我的想法\n\n$$a_b$$\n'};
 const parsed=parseNote(serializeNote(note));
 assert.deepEqual(parsed.metadata,note.metadata);assert.equal(parsed.body.trimEnd(),note.body.trimEnd());
});
test('拒绝不存在的日期与空标题',()=>{
 assert.throws(()=>serializeNote({metadata:{title:'A',date:'2026-02-30'}}));
 assert.throws(()=>serializeNote({metadata:{title:' ',date:'2026-10-05'}}));
});
test('发布错误区分令牌、权限和远程冲突', async()=>{
 for (const [status,expected] of [[401,'无效'],[403,'Contents'],[404,'kairui-shi/paper-reading-log'],[409,'发生变化'],[422,'提交被拒绝']]) {
  assert.match(await githubError(new Response(JSON.stringify({message:'failure'}),{status})),new RegExp(expected));
 }
});

test('同步打卡合并不同日期与字段，并以当前勾选为准',()=>{
 const base={'2026-10-08':{exercise:true,piano:false}};
 const local={...base,'2026-10-15':{exercise:true,piano:true},'2026-10-16':{exercise:true,piano:true}};
 const remote={...base,'2026-10-14':{piano:true}};
 const merged=YAML.parse(mergeActivities(YAML.stringify(base),YAML.stringify(local),YAML.stringify(remote),'2026-10-15'));
 assert.equal(merged['2026-10-14'].piano,true);assert.equal(merged['2026-10-16'].exercise,true);
 assert.deepEqual(merged['2026-10-15'],{exercise:true,piano:true});
 const source=YAML.stringify(merged);
 assert.deepEqual(YAML.parse(mergeActivities(source,source,source,'2026-10-15')),merged);
 const canceled=activitySource(source,{date:'2026-10-15',exercise:false,piano:false});
 assert.equal(YAML.parse(mergeActivities(source,canceled,source,'2026-10-15'))['2026-10-15'].exercise,false);
});
test('其他日期的冲突不静默覆盖',()=>{
 const yaml=x=>YAML.stringify({'2026-10-14':{piano:x}});
 assert.throws(()=>mergeActivities('',yaml(true),yaml(false),'2026-10-15'),/2026-10-14/);
});
