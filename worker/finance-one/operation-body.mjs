import {FinanceAccessError} from './organization-access.mjs';
const invalid=message=>{throw new FinanceAccessError(message,400);};
/** Bounded body consumption, including chunked requests with no Content-Length. */
export async function readOperationBody(request,keys){
 if(!/^application\/json(?:;|$)/i.test(request.headers.get('content-type')||''))invalid('JSON required');
 const reader=request.body?.getReader();if(!reader)invalid('Request body required');
 let size=0;const parts=[];
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;
  if(size>8192){await reader.cancel();invalid('Request body too large');}parts.push(value);}}
 finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.byteLength;}
 let value;try{value=JSON.parse(new TextDecoder().decode(bytes));}catch{invalid('Invalid JSON');}
 if(!value||Array.isArray(value)||typeof value!=='object'||Object.keys(value).some(k=>!keys.includes(k)))invalid('Unexpected request fields');
 return value;
}
