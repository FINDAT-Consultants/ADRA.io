import serverless from 'serverless-http';
import { app, initializeAppRuntime } from '../../server.js';

const expressHandler=serverless(app);

export async function handler(event,context){
  try{
    await initializeAppRuntime({background:false});
    return await expressHandler(event,context);
  }catch(error){
    console.error('Assurance Regent Netlify Function initialization failed:',error);
    return {
      statusCode:500,
      headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'},
      body:JSON.stringify({error:error?.message||'Assurance Regent server initialization failed.'})
    };
  }
}
