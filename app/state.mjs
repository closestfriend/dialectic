import { createHmac, timingSafeEqual } from 'node:crypto';

// Signed public evidence travels with the browser so cold starts need no database.
export function stateCodec(secret) {
  const sign=value=>createHmac('sha256',secret).update('dialectic-state-v1:'+value).digest('base64url');
  return {
    encode(kind,data) {
      const payload=Buffer.from(JSON.stringify({kind,data,expires:Date.now()+3600000})).toString('base64url');
      return payload+'.'+sign(payload);
    },
    decode(token,kind) {
      try {
        if(typeof token!=='string'||token.length>1400000)return null;
        const [payload,signature,...rest]=token.split('.');
        const expected=sign(payload);
        if(rest.length||signature?.length!==expected.length||!timingSafeEqual(Buffer.from(signature),Buffer.from(expected)))return null;
        const value=JSON.parse(Buffer.from(payload,'base64url').toString());
        return value.kind===kind&&value.expires>Date.now()?value.data:null;
      }catch{return null;}
    }
  };
}
