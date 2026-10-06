import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import YAML from 'yaml';

const exec = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT || 4317);
const origin = `http://127.0.0.1:${port}`;
const session = randomUUID();
let busy = false;
const git = (...args) => exec('git', args, { cwd: root, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });
const read = async p => { try { return await fs.readFile(p, 'utf8'); } catch (e) { if (e.code === 'ENOENT') return null; throw e; } };
function filename(value) {
  if (!/^[\p{L}\p{N}][\p{L}\p{N}_.-]*\.md$/u.test(value || '') || value.includes('..')) throw new Error('文件名无效');
  return value;
}
export function parseNote(source) {
  const match = source.replace(/^\uFEFF/, '').match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/);
  if (!match) throw new Error('笔记缺少 YAML 标题信息');
  const metadata = YAML.parse(match[1]);
  if (!metadata || typeof metadata !== 'object') throw new Error('标题信息无效');
  return { metadata, body: match[2].replace(/^\r?\n/, '') };
}
export function serializeNote(note) {
  const m = note.metadata;
  if (!m || typeof m.title !== 'string' || !m.title.trim()) throw new Error('请填写标题');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(m.date || '') || new Date(`${m.date}T12:00:00Z`).toISOString().slice(0,10) !== m.date) throw new Error('日期无效');
  return `---\n${YAML.stringify(m)}---\n\n${note.body || ''}\n`;
}
async function notes() {
  const saved = (await fs.readdir(path.join(root, '_notes'))).filter(f => f.endsWith('.md'));
  await fs.mkdir(path.join(root, '.editor-drafts'), { recursive: true });
  const drafts = (await fs.readdir(path.join(root, '.editor-drafts'))).filter(f => f.endsWith('.md'));
  return Promise.all([...new Set([...saved, ...drafts])].map(async file => {
    const draft = await read(path.join(root, '.editor-drafts', file));
    const source = draft ?? await read(path.join(root, '_notes', file));
    return { file, ...parseNote(source), draft: draft !== null, version: source };
  }));
}
export async function githubError(response) {
  let message = ''; try { message = (await response.json()).message || ''; } catch {}
  const status = response.status;
  if (status === 401) return 'GitHub 401：令牌无效或已过期，请重新填写有效令牌';
  if (status === 403 && /rate limit/i.test(message)) return 'GitHub 403：请求额度已用完，请稍后重试';
  if (status === 403) return 'GitHub 403：令牌没有此仓库的 Contents 写入权限，或仓库规则禁止直接发布';
  if (status === 404) return 'GitHub 404：令牌无法写入此仓库，请确认授权了 kairui-shi/paper-reading-log，并开启 Contents 读写权限';
  if (status === 409) return 'GitHub 409：远程笔记在发布期间发生变化，请重新同步后重试';
  if (status === 422) return 'GitHub 422：提交被拒绝，请检查分支保护规则或稍后重试';
  return `GitHub ${status}：发布请求失败，请稍后重试`;
}
export function activitySource(source, data) {
  serializeNote({metadata:{title:'活动',date:data.date}});
  if(typeof data.exercise !== 'boolean' || typeof data.piano !== 'boolean') throw new Error('活动状态无效');
  const activities=YAML.parse(source || '') || {};
  activities[data.date]={...(activities[data.date] || {}),exercise:data.exercise,piano:data.piano};
  return YAML.stringify(activities);
}
async function saveActivities(data) {
  const target=path.join(root,'_data','activities.yml');
  const current=await read(target);
  if(current !== (data.version ?? null)) throw new Error('活动记录已更新，请重新载入后再保存');
  const source=activitySource(current,data);
  if(data.publish) {
    if(!data.token) throw new Error('请先在发布设置填写 GitHub 令牌；也可以先保存到本地');
    const url='https://api.github.com/repos/kairui-shi/paper-reading-log/contents/_data/activities.yml';
    const headers={Authorization:`Bearer ${data.token}`,Accept:'application/vnd.github+json','Content-Type':'application/json','User-Agent':'paper-reading-log-editor'};
    const response=await fetch(`${url}?ref=main`,{headers});
    if(!response.ok && response.status!==404) throw new Error(await githubError(response));
    const existing=response.ok ? await response.json() : null;
    if(existing) {
      const remote=Buffer.from(existing.content,'base64').toString('utf8').replace(/\r\n/g,'\n');
      let base=null;try{base=(await git('show','origin/main:_data/activities.yml')).stdout.replace(/\r\n/g,'\n');}catch{}
      if(remote !== current?.replace(/\r\n/g,'\n') && remote !== base) throw new Error('远程活动记录已变化，请先同步仓库');
    }
    const result=await fetch(url,{method:'PUT',headers,body:JSON.stringify({message:`Update activities: ${data.date}`,content:Buffer.from(source).toString('base64'),branch:'main',...(existing?{sha:existing.sha}:{})})});
    if(!result.ok) throw new Error(await githubError(result));
  }
  await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,source);
  return {version:source,activities:YAML.parse(source),published:!!data.publish};
}
async function publish(file, source, token) {
  const target = path.join(root, '_notes', file);
  if (token) {
    const url = `https://api.github.com/repos/kairui-shi/paper-reading-log/contents/_notes/${encodeURIComponent(file)}`;
    const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'User-Agent': 'paper-reading-log-editor' };
    const current = await fetch(`${url}?ref=main`, { headers });
    if (!current.ok && current.status !== 404) throw new Error(await githubError(current));
    const existing = current.ok ? await current.json() : null;
    if (existing) {
      const local = await read(target);
      const remote = Buffer.from(existing.content, 'base64').toString('utf8').replace(/\r\n/g,'\n');
      let upstream = null;
      try { upstream = (await git('show', `origin/main:_notes/${file}`)).stdout.replace(/\r\n/g,'\n'); } catch {}
      if (remote !== local?.replace(/\r\n/g,'\n') && remote !== upstream) throw new Error('远程笔记已变化，请先同步仓库再发布');
    }
    const result = await fetch(url, { method: 'PUT', headers, body: JSON.stringify({ message: `Update reading note: ${file}`, content: Buffer.from(source).toString('base64'), branch: 'main', ...(existing ? {sha:existing.sha} : {}) }) });
    if (!result.ok) throw new Error(await githubError(result));
    await fs.writeFile(target, source);
    return;
  }
  const status = (await git('status', '--porcelain')).stdout;
  if (status.trim()) throw new Error('仓库有未提交修改。请先处理修改，或使用 GitHub 令牌发布当前笔记');
  const beforePull = await read(target);
  await git('pull', '--ff-only', 'origin', 'main');
  if (await read(target) !== beforePull) throw new Error('远程笔记已变化，请重新载入后编辑');
  await fs.writeFile(target, source);
  await git('add', '--', `_notes/${file}`);
  const changed = (await git('diff', '--cached', '--name-only')).stdout.trim();
  if (changed) await git('commit', '-m', `Update reading note: ${file}`, '--', `_notes/${file}`);
  try { await git('push', 'origin', 'main'); } catch { throw new Error('笔记已保存到本地，GitHub 推送未成功。可在发布设置中填入令牌后重试'); }
}
export const server = http.createServer(async (req, res) => {
  const json = (status, data) => { res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify(data)); };
  try {
    if (req.headers.host !== `127.0.0.1:${port}`) return json(403,{error:'无效访问地址'});
    const url = new URL(req.url, origin);
    if (url.pathname.startsWith('/api/')) {
      if (req.method === 'GET' && url.pathname === '/api/notes') return json(200,{notes:await notes(), session});
      if (req.method === 'GET' && url.pathname === '/api/activities') {const version=await read(path.join(root,'_data','activities.yml'));return json(200,{version,activities:YAML.parse(version || '') || {},session});}
      if (req.method !== 'POST' || req.headers.origin !== origin || req.headers['x-editor-session'] !== session) return json(403,{error:'请刷新编辑器后重试'});
      if (busy) return json(409,{error:'正在保存或发布，请稍后重试'});
      let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 2_000_000) throw new Error('笔记过大'); }
      const data = JSON.parse(body);
      if(url.pathname === '/api/activities') {busy=true;try{return json(200,await saveActivities(data));}finally{busy=false;}}
      const file = filename(data.file);
      const source = serializeNote(data);
      busy = true;
      try {
        const draftPath = path.join(root, '.editor-drafts', file);
        const current = await read(draftPath) ?? await read(path.join(root, '_notes', file));
        if (current !== (data.version ?? null)) return json(409,{error:'笔记已被其他窗口修改，请刷新后再编辑'});
        await fs.mkdir(path.dirname(draftPath), {recursive:true});
        if (url.pathname === '/api/save') await fs.writeFile(draftPath, source);
        else if (url.pathname === '/api/publish') { await publish(file, source, data.token); await fs.rm(draftPath,{force:true}); }
        else return json(404,{error:'接口不存在'});
        return json(200,{version:source,published:url.pathname === '/api/publish'});
      } finally { busy = false; }
    }
    if (req.method !== 'GET') return json(405,{error:'方法不支持'});
    let relative = url.pathname === '/' ? 'editor/index.html' : decodeURIComponent(url.pathname).slice(1);
    if (!/^(editor\/|node_modules\/(marked|dompurify|katex)\/|assets\/)/.test(relative)) return json(404,{error:'文件不存在'});
    const full = path.resolve(root, relative);
    if (!full.startsWith(root + path.sep)) return json(403,{error:'路径无效'});
    const types = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png','.jpg':'image/jpeg'};
    res.writeHead(200,{'Content-Type':types[path.extname(full)] || 'application/octet-stream','X-Content-Type-Options':'nosniff'}); res.end(await fs.readFile(full));
  } catch(e) { if (!res.headersSent) json(e.code === 'ENOENT' ? 404 : 400,{error:e.message}); else res.end(); }
});
if (process.argv[1] === fileURLToPath(import.meta.url)) server.listen(port,'127.0.0.1',()=>console.log(`Reading editor: ${origin}`));
