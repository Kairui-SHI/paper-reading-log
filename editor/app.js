const $ = id => document.getElementById(id);
let notes = [], current = null, session, dirty = false, pending = false;
const fields = ['title','date','status','paper_url','authors','tags','summary','code_url'];
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
function state(text,error=false) { $('state').textContent=text; $('state').classList.toggle('error',error); }
function renderList() {
  $('list').replaceChildren();
  const query = $('search').value.toLowerCase();
  const filtered = notes.filter(n => String(n.metadata.title).toLowerCase().includes(query)).sort((a,b)=>String(b.metadata.date).localeCompare(String(a.metadata.date)));
  for (const note of filtered) {
    const item = document.createElement('button'); item.className='note-item' + (note.file === current?.file ? ' active' : '');
    const date = document.createElement('span'); date.textContent=`${note.metadata.date}${note.draft ? ' · 草稿' : ''}`;
    const title = document.createElement('strong'); title.textContent=note.metadata.title; item.append(date,title);
    item.onclick=()=>{if (!pending && (!dirty || confirm('当前内容尚未保存，是否离开？'))) openNote(note);}; $('list').append(item);
  }
  if (!filtered.length) $('list').textContent='还没有匹配的笔记。';
}
function openNote(note) {
  current=structuredClone(note); dirty=false;
  for (const field of fields) $(field).value = field === 'tags' ? (note.metadata.tags || []).join(', ') : note.metadata[field] || '';
  if (note.metadata.status && !$('status').value) { const option=new Option(note.metadata.status,note.metadata.status); $('status').add(option); $('status').value=note.metadata.status; }
  $('body').value=note.body || ''; renderList(); preview(); state(note.draft ? '草稿已保存' : '已载入笔记');
}
function collect() {
  const metadata={...current.metadata};
  for (const field of fields) metadata[field] = field === 'tags' ? $(field).value.split(/[,，]/).map(s=>s.trim()).filter(Boolean) : $(field).value;
  return {file:current.file,metadata,body:$('body').value,version:current.version ?? null};
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
function changed() {dirty=true; state('未保存');preview(); sessionStorage.setItem('reading-unsaved',JSON.stringify(collect()));}
async function save(publish=false) {
  if(pending || !$('metadata').reportValidity()) return;
  pending=true; $('save').disabled=$('publish').disabled=$('new').disabled=true;
  state(publish?'正在发布…':'正在保存…');
  const data=collect();
  try {
    const res=await fetch(publish?'/api/publish':'/api/save',{method:'POST',headers:{'Content-Type':'application/json','X-Editor-Session':session},body:JSON.stringify({...data,...(publish ? {token:$('token').value.trim()} : {})})});
    const result=await res.json(); if(!res.ok) throw new Error(result.error);
    current={...data,version:result.version,draft:!publish};
    const index=notes.findIndex(n=>n.file===current.file); if(index<0) notes.push(current);else notes[index]=current;
    dirty=JSON.stringify(collect().metadata)!==JSON.stringify(data.metadata) || $('body').value!==data.body;
    if(!dirty) sessionStorage.removeItem('reading-unsaved');
    renderList(); state(dirty?'已保存，仍有新修改':publish?'已发布 · 网站部署后更新':'草稿已保存');
  } catch(e) {state(e.message,true);} finally {pending=false;$('save').disabled=$('publish').disabled=$('new').disabled=false;}
}
function newNote() {
  const date=today(); openNote({file:`${date}-${crypto.randomUUID().slice(0,8)}.md`,metadata:{title:'',date,status:'阅读中',tags:[]},body:'## 论文讲什么\n\n\n## 关键方法\n\n\n## 我的想法\n\n\n## 还没想明白的问题\n\n',version:null,draft:true}); $('title').focus(); changed();
}
$('new').onclick=()=>{if(!dirty || confirm('当前内容尚未保存，是否离开？'))newNote();};
$('search').oninput=renderList;
for(const field of [...fields,'body']) $(field).addEventListener('input',changed);
$('save').onclick=()=>save(); $('publish').onclick=()=>save(true);
$('settings').onclick=()=>$('settings-dialog').showModal(); $('close-settings').onclick=()=>$('settings-dialog').close();
document.querySelectorAll('[data-insert]').forEach(button=>button.onclick=()=>{const area=$('body');area.setRangeText(button.dataset.insert,area.selectionStart,area.selectionEnd,'end');area.focus();changed();});
document.addEventListener('keydown',e=>{if((e.ctrlKey || e.metaKey)&&e.key==='s'){e.preventDefault();save();}});
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
fetch('/api/notes').then(async res=>{if(!res.ok)throw new Error('无法载入笔记');const data=await res.json();notes=data.notes;session=data.session;const recovered=sessionStorage.getItem('reading-unsaved');if(recovered){const note=JSON.parse(recovered);openNote(note);dirty=true;state('已恢复未保存内容');}else if(notes.length)openNote(notes.slice().sort((a,b)=>String(b.metadata.date).localeCompare(String(a.metadata.date)))[0]);else newNote();}).catch(e=>{state(e.message,true);$('save').disabled=$('publish').disabled=true;});
