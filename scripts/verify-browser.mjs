import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try{
  const context=await browser.newContext({viewport:{width:1440,height:1050},deviceScaleFactor:1,acceptDownloads:true});
  const page=await context.newPage();
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(process.env.BASE_URL??'http://127.0.0.1:4317');
  await page.locator('[data-pair="0"]').click();
  await page.locator('#matches-a .match').first().click();await page.locator('#matches-b .match').first().click();
  await page.locator('#collide').click();
  await page.waitForFunction(()=>document.querySelectorAll('.brief-card').length===3&&!document.querySelector('#collide').disabled,{timeout:90_000});
  assert.equal(await page.locator('.brief-card').count(),3);
  const event=page.waitForEvent('download');await page.locator('#download-brief').click();
  const download=await event;await download.saveAs('docs/dialectic-demo-brief.md');
  const downloaded=await fs.readFile('docs/dialectic-demo-brief.md','utf8');
  assert.match(downloaded,/Qloo observation/);assert.match(downloaded,/Proposed direction/);
  const evidenceEvent=page.waitForEvent('download');await page.locator('#export').click();
  const evidenceDownload=await evidenceEvent;await evidenceDownload.saveAs('.local/browser-evidence.json');
  const evidence=JSON.parse(await fs.readFile('.local/browser-evidence.json','utf8'));
  assert.equal(evidence.evidence.length,12);
  assert.equal(evidence.evidence.filter(e=>e.params?.['signal.interests.entities']&&!e.params['signal.interests.entities'].includes(',')).length,6);
  await page.locator('#brief-section').screenshot({path:'docs/dialectic-commissioning-desktop.png'});
  await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'docs/dialectic-home-desktop.png'});
  // Regression: changing the goal must hide an already-open Markdown draft.
  await page.locator('#markdown-wrap summary').click();await page.locator('#project-goal').selectOption('introduction');
  assert.equal(await page.locator('#markdown-wrap').isHidden(),true);
  assert.equal(await page.locator('#brief-cards').isHidden(),true);
  await page.locator('#project-goal').selectOption('collaboration');
  await page.locator('#tolerance').fill('0');assert.equal(await page.locator('#markdown-wrap').isHidden(),true);
  await page.locator('#refresh-brief').click();
  await page.waitForFunction(()=>document.querySelector('#brief-notice').textContent.includes('No reference meets'));
  assert.equal(await page.locator('.brief-card').count(),0);
  await page.locator('#tolerance').fill('10');await page.locator('#refresh-brief').click();
  await page.waitForFunction(()=>document.querySelectorAll('.brief-card').length===3&&!document.querySelector('#collide').disabled);
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390);
  await page.locator('.brief-card').first().screenshot({path:'docs/dialectic-commissioning-mobile.png'});
  await page.emulateMedia({media:'print'});
  assert.equal(await page.locator('#results').isVisible(),false);
  assert.equal(await page.locator('.brief-card').first().isVisible(),true);
  await page.emulateMedia({media:'screen'});
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({directions:3,download:download.suggestedFilename(),goalInvalidation:true,emptyState:true,mobileOverflow:false,printView:true,pageErrors:errors},null,2));
}finally{await browser.close();}
