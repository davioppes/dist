import {distanceMeters} from './core.mjs';

export function usableRoutePosition(position,mode,now=Date.now()){
  if(!position||!Number.isFinite(position.lat)||Math.abs(position.lat)>90||!Number.isFinite(position.lng)||Math.abs(position.lng)>180)return false;
  if(mode==='demo')return true;
  return mode==='real'&&Number.isFinite(position.accuracy)&&position.accuracy>=0&&position.accuracy<=80&&Number.isFinite(position.timestamp)&&now-position.timestamp<=60000&&position.timestamp-now<=5000;
}

// Each destination owns one request. Reset and replacement invalidate callbacks
// even if a transport ignores AbortSignal or resolves after it was cancelled.
export function createRouteSession(fetchRoute,onChange=()=>{}){
  const empty=()=>({phase:'idle',id:null,mode:null,route:null,error:null,origin:null});
  let state=empty(),generation=0,controller=null;
  const publish=next=>{state=next;onChange(state);};
  return {
    get state(){return state;},
    reset(){generation++;controller?.abort();controller=null;publish(empty());},
    async request(origin,destination,mode,{force=false}={}){
      if(!destination)return;
      const same=state.id===destination.id&&state.mode===mode;
      if(same&&state.phase==='loading')return;
      if(!force&&same&&state.phase==='ready'&&usableRoutePosition(origin,mode)&&distanceMeters(origin,state.origin)<50)return;
      generation++;const requestGeneration=generation;controller?.abort();controller=null;
      if(!usableRoutePosition(origin,mode)){publish({...empty(),phase:'waiting',id:destination.id,mode});return;}
      controller=new AbortController();const requestController=controller;
      const base={...empty(),id:destination.id,mode,origin:{...origin}};
      publish({...base,phase:'loading'});
      try{
        const route=await fetchRoute(origin,destination,{signal:requestController.signal});
        if(generation!==requestGeneration||requestController.signal.aborted)return;
        publish({...base,phase:'ready',route});
      }catch(error){
        if(generation!==requestGeneration||requestController.signal.aborted)return;
        publish({...base,phase:'error',error:error?.code||error?.message||'ROUTE_UNAVAILABLE'});
      }finally{if(generation===requestGeneration)controller=null;}
    }
  };
}
