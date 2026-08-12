import { createServerSupabase, hasSupabaseConfig } from './supabase.js';

export const ASSURANCE_BUCKET=process.env.SUPABASE_STORAGE_BUCKET||'assurance-regent-files';

const clean=v=>String(v??'').trim();
const safeSegment=v=>clean(v).replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,120)||'file';

export function decodeDataUrl(data){
  const value=clean(data);if(!value.startsWith('data:'))return null;
  const comma=value.indexOf(',');if(comma<0)return null;
  const head=value.slice(5,comma),body=value.slice(comma+1),parts=head.split(';'),contentType=parts[0]||'application/octet-stream',isBase64=parts.includes('base64');
  return {contentType,buffer:isBase64?Buffer.from(body,'base64'):Buffer.from(decodeURIComponent(body),'utf8')};
}

export async function uploadDataUrl({data,pathPrefix='documents',fileName='document',contentType='',upsert=false}={}){
  if(!hasSupabaseConfig())throw new Error('Supabase is required for file storage.');
  const decoded=decodeDataUrl(data);if(!decoded)return null;
  const objectPath=`${safeSegment(pathPrefix)}/${Date.now()}-${safeSegment(fileName)}`;
  const {error}=await createServerSupabase().storage.from(ASSURANCE_BUCKET).upload(objectPath,decoded.buffer,{contentType:clean(contentType)||decoded.contentType,upsert});
  if(error)throw error;
  return {bucket:ASSURANCE_BUCKET,path:objectPath,size:decoded.buffer.length,contentType:clean(contentType)||decoded.contentType};
}

export async function createSignedFileUrl(path,{expiresIn=600}={}){
  const objectPath=clean(path);if(!objectPath)return '';
  const {data,error}=await createServerSupabase().storage.from(ASSURANCE_BUCKET).createSignedUrl(objectPath,Math.max(60,Math.min(Number(expiresIn)||600,3600)));
  if(error)throw error;
  return data?.signedUrl||'';
}

export async function downloadStoredFile(path){
  const objectPath=clean(path);if(!objectPath)return null;
  const {data,error}=await createServerSupabase().storage.from(ASSURANCE_BUCKET).download(objectPath);
  if(error)throw error;
  return Buffer.from(await data.arrayBuffer());
}
