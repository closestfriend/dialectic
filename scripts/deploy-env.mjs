import { spawnSync } from 'node:child_process';
for (const key of ['QLOO_API_KEY','QLOO_BASE_URL']) {
  if(!process.env[key])throw Error('Missing '+key);
  const result=spawnSync('vercel',['env','add',key,'production','--force','--yes'],{input:process.env[key],encoding:'utf8'});
  console.log(key+': '+(result.status===0?'configured':'failed'));
  if(result.status!==0){console.error(result.stderr);process.exit(1);}
}
