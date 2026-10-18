const $ = id => document.getElementById(id);
let notes = [], current = null, session, dirty = false, pending = false;
let formatBackup = null;
let listView='reading', readingTarget=null;
const fields = ['title','date','status','paper_url','authors','tags','summary','code_url'];
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
let activityVersion=null, activitySession=null, activityDate=today(), activityRecords={}, activityDirty=false, activityPending=false;
let activityMonth=activityDate.slice(0,7);
const activityControls=()=>[...document.querySelectorAll('#activity-dialog button, #activity-dialog input')];
function renderActivityCalendar(){
  $('activity-month').textContent=activityMonth.replace('-', ' 年 ')+' 月';
  $('activity-calendar').replaceChildren();
  const [year,month]=activityMonth.split('-').map(Number);
  const offset=(new Date(year,month-1,1).getDay()+6)%7, count=new Date(year,month,0).getDate();
  for(let i=0;i<offset;i++)$('activity-calendar').append(document.createElement('span'));
  for(let day=1;day<=count;day++){
    const date=`${activityMonth}-${String(day).padStart(2,'0')}`,record=activityRecords[date] || {};
    const button=document.createElement('button');button.type='button';button.className='activity-day';button.textContent=day;
    button.dataset.date=date;button.disabled=activityPending;button.classList.toggle('selected',date===activityDate);button.classList.toggle('today',date===today());
    button.setAttribute('aria-pressed',String(date===activityDate));if(date===today())button.setAttribute('aria-current','date');
    button.setAttribute('aria-label',`${date}${record.exercise?'，已健身':''}${record.piano?'，已练琴':''}`);
    const dots=document.createElement('span');dots.className='activity-dots';
    for(const kind of ['exercise','piano'])if(record[kind]){const dot=document.createElement('i');dot.className=kind+'-dot';dots.append(dot);}
    button.append(dots);button.onclick=()=>selectActivityDate(date);$('activity-calendar').append(button);
  }
}
function showActivityDate(){
  $('activity-date').value=activityDate;
  $('activity-exercise').checked=activityRecords[activityDate]?.exercise===true;
  $('activity-piano').checked=activityRecords[activityDate]?.piano===true;
  activityDirty=false;renderActivityCalendar();
}
async function loadActivities(){
  const res=await fetch('/api/activities');if(!res.ok)throw new Error('打卡记录载入失败，请关闭后重新打开');
  const data=await res.json();activityVersion=data.version;activitySession=data.session;activityRecords=data.activities;
  showActivityDate();
}
async function updateActivities(publish){
  if(activityPending || !activitySession)return false;
  activityPending=true;activityControls().forEach(e=>e.disabled=true);
  try{
    $('activity-state').textContent=publish?'正在同步…':'正在保存…';
    const data={date:activityDate,exercise:$('activity-exercise').checked,piano:$('activity-piano').checked,version:activityVersion,publish,token:publish?$('token').value.trim():undefined};
    const send=()=>fetch('/api/activities',{method:'POST',headers:{'Content-Type':'application/json','X-Editor-Session':activitySession},body:JSON.stringify(data)});
    let res=await send();if(res.status===403){const fresh=await(await fetch('/api/activities')).json();activitySession=fresh.session;res=await send();}
    const result=await res.json();if(!res.ok)throw new Error(result.error);
    activityVersion=result.version;activityRecords=result.activities;activityDirty=false;
    $('activity-state').textContent=publish?'已同步 · 网站部署后更新':'已保存 · '+activityDate;
    return true;
  }catch(e){$('activity-state').textContent=e.message;return false;}
  finally{activityPending=false;activityControls().forEach(e=>e.disabled=false);renderActivityCalendar();}
}
async function selectActivityDate(date){
  if(activityPending)return;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)){$('activity-date').value=activityDate;return;}
  if(activityDirty && !await updateActivities(false)){$('activity-date').value=activityDate;return;}
  activityDate=date;activityMonth=date.slice(0,7);showActivityDate();$('activity-state').textContent='';
}
async function shiftActivityMonth(delta){
  if(activityPending)return;
  if(activityDirty && !await updateActivities(false))return;
  const [y,m]=activityMonth.split('-').map(Number),d=new Date(y,m-1+delta,1);
  activityMonth=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;renderActivityCalendar();
}
$('activity-prev').onclick=()=>shiftActivityMonth(-1);$('activity-next').onclick=()=>shiftActivityMonth(1);
$('activity-today').onclick=()=>selectActivityDate(today());
$('activity-date').onchange=()=>selectActivityDate($('activity-date').value);
$('activity-save').onclick=()=>updateActivities(false);$('activity-publish').onclick=()=>updateActivities(true);
for(const id of ['activity-exercise','activity-piano'])$(id).onchange=()=>{activityDirty=true;$('activity-state').textContent='未保存';};
$('open-activity-calendar').onclick=async()=>{
  $('activity-dialog').showModal();
  if(!activityDirty){
    activityPending=true;activityControls().forEach(e=>e.disabled=true);$('activity-state').textContent='正在载入…';
    try{await loadActivities();$('activity-state').textContent='';}catch(e){$('activity-state').textContent=e.message;}
    finally{activityPending=false;activityControls().forEach(e=>e.disabled=false);renderActivityCalendar();if(!activitySession){$('activity-exercise').disabled=$('activity-piano').disabled=$('activity-save').disabled=$('activity-publish').disabled=true;}}
  }
};
async function closeActivityCalendar(){if(activityPending)return;if(activityDirty && !await updateActivities(false))return;$('activity-dialog').close();}
$('close-activity-calendar').onclick=closeActivityCalendar;
$('activity-dialog').addEventListener('cancel',event=>{event.preventDefault();closeActivityCalendar();});
renderActivityCalendar();
function state(text,error=false) { $('state').textContent=text; $('state').classList.toggle('error',error); }
function renderList() {
  $('list').replaceChildren();
  $('cart-count').textContent=notes.filter(n=>n.metadata.status==='准备阅读').length;
  $('tab-cart').setAttribute('aria-pressed',String(listView==='cart'));
  $('tab-reading').setAttribute('aria-pressed',String(listView==='reading'));
  const keywords = $('search').value.normalize('NFKC').toLowerCase().trim().split(/\s+/).filter(Boolean);
  const filtered = notes.filter(n => (n.metadata.status==='准备阅读')===(listView==='cart')).filter(n => {
    const text = [n.metadata.title, n.metadata.authors, ...(n.metadata.tags || []), n.metadata.summary, n.body].join(' ').normalize('NFKC').toLowerCase();
    return keywords.every(keyword => text.includes(keyword));
  }).sort((a,b)=>String(b.metadata.date).localeCompare(String(a.metadata.date)));
  for (const note of filtered) {
    const item = document.createElement('button'); item.className='note-item' + (note.file === current?.file ? ' active' : '');
    const date = document.createElement('span'); date.textContent=note.metadata.status==='准备阅读' ? '准备阅读 · 尚未开始' : `${note.metadata.date}${note.draft ? ' · 草稿' : ''}`;
    const title = document.createElement('strong'); title.textContent=note.metadata.title; item.append(date,title);
    item.onclick=()=>{if (!pending && (!dirty || confirm('当前内容尚未保存，是否离开？'))) openNote(note);};
    const row=document.createElement('div');row.className='note-row';row.append(item);
    {const start=document.createElement('button');start.className='start-reading';start.textContent=note.metadata.status==='准备阅读'?'开始阅读 →':'再读一次';start.onclick=()=>showReadingDialog(note);row.append(start);}
    $('list').append(row);
  }
  if (!filtered.length) $('list').textContent=$('search').value.trim() ? '没有匹配的论文。' : listView==='cart' ? '把想读的论文放进来，准备好后再开始。' : '选择待读论文，开始一次阅读。';
}
function openNote(note) {
  formatBackup=null; $('undo-format').disabled=true;
  current=structuredClone(note); dirty=false;
  listView=note.metadata.status==='准备阅读'?'cart':'reading';
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
    listView=data.metadata.status==='准备阅读'?'cart':'reading';
    dirty=false;
    if(!dirty) sessionStorage.removeItem('reading-unsaved');
    renderList(); state(dirty?'已保存，仍有新修改':publish?'已发布 · 网站部署后更新':'草稿已保存');
    return true;
  } catch(e) {state(e.message,true);return false;} finally {pending=false;$('save').disabled=$('publish').disabled=$('new').disabled=false;controls.forEach(control=>control.disabled=false);}
}
function newNote() {
  listView='reading'; const date=today(); openNote({file:`${date}-${crypto.randomUUID().slice(0,8)}.md`,metadata:{title:'',date,status:'阅读中',tags:[]},body:'## 论文讲什么\n\n\n## 关键方法\n\n\n## 我的想法\n\n\n## 还没想明白的问题\n\n',version:null,draft:true}); $('title').focus(); changed();
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
const tokenStorageKey='reading-github-token';
try{const saved=localStorage.getItem(tokenStorageKey);if(saved){$('token').value=saved;$('remember-token').checked=true;}}
catch{$('token-storage-state').textContent='浏览器不允许本地存储，令牌仅在本次页面使用';}
function persistToken(){
  try{
    if($('remember-token').checked && $('token').value.trim()){
      localStorage.setItem(tokenStorageKey,$('token').value.trim());$('token-storage-state').textContent='令牌已保存到此浏览器';
    }else{localStorage.removeItem(tokenStorageKey);$('token-storage-state').textContent='令牌仅在本次页面使用';}
    return true;
  }catch{$('token-storage-state').textContent='保存失败：浏览器不允许本地存储，令牌仍可在本次页面使用';return false;}
}
$('remember-token').onchange=persistToken;
$('token').addEventListener('input',persistToken);
$('forget-token').onclick=()=>{
  try{localStorage.removeItem(tokenStorageKey);$('token').value='';$('remember-token').checked=false;$('token-storage-state').textContent='已清除保存的令牌';}
  catch{$('token-storage-state').textContent='清除失败，请在浏览器设置中清除此网站的数据';}
};
$('settings').onclick=()=>$('settings-dialog').showModal();
$('close-settings').onclick=()=>{if(persistToken())$('settings-dialog').close();};
$('settings-dialog').addEventListener('cancel',()=>persistToken());
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
window.addEventListener('beforeunload',e=>{if(dirty || activityDirty || activityPending){e.preventDefault();e.returnValue='';}});
fetch('/api/notes').then(async res=>{if(!res.ok)throw new Error('无法载入笔记');const data=await res.json();notes=data.notes;session=data.session;const recovered=sessionStorage.getItem('reading-unsaved');if(recovered){const note=JSON.parse(recovered);note.recoveredWithoutBaseline=!note.baseMetadata;openNote(note);dirty=true;state('已恢复未保存内容');}else if(notes.length)openNote(notes.slice().sort((a,b)=>String(b.metadata.date).localeCompare(String(a.metadata.date)))[0]);else newNote();}).catch(e=>{state(e.message,true);$('save').disabled=$('publish').disabled=true;});

function setListView(view){if(pending)return;listView=view;renderList();}
$('tab-cart').onclick=()=>setListView('cart');
$('tab-reading').onclick=()=>setListView('reading');
$('add-paper').onclick=()=>{if(pending)return;$('paper-form').reset();$('paper-dialog').showModal();$('paper-title').focus();};
$('cancel-paper').onclick=()=>$('paper-dialog').close();
$('paper-form').onsubmit=async event=>{
  event.preventDefault();if(pending)return;
  const title=$('paper-title').value.trim(),link=$('paper-link').value.trim();
  if(!title){$('paper-title').setCustomValidity('请填写论文标题');$('paper-title').reportValidity();return;}
  const duplicate=notes.find(n=>n.metadata.paper_url===link);
  if(dirty && !await save())return;
  if(duplicate){$('paper-dialog').close();openNote(duplicate);state('这篇论文已在清单中');return;}
  const date=today();
  openNote({file:`${date}-${crypto.randomUUID().slice(0,8)}.md`,metadata:{title,date,status:'准备阅读',tags:[],paper_url:link},body:'## 阅读笔记\n\n',version:null,draft:true});
  changed();$('paper-dialog').close();
  if(await save())state('已加入待读清单 · 开始阅读时选择日期');
};
$('paper-title').oninput=()=>$('paper-title').setCustomValidity('');
function showReadingDialog(note){
  if(pending)return;readingTarget=note.file;$('reading-paper-title').textContent=note.metadata.title;
  $('reading-date').value=today();$('reading-error').textContent='';$('reading-dialog').showModal();
}
$('cancel-reading').onclick=()=>$('reading-dialog').close();
$('reading-form').onsubmit=async event=>{
  event.preventDefault();if(pending)return;
  const date=$('reading-date').value;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return;
  if(dirty && !await save()){$('reading-error').textContent='当前笔记保存失败，请先处理后重试';return;}
  const note=notes.find(n=>n.file===readingTarget);if(!note)return;
  if(note.metadata.status==='准备阅读')openNote(note);
  else openNote({file:`${date}-${crypto.randomUUID().slice(0,8)}.md`,metadata:{...structuredClone(note.metadata),date,status:'阅读中'},body:'## 本次阅读笔记\n\n',version:null,draft:true});
  $('date').value=date;$('status').value='阅读中';changed();
  if(await save()){$('reading-dialog').close();state('已开始阅读 · '+date);$('body').focus();}
  else $('reading-error').textContent='保存失败，内容已保留，请关闭此窗口后重试保存';
};
