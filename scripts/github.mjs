// Use the configured Git credential helper; never persist or print credentials.
import {execFileSync} from 'node:child_process';
const repo='epictouch22/STARFALL-VOID-FRONTIER';
const raw=execFileSync('git',['credential','fill'],{input:'protocol=https\nhost=github.com\n\n',encoding:'utf8',stdio:['pipe','pipe','ignore']});
const credential=Object.fromEntries(raw.trim().split('\n').map(l=>{const p=l.indexOf('=');return[l.slice(0,p),l.slice(p+1)];}));
async function api(path,method='GET',body){const r=await fetch(`https://api.github.com/repos/${repo}${path}`,{method,headers:{Authorization:`Bearer ${credential.password}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},body:body?JSON.stringify(body):undefined});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(`${r.status}: ${data.message}`);return data;}
try {
 if(process.argv[2]==='enable'){let pages;try{pages=await api('/pages');}catch(e){if(!String(e).includes('404'))throw e;pages=await api('/pages','POST',{build_type:'workflow'});}if(pages.build_type!=='workflow')pages=await api('/pages','PUT',{build_type:'workflow'});console.log(JSON.stringify({url:pages.html_url,build_type:pages.build_type}));}
 else {const data=await api('/actions/runs?per_page=4');console.log(JSON.stringify(data.workflow_runs.map(r=>({id:r.id,status:r.status,conclusion:r.conclusion,sha:r.head_sha,url:r.html_url})),null,2));}
}catch(e){console.error(String(e));process.exitCode=1;}
