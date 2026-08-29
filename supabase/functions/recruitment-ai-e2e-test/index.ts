Deno.serve(()=>new Response(JSON.stringify({error:'Disabled diagnostic endpoint.'}),{status:410,headers:{'content-type':'application/json'}}));
