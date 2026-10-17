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
 await page.locator('#settings').click();await page.locator('#token').fill('fake-test-token');await page.locator('#remember-token').check();await page.locator('#close-settings').click();
 await page.reload();await page.waitForFunction(()=>document.getElementById('title').value==='GAE queued paper');
 assert.equal(await page.locator('#token').inputValue(),'fake-test-token');assert.equal(await page.locator('#remember-token').isChecked(),true);
 await page.locator('#settings').click();await page.locator('#remember-token').uncheck();await page.locator('#close-settings').click();
 await page.reload();await page.waitForFunction(()=>document.getElementById('title').value==='GAE queued paper');assert.equal(await page.locator('#token').inputValue(),'');
 await page.locator('#settings').click();await page.locator('#token').fill('fake-other-token');await page.locator('#remember-token').check();await page.locator('#forget-token').click();
 assert.equal(await page.locator('#token').inputValue(),'');assert.equal(await page.evaluate(()=>localStorage.getItem('reading-github-token')),null);
 assert.deepEqual(errors,[]);console.log('Passed: opt-in persistence across reload, opt-out, clear saved token.');
}finally{await browser.close();}
