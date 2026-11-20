import {distanceMeters} from './core.mjs';

// The /routed-foot/ instance is built with a pedestrian profile. Merely changing
// the profile word on a driving OSRM server would not produce walking routes.
const ENDPOINT = 'https://routing.openstreetmap.de/routed-foot/route/v1/foot/';
const TIMEOUT = 10_000, MAX_POINTS = 20_000, MAX_STEPS = 500, MAX_SNAP = 250;
const PROVIDER = 'FOSSGIS / OSRM foot';
const ATTRIBUTION = 'Routing: FOSSGIS / OSRM · © OpenStreetMap contributors';
export const ROUTING_LINKS = Object.freeze({
  provider:'https://routing.openstreetmap.de/about.html',
  attribution:'https://www.openstreetmap.org/copyright',
  fixMap:'https://www.openstreetmap.org/fixthemap'
});

export class RoutingError extends Error {
  constructor(code, message) {super(message);this.name='RoutingError';this.code=code;}
}
const failure = (code, message) => new RoutingError(code, message);
const invalid = () => failure('INVALID_RESPONSE','The walking service returned an unusable route. Try another destination.');
const validPosition = p => !!p && Number.isFinite(p.lat) && Math.abs(p.lat)<=90 && Number.isFinite(p.lng) && Math.abs(p.lng)<=180;
const validPair = p => Array.isArray(p) && p.length>=2 && Number.isFinite(p[0]) && Math.abs(p[0])<=180 && Number.isFinite(p[1]) && Math.abs(p[1])<=90;
const metric = n => Number.isFinite(n) && n>=0;
const point = p => ({lat:p[0],lng:p[1]});
const clean = value => typeof value==='string' ? value.replace(/[\u0000-\u001f\u007f-\u009f]/g,' ').replace(/\s+/g,' ').trim().slice(0,120) : '';
const abortError = () => Object.assign(new Error('Walking route cancelled.'),{name:'AbortError'});
let requestQueue=Promise.resolve(),lastRequestStartedAt=-Infinity;

function requestSlot(signal) {
  const slot=requestQueue.then(async()=>{
    if(signal.aborted)throw abortError();
    const delay=Math.max(0,1100-(Date.now()-lastRequestStartedAt));
    if(delay)await new Promise((resolve,reject)=>{
      const finish=()=>{signal.removeEventListener('abort',cancel);resolve();};
      const timer=setTimeout(finish,delay);
      const cancel=()=>{clearTimeout(timer);signal.removeEventListener('abort',cancel);reject(abortError());};
      signal.addEventListener('abort',cancel,{once:true});
    });
    if(signal.aborted)throw abortError();
    lastRequestStartedAt=Date.now();
  });
  // Cancelled callers retain their place in the promise chain until their
  // predecessor completes; this prevents the next caller jumping the gate.
  requestQueue=slot.catch(()=>{});
  return slot;
}

function instruction(step) {
  const type=step.maneuver?.type, name=clean(step.name);
  const modifier=['left','right','slight left','slight right','sharp left','sharp right','straight','uturn'].includes(step.maneuver?.modifier) ? step.maneuver.modifier : '';
  const onto=name?` onto ${name}`:'';
  if(type==='depart')return `Start walking${name?` on ${name}`:''}.`;
  if(type==='arrive')return 'Arrive near your destination.';
  if(type==='roundabout'||type==='rotary')return `At the roundabout, ${Number.isInteger(step.maneuver.exit)&&step.maneuver.exit>0?`take exit ${Math.min(step.maneuver.exit,30)}`:'follow the walking route'}${onto}.`;
  if(modifier==='uturn')return `Turn back${onto}.`;
  if(type==='fork')return modifier==='straight'?`Continue straight${onto}.`:`Keep ${modifier?modifier.split(' ').at(-1):'following the path'}${onto}.`;
  if(modifier.startsWith('slight '))return `Bear ${modifier.slice(7)}${onto}.`;
  if(modifier.startsWith('sharp '))return `Turn sharply ${modifier.slice(6)}${onto}.`;
  if(modifier&&modifier!=='straight')return `Turn ${modifier}${onto}.`;
  return `Continue${name?` on ${name}`:' along the walking route'}.`;
}

