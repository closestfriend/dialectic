import * as mlflow from 'mlflow-tracing';

let enabled=false;
if(process.env.MLFLOW_TRACKING_URI&&process.env.MLFLOW_EXPERIMENT_ID){
  mlflow.init({trackingUri:process.env.MLFLOW_TRACKING_URI,experimentId:process.env.MLFLOW_EXPERIMENT_ID});
  enabled=true;
}
// Callers pass explicit public inputs only. Never wrap the credential-bearing client factory.
export async function traceOperation(name,inputs,fn,{tool=false,summarize=x=>x}={}){
  if(!enabled)return fn();
  return mlflow.withSpan(async span=>{
    span.setInputs(inputs);
    const result=await fn();
    span.setOutputs(summarize(result));
    return result;
  },{name,spanType:tool?mlflow.SpanType.TOOL:mlflow.SpanType.CHAIN});
}
export async function flushTracing(){if(enabled)await mlflow.flushTraces();}
