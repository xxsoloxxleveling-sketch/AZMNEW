import { OmrClient,Transport } from '../../../src/features/omr/contracts';
export interface Staff {id:string;name:string;email:string;role:string}
export function apiOrigin(input:string) {
  const url=new URL(input);
  if(url.username||url.password||url.search||url.hash||url.pathname!=='/' || (url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]','10.0.2.2'].includes(url.hostname)))) throw new Error('Use an HTTPS API origin, or a local development server');
  return url.origin;
}
/** Credentials and captures have no persistent storage path. Closing/reloading requires sign-in. */
export function createMemorySession(onExpired:()=>void,fetcher:typeof fetch=fetch) {
  let origin='',access='',refresh='',refreshing:Promise<boolean>|null=null;
  let generation=0;
  const pending=new Set<AbortController>();
  const clear=()=>{generation++;access='';refresh='';for(const controller of pending)controller.abort();pending.clear();};
  async function send(path:string,options:RequestInit={},timeout=60000) {
    if(!path.startsWith('/api/'))throw new Error('Invalid API resource');
    const controller=new AbortController();pending.add(controller);const timer=setTimeout(()=>controller.abort(),timeout);
    try {return await fetcher(origin+path,{...options,credentials:'omit',cache:'no-store',headers:{...(!(options.body instanceof Blob)?{'Content-Type':'application/json'}:{}),...(access?{Authorization:`Bearer ${access}`} :{}),...options.headers},signal:controller.signal});}
    catch(problem){if(controller.signal.aborted)throw new Error('Request interrupted or timed out. Keep this screen open and retry.');if(problem instanceof TypeError)throw new Error(new URL(origin).hostname==='127.0.0.1'?'Cannot reach the local test server. Keep USB connected and restore the testing connection, then retry without closing this screen.':'Cannot reach the server. Check your connection and retry without closing this screen.');throw problem;}
    finally{clearTimeout(timer);pending.delete(controller);}
  }
  async function refreshOnce() {
    if(refreshing)return refreshing;
    const ticket=generation;
    refreshing=(async()=>{try{const response=await send('/api/auth/refresh',{method:'POST',body:JSON.stringify({refreshToken:refresh})});const value=await response.json();if(ticket!==generation||!response.ok||!value.data?.accessToken)return false;access=value.data.accessToken;refresh=value.data.refreshToken||refresh;return true;}catch{return false;}finally{refreshing=null;}})();
    return refreshing;
  }
  async function authorized(path:string,options?:RequestInit) {
    const ticket=generation;
    let response=await send(path,options);
    if(ticket!==generation)throw new Error('Session ended');
    if(response.status===401) {
      if(refresh && await refreshOnce())response=await send(path,options);
      if(ticket!==generation)throw new Error('Session ended');
      if(response.status===401){clear();onExpired();throw new Error('Your session expired. Sign in again.');}
    }
    return response;
  }
  const request:Transport=async<T>(path:string,options?:RequestInit)=>{
    const response=await authorized(path,options);const payload=await response.json().catch(()=>null);
    if(!response.ok||payload?.success===false)throw new Error(payload?.error?.message||'The server could not complete this request');
    return payload.data as T;
  };
  return {
    client:new OmrClient(request,async(id,kind,captureId)=>{const resource=kind==='identity-detail'?`/api/omr/scans/${encodeURIComponent(id)}/identity-captures/${encodeURIComponent(captureId||'')}/image`:`/api/omr/scans/${encodeURIComponent(id)}/image?kind=${kind}`;const response=await authorized(resource);if(!response.ok)throw new Error('Private scan evidence is not available');return response.blob();}),
    async login(base:string,email:string,password:string):Promise<Staff> {
      clear();origin=apiOrigin(base);const ticket=generation;
      const response=await send('/api/auth/login',{method:'POST',body:JSON.stringify({email,password})});
      const payload=await response.json().catch(()=>null);
      if(ticket!==generation)throw new Error('Sign-in cancelled');
      if(!response.ok||!payload?.data?.accessToken)throw new Error(payload?.error?.message||'Sign-in failed');
      const user=payload.data.user as Staff;
      if(!['SUPER_ADMIN','ADMIN','TEACHER'].includes(user.role))throw new Error('OMR staff access is required');
      access=payload.data.accessToken;refresh=payload.data.refreshToken;return user;
    },
    logout(){const token=access;clear();if(token){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000);void fetcher(origin+'/api/auth/logout',{method:'POST',headers:{Authorization:`Bearer ${token}`},credentials:'omit',cache:'no-store',signal:controller.signal}).catch(()=>{}).finally(()=>clearTimeout(timer));}},
    origin:()=>origin,
  };
}