function normalize(data, start, end) {
  if(data?.code==='NoRoute'||data?.code==='NoSegment')throw failure('NO_ROUTE','No walking route was found here. Choose another place or check the map.');
  if(data?.code!=='Ok'||!Array.isArray(data.routes)||!data.routes.length)throw invalid();
  const raw=data.routes[0], geometry=raw.geometry?.coordinates;
  if(raw.geometry?.type!=='LineString'||!Array.isArray(geometry)||geometry.length<2||geometry.length>MAX_POINTS||!geometry.every(validPair)||!metric(raw.distance)||raw.distance>100_000||!metric(raw.duration)||raw.duration>172_800)throw invalid();
  const coordinates=geometry.map(([lng,lat])=>[lat,lng]);
  if(!Array.isArray(data.waypoints)||data.waypoints.length!==2||data.waypoints.some(w=>!metric(w.distance)))throw invalid();
  if(data.waypoints.some(w=>w.distance>MAX_SNAP)||distanceMeters(start,point(coordinates[0]))>MAX_SNAP||distanceMeters(end,point(coordinates.at(-1)))>MAX_SNAP)throw failure('NO_ROUTE','No nearby walking path connects these points. Try another destination.');
  if(!Array.isArray(raw.legs)||!raw.legs.length||raw.legs.length>4)throw invalid();
  const rawSteps=raw.legs.flatMap(leg=>Array.isArray(leg.steps)?leg.steps:[]);
  if(!rawSteps.length||rawSteps.length>MAX_STEPS||rawSteps.some(step=>step.mode!=='walking'||!metric(step.distance)||!metric(step.duration)||!validPair(step.maneuver?.location)))throw invalid();
  const indexes=new Map();coordinates.forEach((p,i)=>{const key=p.join(',');if(!indexes.has(key))indexes.set(key,[]);indexes.get(key).push(i);});
  let cursor=0;
  const steps=rawSteps.map(step=>{
    const coordinate=[step.maneuver.location[1],step.maneuver.location[0]];
    const last=step.geometry?.coordinates?.at(-1);
    if(!validPair(last))throw invalid();
    const finish=[last[1],last[0]], candidates=indexes.get(finish.join(','));
    let endIndex=candidates?.find(i=>i>=cursor);
    if(endIndex===undefined){
      let nearest=Infinity;
      for(let i=cursor;i<coordinates.length;i++){const d=distanceMeters(point(finish),point(coordinates[i]));if(d<nearest){nearest=d;endIndex=i;}}
      if(nearest>100)throw invalid();
    }
    cursor=endIndex;
    return {instruction:instruction(step),distance:step.distance,duration:step.duration,coordinate,endIndex};
  });
  return {coordinates,distance:raw.distance,duration:raw.duration,steps,provider:PROVIDER,attribution:ATTRIBUTION};
}

/** One public-service GET, no automatic retry. Shared starts are spaced by
 * >=1100ms in this module instance. Request only on a user action.
 * Returned instruction strings are plain text: escape them at the UI boundary. */
export async function fetchWalkingRoute(start, end, {signal,fetchImpl=globalThis.fetch}={}) {
  if(signal?.aborted)throw abortError();
  if(!validPosition(start)||!validPosition(end))throw failure('INVALID_LOCATION','A valid location and destination are needed for a walking route.');
  if(distanceMeters(start,end)>50_000)throw failure('ROUTE_TOO_FAR','Choose a closer destination for this walking route.');
  if(typeof fetchImpl!=='function')throw failure('ROUTE_UNAVAILABLE','Walking routes are unavailable in this browser.');
  const url=new URL(`${ENDPOINT}${start.lng.toFixed(6)},${start.lat.toFixed(6)};${end.lng.toFixed(6)},${end.lat.toFixed(6)}`);
  for(const [key,value] of Object.entries({overview:'full',geometries:'geojson',steps:'true',alternatives:'false',generate_hints:'false',radiuses:`${MAX_SNAP};${MAX_SNAP}`}))url.searchParams.set(key,value);
  const controller=new AbortController();let timer,timedOut=false,onAbort;
  const cancelled=new Promise((_,reject)=>{
    onAbort=()=>{controller.abort();reject(abortError());};
    signal?.addEventListener('abort',onAbort,{once:true});
    timer=setTimeout(()=>{timedOut=true;controller.abort();reject(failure('ROUTE_TIMEOUT','The walking route took too long. Check your connection and retry.'));},TIMEOUT);
  });
  try {
    const request=(async()=>{
      await requestSlot(controller.signal);
      const response=await fetchImpl(url.href,{method:'GET',mode:'cors',credentials:'omit',headers:{Accept:'application/json'},signal:controller.signal});
      if(response.status===429)throw failure('RATE_LIMITED','The walking service is busy. Wait a moment before retrying.');
      let data;try{data=await response.json();}catch{if(!response.ok)throw failure('ROUTE_UNAVAILABLE','The walking service is unavailable. Please try again later.');throw invalid();}
      if(!response.ok&&!['NoRoute','NoSegment'].includes(data?.code))throw failure('ROUTE_UNAVAILABLE','The walking service is unavailable. Please try again later.');
      return normalize(data,start,end);
    })();
    return await Promise.race([request,cancelled]);
  } catch(error) {
    if(signal?.aborted)throw abortError();
    if(timedOut)throw failure('ROUTE_TIMEOUT','The walking route took too long. Check your connection and retry.');
    if(error instanceof RoutingError)throw error;
    throw failure('ROUTE_UNAVAILABLE','The walking route could not load. Check your connection and retry.');
  } finally {clearTimeout(timer);signal?.removeEventListener('abort',onAbort);}
}

