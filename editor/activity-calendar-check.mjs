import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
let records={'2026-10-08':{exercise:true,piano:false}}, failSave=false;
let notes=[{file:'queued.md',metadata:{title:'GAE queued paper',date:'2026-10-17',status:'准备阅读',tags:[],paper_url:'https://arxiv.org/abs/2609.24981'},body:'My existing notes',version:'initial',draft:true},{file:'read.md',metadata:{title:'Previous reading',date:'2026-10-12',status:'已读完',tags:[]},body:'Saved content',version:'read',draft:false}];
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:950}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('http://127.0.0.1:4319/**',async route=>{
 const url=new URL(route.request().url());
 if(url.pathname.startsWith('/api/')){
  if(url.pathname==='/api/notes')return route.fulfill({json:{notes,session:'test'}});
  if(url.pathname==='/api/activities'){
   if(route.request().method()==='POST'){
    if(failSave)return route.fulfill({status:500,json:{error:'模拟保存失败'}});
    const data=route.request().postDataJSON();records[data.date]={exercise:data.exercise,piano:data.piano};
   }
   return route.fulfill({json:{activities:records,version:JSON.stringify(records),session:'test'}});
  }
  const data=route.request().postDataJSON();const source=`---\n${JSON.stringify(data.metadata)}\n---\n\n${data.body}`;
  const note={...data,version:source,draft:true};const index=notes.findIndex(n=>n.file===data.file);if(index<0)notes.push(note);else notes[index]=note;
  return route.fulfill({json:{version:source}});
 }
 const file=path.join(root,url.pathname==='/'?'editor/index.html':url.pathname.slice(1));
 try{const body=await fs.readFile(file);const ext=path.extname(file);await route.fulfill({body,contentType:ext==='.html'?'text/html':ext==='.js'?'application/javascript':ext==='.css'?'text/css':'application/octet-stream'});}catch{await route.fulfill({status:404,body:''});}
});
try{
 await page.goto('http://127.0.0.1:4319/');
 await page.waitForFunction(()=>document.getElementById('title').value==='GAE queued paper');
 await page.locator('#open-activity-calendar').click();
 await page.locator('#activity-date').fill('2026-10-08');await page.locator('#activity-date').dispatchEvent('change');
 await page.waitForFunction(()=>document.getElementById('activity-exercise').checked);
 assert.equal(await page.locator('[data-date="2026-10-08"] .exercise-dot').count(),1);
 await page.locator('#activity-piano').check();
 await page.locator('[data-date="2026-10-09"]').click();
 await page.waitForFunction(()=>document.getElementById('activity-date').value==='2026-10-09');
 assert.equal(records['2026-10-08'].piano,true);
 await page.locator('#activity-exercise').check();await page.locator('#activity-save').click();
 await page.waitForFunction(()=>document.getElementById('activity-state').textContent.includes('已保存'));
 assert.equal(records['2026-10-09'].exercise,true);
 await page.locator('#activity-exercise').uncheck();await page.locator('#close-activity-calendar').click();
 await page.waitForFunction(()=>!document.getElementById('activity-dialog').open);
 assert.equal(records['2026-10-09'].exercise,false);
 await page.locator('#open-activity-calendar').click();await page.locator('#activity-prev').click();assert.equal(await page.locator('#activity-month').textContent(),'2026 年 09 月');
 await page.locator('#activity-next').click();assert.equal(await page.locator('#activity-month').textContent(),'2026 年 10 月');
 await page.locator('#activity-piano').check();failSave=true;
 await page.locator('[data-date="2026-10-10"]').click();
 await page.waitForFunction(()=>document.getElementById('activity-state').textContent==='模拟保存失败');
 assert.equal(await page.locator('#activity-date').inputValue(),'2026-10-09');assert.equal(await page.locator('#activity-piano').isChecked(),true);
 failSave=false;await page.locator('#activity-save').click();await page.waitForFunction(()=>document.getElementById('activity-state').textContent.includes('已保存'));
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.deepEqual(errors,[]);console.log('Passed: historical dates, month navigation, existing markers, auto-save, uncheck, failure preserves selection, mobile width.');
}finally{await browser.close();}
