import {chromium,webkit,devices} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
const base=process.env.GAME_URL||'http://localhost:4173/STARFALL-VOID-FRONTIER/';
await mkdir('test-results',{recursive:true});
const failures=[];
for(const [name,browserType,options] of [['desktop',chromium,{viewport:{width:1440,height:1000}}],['iphone-webkit',webkit,{...devices['iPhone 13']}]] ){
 const browser=await browserType.launch({headless:true});const page=await browser.newPage(options);const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
 try{
 await page.goto(base,{waitUntil:'networkidle'});await page.screenshot({path:`test-results/${name}-title.png`});await page.locator('[data-action="new"]').click();
 async function moveTo(module){await page.locator('.header-actions [data-action="panel"]').click();await page.locator(`[data-action="navigate"][data-param="${module}"]`).click();await page.waitForTimeout(2600);await page.locator('#interact-button').click();}
 for(const module of ['fabricator','airlock','reactor','engine','cockpit'])await moveTo(module);
 await page.locator('[data-action="scan"]').click();await page.locator('.quick-nav [data-param="galaxy"]').click();await page.locator('[data-action="navigate"][data-param="0-s"]').click();await page.waitForTimeout(6500);await page.locator('#interact-button').click();
 await page.screenshot({path:`test-results/${name}-game.png`});
 const system=await page.locator('#system-name').innerText();if(!system.includes('СТЫКОВКА'))throw new Error(`Docking failed: ${system}`);
 await page.locator('.quick-nav [data-param="inventory"]').click();await page.locator('[data-action="use"][data-param="fuel"]').click();await page.locator('.menu-tabs [data-action="panel"][data-param="medical"]').click();await page.screenshot({path:`test-results/${name}-medical.png`});
 await page.locator('.menu-tabs [data-action="panel"][data-param="trade"]').click();await page.locator('[data-action="buy"][data-param="iron"]').click();await page.locator('.menu-tabs [data-action="panel"][data-param="quests"]').click();await page.locator('[data-action="accept"]').first().click();await page.locator('.menu-tabs [data-action="panel"][data-param="settings"]').click();await page.locator('#modal [data-action="save"]').click();
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('starfall-save-v1-0')).payload);const state=JSON.parse(saved);if(state.intro!==4||state.mode!=='station'||state.contracts.length!==1)throw new Error('Saved progress mismatch');
 await page.reload({waitUntil:'networkidle'});await page.locator('[data-action="continue"]').click();if(!(await page.locator('#system-name').innerText()).includes('СТЫКОВКА'))throw new Error('Reload lost location');
 if(errors.length)throw new Error(errors.join('\n'));console.log(`${name}: PASS repair → flight → scan → autopilot → dock → trade → contract → save → reload`);
 }catch(e){failures.push(`${name}: ${e.message}`);await page.screenshot({path:`test-results/${name}-failure.png`});console.error(failures.at(-1));}finally{await browser.close();}
}
if(failures.length)process.exitCode=1;
