/* Assurance Regent v6.3.80 — Google Meet Media API browser bridge.
 * Google reference implementation is pinned in package.json and bundled at build time.
 * The bridge is receive-only: audio + participant metadata, no microphone/video publishing.
 */
import {MeetMediaApiClientImpl} from 'google-meet-media-reference/web/internal/meetmediaapiclient_impl';
import {MeetConnectionState} from 'google-meet-media-reference/web/types/enums';

let client:any=null;
let currentSpace='';
let audioStreams:MediaStream[]=[];

function emit(name:string,detail:any={}){
  try{window.dispatchEvent(new CustomEvent(name,{detail}));}catch{}
}
function serializeError(err:any){
  const raw=String(err?.message||err||'Google Meet Media API failed.');
  let code='';
  try{const parsed=JSON.parse(raw);code=String(parsed?.error?.status||parsed?.error?.details?.[0]?.reason||'');}catch{}
  const match=raw.match(/\b(NO_ACTIVE_CONFERENCE|CONSENTER_ABSENT|DISABLED_BY_ADMIN|DISABLED_BY_HOST_CONTROL|DISABLED_DUE_TO_WATERMARKING|DISABLED_DUE_TO_ENCRYPTION|INCOMPATIBLE_DEVICE|UNSUPPORTED_PLATFORM_PRESENT|CONNECTIONS_EXHAUSTED|PERMISSION_DENIED|UNAUTHENTICATED)\b/);
  return {message:raw,code:code||match?.[1]||''};
}
function participantLabel(item:any){
  const p=item?.participant||item||{};
  return String(p?.signedInUser?.displayName||p?.anonymousUser?.displayName||p?.phoneUser?.displayName||'Participant');
}
function stateName(state:any){
  switch(state){
    case MeetConnectionState.WAITING:return 'WAITING';
    case MeetConnectionState.JOINED:return 'JOINED';
    case MeetConnectionState.DISCONNECTED:return 'DISCONNECTED';
    default:return 'UNKNOWN';
  }
}

function createAudioClient(config:{meetingSpaceId:string;accessToken:string}){
  const meetingSpaceId=String(config?.meetingSpaceId||'').trim(),accessToken=String(config?.accessToken||'').trim();
  if(!meetingSpaceId)throw new Error('Google Meet meeting space ID is required.');
  if(!accessToken)throw new Error('Google Meet Media API access token is required.');
  if(typeof RTCPeerConnection==='undefined')throw new Error('This browser does not support the WebRTC features required by Google Meet Media API.');
  if(client){try{client.leaveMeeting?.();}catch{}client=null;}
  audioStreams=[];currentSpace=meetingSpaceId;
  client=new MeetMediaApiClientImpl({meetingSpaceId,numberOfVideoStreams:0,enableAudioStreams:true,accessToken});
  client.sessionStatus.subscribe((status:any)=>{
    emit('assurance-regent-meet-media-status',{state:stateName(status?.connectionState),spaceId:currentSpace,rawState:status?.connectionState});
  });
  client.participants.subscribe((rows:any[])=>{
    const participants=Array.isArray(rows)?rows:[];
    emit('assurance-regent-meet-media-participants',{spaceId:currentSpace,count:participants.length,names:participants.map(participantLabel).slice(0,100)});
  });
  client.meetStreamTracks.subscribe((rows:any[])=>{
    const tracks=Array.isArray(rows)?rows:[],audio=tracks.filter(x=>x?.mediaStreamTrack?.kind==='audio');
    audioStreams=audio.map(x=>{const stream=new MediaStream();stream.addTrack(x.mediaStreamTrack);return stream;});
    emit('assurance-regent-meet-media-tracks',{spaceId:currentSpace,audioTracks:audio.length,videoTracks:tracks.filter(x=>x?.mediaStreamTrack?.kind==='video').length});
  });
  emit('assurance-regent-meet-media-status',{state:'CREATED',spaceId:currentSpace});
  return {spaceId:currentSpace};
}
async function joinMeeting(){
  if(!client)throw new Error('Create the Google Meet Media API client before joining.');
  emit('assurance-regent-meet-media-status',{state:'JOINING',spaceId:currentSpace});
  try{await client.joinMeeting();emit('assurance-regent-meet-media-status',{state:'SIGNALLED',spaceId:currentSpace});return {ok:true,spaceId:currentSpace};}
  catch(err){const detail=serializeError(err);emit('assurance-regent-meet-media-error',{...detail,spaceId:currentSpace});throw err;}
}
async function leaveMeeting(){
  if(!client)return {ok:true};
  try{await client.leaveMeeting();}finally{client=null;audioStreams=[];emit('assurance-regent-meet-media-status',{state:'DISCONNECTED',spaceId:currentSpace});currentSpace='';}
  return {ok:true};
}
function snapshot(){return {connected:Boolean(client),spaceId:currentSpace,audioStreams:audioStreams.length};}

(window as any).AssuranceRegentMeetMedia={version:'6.3.80',createAudioClient,joinMeeting,leaveMeeting,snapshot};
