const $ = id => document.getElementById(id);
let notes = [], current = null, session, dirty = false, pending = false;
let formatBackup = null;
const fields = ['title','date','status','paper_url','authors','tags','summary','code_url'];
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
function state(text,error=false) { $('state').textContent=text; $('state').classList.toggle('error',error); }
function renderList() {
  $('list').replaceChildren();
  const keywords = $('search').value.normalize('NFKC').toLowerCase().trim().split(/\s+/).filter(Boolean);
  const filtered = notes.filter(n => {
    const text = [n.metadata.title, n.metadata.authors, ...(n.metadata.tags || []), n.metadata.summary, n.body].join(' ').normalize('NFKC').toLowerCase();
    return keywords.every(keyword => text.includes(keyword));
  }).sort((a,b)=>String(b.metadata.date).localeCompare(String(a.metadata.date)));
  for (const note of filtered) {
    const item = document.createElement('button'); item.className='note-item' + (note.file === current?.file ? ' active' : '');
    const date = document.createElement('span'); date.textContent=`${note.metadata.date}${note.draft ? ' · 草稿' : ''}`;
    const title = document.createElement('strong'); title.textContent=note.metadata.title; item.append(date,title);
    item.onclick=()=>{if (!pending && (!dirty || confirm('当前内容尚未保存，是否离开？'))) openNote(note);}; $('list').append(item);
  }
  if (!filtered.length) $('list').textContent='还没有匹配的笔记。';
}
function openNote(note) {
  formatBackup=null; $('undo-format').disabled=true;
  current=structuredClone(note); dirty=false;
  for (const field of fields) $(field).value = field === 'tags' ? (note.metadata.tags || []).join(', ') : note.metadata[field] || '';
  if (note.metadata.status && !$('status').value) { const option=new Option(note.metadata.status,note.metadata.status); $('status').add(option); $('status').value=note.metadata.status; }
  $('body').value=note.body || ''; renderList(); preview(); state(note.draft ? '草稿已保存' : '已载入笔记');
}
function collect() {
  const metadata={...current.metadata};
  for (const field of fields) metadata[field] = field === 'tags' ? $(field).value.split(/[,，]/).map(s=>s.trim()).filter(Boolean) : $(field).value;
  return {file:current.file,metadata,body:$('body').value,version:current.version ?? null,baseMetadata:current.baseMetadata || current.metadata};
}
function preview() {
  $('preview-title').textContent=$('title').value || '今天的阅读';
  $('preview-meta').textContent=`${$('date').value} · ${$('status').value}`;
  $('preview-summary').textContent=$('summary').value;
  const math=[];
  const body=$('body').value.replace(/(```[\s\S]*?```|`[^`\n]+`)|(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$[^$\n]+?\$)/g,(match,code,formula)=>{ if(code) return code; const index=math.push(formula)-1;return `MATHPLACEHOLDER${index}END`; });
  let html=DOMPurify.sanitize(marked.parse(body));
  html=html.replace(/MATHPLACEHOLDER(\d+)END/g,(_,i)=>math[i].replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'));
  $('preview-body').innerHTML=html;
  renderMathInElement($('preview-body'),{delimiters:[{left:'$$',right:'$$',display:true},{left:'\\[',right:'\\]',display:true},{left:'\\(',right:'\\)',display:false},{left:'$',right:'$',display:false}],throwOnError:false});
  $('words').textContent=`${$('body').value.replace(/\s/g,'').length} 字`;
}
function changed() {dirty=true; state('未保存');sessionStorage.setItem('reading-unsaved',JSON.stringify(collect()));preview();}
const same = (a,b) => JSON.stringify(a ?? '') === JSON.stringify(b ?? '');
const sourceBody = source => (source || '').replace(/^\uFEFF/,'').replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/,'').replace(/^\r?\n/,'').replace(/\r\n/g,'\n').trimEnd();
async function latestNotes() {
  const response = await fetch('/api/notes');
  if (!response.ok) throw new Error('无法读取最新笔记，当前文字已保留');
  const data = await response.json(); session = data.session; return data.notes;
}
function mergeLatest(data, baseline, latest) {
  if (!latest || baseline.recoveredWithoutBaseline) return null;
  const baseMetadata=baseline.baseMetadata || baseline.metadata;
  const baseBody = sourceBody(baseline.version);
  const myBody = data.body.replace(/\r\n/g,'\n').trimEnd();
  const otherBody = latest.body.replace(/\r\n/g,'\n').trimEnd();
  if (myBody !== baseBody && otherBody !== baseBody && myBody !== otherBody) return null;
  const metadata = {...latest.metadata};
  for (const key of new Set([...Object.keys(baseMetadata), ...Object.keys(data.metadata)])) {
    if (same(data.metadata[key],baseMetadata[key])) continue;
    if (!same(latest.metadata[key],baseMetadata[key]) && !same(latest.metadata[key],data.metadata[key])) return null;
    metadata[key] = data.metadata[key];
  }
  return {...data, metadata, body:myBody === baseBody ? latest.body : data.body, version:latest.version};
}
function conflictCopy() {
  let dialog = $('conflict-dialog');
  if (!dialog) {
    dialog = document.createElement('dialog'); dialog.id='conflict-dialog';
    const title=document.createElement('h2');title.textContent='笔记有两份不同的修改';
    const explanation=document.createElement('p');explanation.textContent='你的文字仍在编辑区。可以保存为一份新的草稿，再与最新笔记对照整理。原笔记不会被覆盖。';
    const stay=document.createElement('button');stay.textContent='继续编辑';stay.onclick=()=>dialog.close();
    const copy=document.createElement('button');copy.className='primary';copy.textContent='另存为草稿';copy.onclick=async()=>{dialog.close();current={...current,file:`${$('date').value}-${crypto.randomUUID().slice(0,8)}.md`,version:null,draft:true};dirty=true;sessionStorage.setItem('reading-unsaved',JSON.stringify(collect()));await save();};
    dialog.append(title,explanation,stay,copy);document.body.append(dialog);
  }
  dialog.showModal();
}
async function save(publish=false) {
  if(pending || !$('metadata').reportValidity()) return;
  pending=true; $('save').disabled=$('publish').disabled=$('new').disabled=true;
  state(publish?'正在发布…':'正在保存…');
  let data=collect();
  const baseline=structuredClone(current);
  const controls = [...[...fields,'body'].map($), ...document.querySelectorAll('[data-insert]'), $('format-note'), $('restore-note')];
  controls.forEach(control => control.disabled=true);
  try {
    async function request() {
      const res=await fetch(publish?'/api/publish':'/api/save',{method:'POST',headers:{'Content-Type':'application/json','X-Editor-Session':session},body:JSON.stringify({...data,...(publish ? {token:$('token').value.trim()} : {})})});
      return {res,result:await res.json()};
    }
    let {res,result}=await request();
    if (res.status===403) {await latestNotes();({res,result}=await request());}
    if (res.status===409) {
      notes=await latestNotes();
      const latest=notes.find(note=>note.file===data.file);
      const merged=mergeLatest(data,baseline,latest);
      if (!merged) {renderList();conflictCopy();throw new Error('修改有冲突，文字已保留，可另存为草稿');}
      data=merged;
      ({res,result}=await request());
    }
    if(!res.ok) throw new Error(result.error);
    current={...data,version:result.version,draft:!publish,baseMetadata:data.metadata};
    for (const field of fields) $(field).value=field==='tags' ? (data.metadata.tags || []).join(', ') : data.metadata[field] || '';
    $('body').value=data.body;preview();
    const index=notes.findIndex(n=>n.file===current.file); if(index<0) notes.push(current);else notes[index]=current;
    dirty=false;
    if(!dirty) sessionStorage.removeItem('reading-unsaved');
    renderList(); state(dirty?'已保存，仍有新修改':publish?'已发布 · 网站部署后更新':'草稿已保存');
  } catch(e) {state(e.message,true);} finally {pending=false;$('save').disabled=$('publish').disabled=$('new').disabled=false;controls.forEach(control=>control.disabled=false);}
}
function newNote() {
  const date=today(); openNote({file:`${date}-${crypto.randomUUID().slice(0,8)}.md`,metadata:{title:'',date,status:'阅读中',tags:[]},body:'## 论文讲什么\n\n\n## 关键方法\n\n\n## 我的想法\n\n\n## 还没想明白的问题\n\n',version:null,draft:true}); $('title').focus(); changed();
}
$('new').onclick=()=>{if(!dirty || confirm('当前内容尚未保存，是否离开？'))newNote();};
$('search').oninput=renderList;
for(const field of [...fields,'body']) $(field).addEventListener('input',changed);
$('save').onclick=()=>save(); $('publish').onclick=()=>save(true);
$('format-note').onclick=()=>{
  const original=$('body').value;
  const formatted=formatReadingNote(original);
  if(formatted===original){state('格式已经整齐');return;}
  formatBackup={file:current.file,body:original};
  $('body').value=formatted;$('undo-format').disabled=false;changed();state('已整理格式 · 可撤销，确认后保存');
};
$('undo-format').onclick=()=>{
  if(!formatBackup || formatBackup.file!==current.file || pending)return;
  if(dirty && !confirm('恢复整理前的正文？整理后的新修改也会撤销。'))return;
  $('body').value=formatBackup.body;formatBackup=null;$('undo-format').disabled=true;changed();state('已恢复整理前的正文');
};
$('settings').onclick=()=>$('settings-dialog').showModal(); $('close-settings').onclick=()=>$('settings-dialog').close();
function insertFormatting(pattern) {
  if(pending)return;
  const area=$('body');let start=area.selectionStart,end=area.selectionEnd;
  let selected=area.value.slice(start,end),replacement,selectionStart,selectionEnd;
  const marker = pattern==='**文字**' ? '**' : pattern==='*文字*' ? '*' : pattern==='`代码`' ? '`' : null;
  if(marker) {
    if(selected.startsWith(marker) && selected.endsWith(marker) && selected.length>=marker.length*2) {
      replacement=selected.slice(marker.length,-marker.length);selectionStart=start;selectionEnd=start+replacement.length;
    } else if(selected && area.value.slice(start-marker.length,start)===marker && area.value.slice(end,end+marker.length)===marker) {
      start-=marker.length;end+=marker.length;replacement=selected;selectionStart=start;selectionEnd=start+selected.length;
    } else {const text=selected || (marker==='`'?'代码':'文字');replacement=marker+text+marker;selectionStart=start+marker.length;selectionEnd=selectionStart+text.length;}
  } else if(pattern==='## ' || pattern==='- ') {
    start=area.value.lastIndexOf('\n',start-1)+1;
    const last=end>start && area.value[end-1]==='\n' ? end-1 : end;
    const next=area.value.indexOf('\n',last);end=next<0?area.value.length:next;
    selected=area.value.slice(start,end);replacement=selected.split('\n').map(line=>pattern+line).join('\n');selectionStart=start;selectionEnd=start+replacement.length;
  } else if(pattern.startsWith('![') || pattern.startsWith('[')) {
    const prefix=pattern.startsWith('![')?'![':'[';const text=selected || (prefix==='!['?'图片说明':'文字');
    replacement=prefix+text+'](https://)';selectionStart=start+prefix.length+text.length+2;selectionEnd=selectionStart+8;
  } else {replacement='$$\n'+(selected || 'E = mc^2')+'\n$$';selectionStart=start+3;selectionEnd=selectionStart+(selected || 'E = mc^2').length;}
  area.setRangeText(replacement,start,end,'end');area.focus();area.setSelectionRange(selectionStart,selectionEnd);changed();
}
document.querySelectorAll('[data-insert]').forEach(button=>{button.addEventListener('mousedown',e=>e.preventDefault());button.onclick=()=>insertFormatting(button.dataset.insert);});
$('restore-note').onclick=async()=>{
  if(pending || !current)return;
  if(!confirm('先备份当前文字，再恢复已保存的版本？'))return;
  try {
    const backup=collect();
    localStorage.setItem(`reading-recovery-${current.file}-${Date.now()}`,JSON.stringify(backup));
    const latest=await latestNotes();const note=latest.find(n=>n.file===current.file);
    if(!note)throw new Error('未找到已保存版本，当前文字已备份');
    notes=latest;sessionStorage.removeItem('reading-unsaved');openNote(note);state('已恢复保存版本 · 原文字已备份');
  }catch(e){state(e.message,true);}
};
document.addEventListener('keydown',e=>{if(document.activeElement===$('body') && (e.ctrlKey || e.metaKey) && ['b','i'].includes(e.key.toLowerCase())){e.preventDefault();insertFormatting(e.key.toLowerCase()==='b'?'**文字**':'*文字*');}});
document.addEventListener('keydown',e=>{if((e.ctrlKey || e.metaKey)&&e.key==='s'){e.preventDefault();save();}});
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
fetch('/api/notes').then(async res=>{if(!res.ok)throw new Error('无法载入笔记');const data=await res.json();notes=data.notes;session=data.session;const recovered=sessionStorage.getItem('reading-unsaved');if(recovered){const note=JSON.parse(recovered);note.recoveredWithoutBaseline=!note.baseMetadata;openNote(note);dirty=true;state('已恢复未保存内容');}else if(notes.length)openNote(notes.slice().sort((a,b)=>String(b.metadata.date).localeCompare(String(a.metadata.date)))[0]);else newNote();}).catch(e=>{state(e.message,true);$('save').disabled=$('publish').disabled=true;});