/** Nearest-segment progress is a foreground estimate, not an arrival check.
 * Provider distance/time are scaled by geometric progress; no network requests. */
export function routeProgress(route, position) {
  const points=route?.coordinates;
  if(!validPosition(position)||!Array.isArray(points)||points.length<2||points.length>MAX_POINTS||!points.every(p=>Array.isArray(p)&&validPosition(point(p)))||!metric(route.distance)||!metric(route.duration))return null;
  const rad=Math.PI/180, radius=6_371_000, cosine=Math.max(1e-6,Math.cos(position.lat*rad));
  const vector=p=>{const longitude=((p[1]-position.lng+540)%360)-180;return [longitude*rad*radius*cosine,(p[0]-position.lat)*rad*radius];};
  let total=0,best=Infinity,along=0,shapeIndex=0;const cumulative=[0];
  for(let i=0;i<points.length-1;i++){
    const a=vector(points[i]),b=vector(points[i+1]),dx=b[0]-a[0],dy=b[1]-a[1],squared=dx*dx+dy*dy;
    const t=squared?Math.max(0,Math.min(1,-(a[0]*dx+a[1]*dy)/squared)):0;
    const offset=Math.hypot(a[0]+t*dx,a[1]+t*dy),length=distanceMeters(point(points[i]),point(points[i+1]));
    if(offset<best){best=offset;along=total+t*length;shapeIndex=i+t;}
    total+=length;
    cumulative.push(total);
  }
  const fraction=total?Math.max(0,Math.min(1,along/total)):1;
  const steps=Array.isArray(route.steps)?route.steps:[];
  let stepIndex=steps.findIndex(step=>Number.isInteger(step.endIndex)&&step.endIndex>shapeIndex+1e-7);
  if(stepIndex<0)stepIndex=Math.max(0,steps.length-1);
  const step=steps[stepIndex],endIndex=Math.max(0,Math.min(points.length-1,step?.endIndex??points.length-1));
  const startIndex=Math.max(0,Math.min(endIndex,steps[stepIndex-1]?.endIndex??0));
  const stepGeometry=cumulative[endIndex]-cumulative[startIndex],remainingGeometry=Math.max(0,cumulative[endIndex]-along);
  const stepRemainingDistance=metric(step?.distance)&&stepGeometry>0?step.distance*Math.min(1,remainingGeometry/stepGeometry):total?remainingGeometry/total*route.distance:0;
  return {remainingDistance:route.distance*(1-fraction),remainingDuration:route.duration*(1-fraction),offRouteDistance:best,stepIndex,stepRemainingDistance};
}

/** Distance-based demo sampling stays on the returned pedestrian geometry. */
export function sampleRoutePosition(route, fraction) {
  const points=route?.coordinates;
  if(!Array.isArray(points)||points.length<2||points.length>MAX_POINTS||!points.every(p=>Array.isArray(p)&&validPosition(point(p)))||!Number.isFinite(fraction))return null;
  const progress=Math.max(0,Math.min(1,fraction));
  if(progress===0)return point(points[0]);
  if(progress===1)return point(points.at(-1));
  const lengths=points.slice(1).map((p,i)=>distanceMeters(point(points[i]),point(p)));
  let remaining=lengths.reduce((a,b)=>a+b,0)*progress;
  for(let i=0;i<lengths.length;i++){
    if(remaining<=lengths[i]){
      const t=lengths[i]?remaining/lengths[i]:0,a=points[i],b=points[i+1];
      const delta=((b[1]-a[1]+540)%360)-180;
      return {lat:a[0]+(b[0]-a[0])*t,lng:((a[1]+delta*t+540)%360)-180};
    }
    remaining-=lengths[i];
  }
  return point(points.at(-1));
}
