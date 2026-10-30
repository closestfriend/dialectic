import fs from 'node:fs';
const env=fs.readFileSync('.env','utf8');
if(/^MLFLOW_TRACKING_URI=.+$/m.test(env)&&/^MLFLOW_EXPERIMENT_ID=.+$/m.test(env)){
  console.log('MLflow is already configured; preserving its destination.');
}else{
  const trackingUri='http://127.0.0.1:5001',name='DIALECTIC commissioning';
  const response=await fetch(trackingUri+'/api/2.0/mlflow/experiments/get-by-name?experiment_name='+name,{signal:AbortSignal.timeout(5000)});
  let id;
  if(response.ok)id=(await response.json()).experiment.experiment_id;
  else if(response.status===404){
    const created=await fetch(trackingUri+'/api/2.0/mlflow/experiments/create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name}),signal:AbortSignal.timeout(5000)});
    if(!created.ok)throw Error('Could not create local MLflow experiment.');
    id=(await created.json()).experiment_id;
  }else throw Error('Start the local MLflow collector before configuring tracing.');
  const cleaned=env.split('\n').filter(x=>!/^MLFLOW_(TRACKING_URI|EXPERIMENT_ID)=/.test(x)).join('\n').trimEnd();
  fs.writeFileSync('.env',`${cleaned}\nMLFLOW_TRACKING_URI=${trackingUri}\nMLFLOW_EXPERIMENT_ID=${id}\n`,{mode:0o600});fs.chmodSync('.env',0o600);
  console.log(`Local MLflow tracing configured: experiment ${id}, ${trackingUri}`);
}
