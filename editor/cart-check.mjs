import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
let notes=[{file:'queued.md',metadata:{title:'GAE queued paper',date:'2026-10-17',status:'准备阅读',tags:[],paper_url:'https://arxiv.org/abs/2609.24981'},body:'My existing notes',version:'initial',draft:true},{file:'read.md',metadata:{title:'Previous reading',date:'2026-10-12',status:'已读完',tags:[]},body:'Saved content',version:'read',draft:false}];
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:950}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('http://127.0.0.1:4319/**',async route=>{
 const url=new URL(route.request().url());
 if(url.pathname.startsWith('/api/')){
  if(url.pathname==='/api/notes')return route.fulfill({json:{notes,session:'test'}});
  if(url.pathname==='/api/activities')return route.fulfill({json:{activities:{},version:null,session:'test'}});
  const data=route.request().postDataJSON();const source=`---\n${JSON.stringify(data.metadata)}\n---\n\n${data.body}`;
  const note={...data,version:source,draft:true};const index=notes.findIndex(n=>n.file===data.file);if(index<0)notes.push(note);else notes[index]=note;
  return route.fulfill({json:{version:source}});
 }
 const file=path.join(root,url.pathname==='/'?'editor/index.html':url.pathname.slice(1));
 try{const body=await fs.readFile(file);const ext=path.extname(file);await route.fulfill({body,contentType:ext==='.html'?'text/html':ext==='.js'?'application/javascript':ext==='.css'?'text/css':'application/octet-stream'});}catch{await route.fulfill({status:404,body:''});}
});
try{
 await page.goto('http://127.0.0.1:4319/');await page.waitForFunction(()=>document.getElementById('title').value==='GAE queued paper');
 assert.equal(await page.locator('#cart-count').textContent(),'1');
 await page.locator('.start-reading').click();await page.locator('#reading-date').fill('2026-10-16');await page.locator('#reading-form button[type=submit]').click();
 await page.waitForFunction(()=>document.getElementById('state').textContent==='已开始阅读 · 2026-10-16');
 assert.equal(notes[0].metadata.date,'2026-10-16');assert.equal(notes[0].metadata.status,'阅读中');assert.equal(notes[0].body,'My existing notes');
 assert.equal(await page.locator('#cart-count').textContent(),'0');assert.equal(await page.locator('#body').inputValue(),'My existing notes');
 await page.locator('#body').fill('Unsaved reading thoughts');
 await page.locator('#add-paper').click();await page.locator('#paper-title').fill('Next paper');await page.locator('#paper-link').fill('https://arxiv.org/abs/2503.11651');await page.locator('#paper-form button[type=submit]').click();
 await page.waitForFunction(()=>document.getElementById('state').textContent.startsWith('已加入待读清单'));
 assert.equal(notes[0].body,'Unsaved reading thoughts');assert.equal(notes.length,3);assert.equal(notes[2].metadata.status,'准备阅读');
 await page.locator('#add-paper').click();await page.locator('#paper-title').fill('Duplicate');await page.locator('#paper-link').fill('https://arxiv.org/abs/2503.11651');await page.locator('#paper-form button[type=submit]').click();
 await page.waitForFunction(()=>document.getElementById('state').textContent==='这篇论文已在清单中');assert.equal(notes.length,3);
 await page.locator('.start-reading').click();await page.locator('#cancel-reading').click();assert.equal(notes[2].metadata.status,'准备阅读');
 await page.locator('#search').fill('Next paper');assert.equal(await page.locator('.note-item').count(),1);
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.locator('#search').fill('');await page.locator('#tab-reading').click();
 const original=structuredClone(notes[0]);
 await page.locator('.note-row').filter({hasText:'GAE queued paper'}).getByRole('button',{name:'再读一次'}).click();
 await page.locator('#reading-date').fill('2026-10-18');await page.locator('#reading-form button[type=submit]').click();
 await page.waitForFunction(()=>document.getElementById('state').textContent==='已开始阅读 · 2026-10-18');
 assert.equal(notes.length,4);assert.deepEqual(notes[0],original);
 assert.notEqual(notes[3].file,original.file);assert.equal(notes[3].metadata.paper_url,original.metadata.paper_url);
 assert.equal(notes[3].metadata.date,'2026-10-18');assert.equal(notes[3].metadata.status,'阅读中');
 assert.equal(notes[3].body,'## 本次阅读笔记\n\n');
 assert.deepEqual(errors,[]);console.log('Passed: queue, start, preserve edits, duplicate guard, search, mobile, repeat reading creates an independent dated note.');
}finally{await browser.close();}
