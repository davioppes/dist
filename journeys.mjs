import {distanceMeters} from './core.mjs';

const R=6371000,RAD=Math.PI/180,CACHE_KEY='jiayou-city-cache-v1',TTL=30*86400000,MAX_CACHE=200,MAX_CELLS=50000;
const cache=new Map();let queue=Promise.resolve(),lastStart=-Infinity;
export const CITY_PROVIDER={name:'Photon / komoot',url:'https://photon.komoot.io/reverse',attribution:'© OpenStreetMap contributors',attributionUrl:'https://www.openstreetmap.org/copyright'};
export const UNSORTED_CITY=Object.freeze({key:'unsorted',name:'Unsorted places',country:'',countryCode:'',lat:null,lng:null});
const text=(value,limit=120)=>typeof value==='string'?value.replace(/[\u0000-\u001f\u007f-\u009f]/g,' ').replace(/\s+/g,' ').trim().slice(0,limit):'';
const valid=p=>!!p&&Number.isFinite(p.lat)&&Math.abs(p.lat)<=90&&Number.isFinite(p.lng)&&Math.abs(p.lng)<=180;
const number=n=>Number.isFinite(n)&&n>=0?n:0;
const add=(a,b)=>Math.min(Number.MAX_VALUE,number(a)+number(b));
const slug=value=>text(value).normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'-').replace(/^-|-$/g,'');
const error=(code,message)=>Object.assign(new Error(message),{name:'CityLookupError',code});
const aborted=()=>Object.assign(new Error('City lookup cancelled.'),{name:'AbortError'});
const hongKong=(position={lat:22.31,lng:114.26})=>({key:'hk:hong-kong',name:'Hong Kong',country:'Hong Kong',countryCode:'hk',lat:valid(position)?Number(position.lat.toFixed(2)):22.31,lng:valid(position)?Number(position.lng.toFixed(2)):114.26});

export function cityCacheKey(position){return valid(position)?`${position.lat.toFixed(2)},${position.lng.toFixed(2)}`:null;}
function cityValue(city){
  if(!city||typeof city!=='object')return null;
  const name=text(city.name),key=text(city.key,180),countryCode=typeof city.countryCode==='string'&&/^[a-z]{2}$/i.test(city.countryCode)?city.countryCode.toLowerCase():'';
  if(countryCode==='hk'||/^hong kong$/i.test(name))return {...hongKong(city),...(name?{name}:{}),...(typeof city.country==='string'?{country:text(city.country)}:{})};
  if(!name||!key||['__proto__','prototype','constructor'].includes(key))return null;
  return {key,name,country:text(city.country),countryCode,lat:valid(city)?city.lat:null,lng:valid(city)?city.lng:null};
}
function photonCity(data,position){
  const p=data?.features?.[0]?.properties;
  if(!p||typeof p!=='object')throw error('CITY_UNKNOWN','The city could not be identified. Your visit can stay unsorted.');
  if(text(p.countrycode).toUpperCase()==='HK'||/hong\s*kong|香港/i.test(text(p.state))||/^hong\s*kong$/i.test(text(p.country)))return hongKong(position);
  const name=text(p.city)||text(p.town)||(['city','town','village'].includes(p.type)||['city','town','village'].includes(p.osm_value)?text(p.name):'');
  if(!name)throw error('CITY_UNKNOWN','The city could not be identified. Your visit can stay unsorted.');
  const country=text(p.country),countryCode=typeof p.countrycode==='string'&&/^[a-z]{2}$/i.test(p.countrycode)?p.countrycode.toLowerCase():'';
  const region=slug(p.state),key=`${countryCode||slug(country)||'xx'}:${slug(name)}${region?':'+region:''}`;
  return {key,name,country,countryCode,lat:position.lat,lng:position.lng};
}
function cached(key,storage){
  let entry=cache.get(key);
  if(!entry)try{const values=JSON.parse(storage?.getItem(CACHE_KEY)||'[]');if(Array.isArray(values))entry=values.slice(-MAX_CACHE).find(e=>e?.key===key);}catch{}
  const city=cityValue(entry?.city);
  if(city&&Number.isFinite(entry.time)&&Date.now()>=entry.time&&Date.now()-entry.time<TTL){cache.set(key,{...entry,city});return {...city};}
  return null;
}
function storeCity(key,city,storage){
  cache.delete(key);cache.set(key,{key,time:Date.now(),city:{...city}});
  while(cache.size>MAX_CACHE)cache.delete(cache.keys().next().value);
  try{const previous=JSON.parse(storage?.getItem(CACHE_KEY)||'[]'),all=new Map((Array.isArray(previous)?previous:[]).slice(-MAX_CACHE).filter(e=>e&&e.key!==key&&Number.isFinite(e.time)&&Date.now()-e.time<TTL).map(e=>[e.key,e]));all.set(key,cache.get(key));storage?.setItem(CACHE_KEY,JSON.stringify([...all.values()].slice(-MAX_CACHE)));}catch{}
}
function slot(signal){
  const task=queue.then(async()=>{
    if(signal.aborted)throw aborted();const delay=Math.max(0,1100-(Date.now()-lastStart));
    if(delay)await new Promise((resolve,reject)=>{const finish=()=>{signal.removeEventListener('abort',cancel);resolve();},timer=setTimeout(finish,delay),cancel=()=>{clearTimeout(timer);signal.removeEventListener('abort',cancel);reject(aborted());};signal.addEventListener('abort',cancel,{once:true});});
    if(signal.aborted)throw aborted();lastStart=Date.now();
  });queue=task.catch(()=>{});return task;
}

/** Call after an explicit start/check-in, never for every GPS sample. Only
 * rounded coordinates leave the device; cache entries contain city metadata. */
export async function resolveCity(position,{signal,fetchImpl=globalThis.fetch,storage,endpoint=CITY_PROVIDER.url}={}){
  if(signal?.aborted)throw aborted();const key=cityCacheKey(position);
  if(!key)throw error('INVALID_LOCATION','A valid location is needed to identify a city.');
  if(storage===undefined)try{storage=globalThis.localStorage;}catch{storage=null;}
  const hit=cached(key,storage);if(hit)return hit;
  const rounded={lat:Number(position.lat.toFixed(2)),lng:Number(position.lng.toFixed(2))};
  const url=new URL(endpoint);if(url.protocol!=='https:')throw error('CITY_UNAVAILABLE','The city lookup service must use HTTPS.');
  url.searchParams.set('lat',String(rounded.lat));url.searchParams.set('lon',String(rounded.lng));url.searchParams.set('limit','1');url.searchParams.set('lang','en');
  const controller=new AbortController();let timer,onAbort,timedOut=false;
  const cancellation=new Promise((_,reject)=>{onAbort=()=>{controller.abort();reject(aborted());};signal?.addEventListener('abort',onAbort,{once:true});timer=setTimeout(()=>{timedOut=true;controller.abort();reject(error('CITY_TIMEOUT','The city lookup took too long. Your visit can stay unsorted.'));},8000);});
  try{
    const request=(async()=>{await slot(controller.signal);const existing=cached(key,storage);if(existing)return existing;
      const result=await fetchImpl(url.href,{method:'GET',mode:'cors',credentials:'omit',headers:{Accept:'application/json'},signal:controller.signal});
      if(result.status===429)throw error('CITY_RATE_LIMITED','City lookup is busy. Please retry later.');
      if(!result.ok)throw error('CITY_UNAVAILABLE','City lookup is unavailable. Your visit can stay unsorted.');
      const city=photonCity(await result.json(),rounded);storeCity(key,city,storage);return {...city};})();
    return await Promise.race([request,cancellation]);
  }catch(e){if(signal?.aborted)throw aborted();if(timedOut)throw error('CITY_TIMEOUT','The city lookup took too long. Your visit can stay unsorted.');if(e?.name==='CityLookupError')throw e;throw error('CITY_UNAVAILABLE','City lookup could not load. Your visit can stay unsorted.');}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',onAbort);}
}

/** Conservative southern-HK bounds for old unlabelled records. Border/northern
 * records stay unsorted unless they already carry resolved city metadata. */
export function cityForStamp(stamp){
  const saved=cityValue(stamp?.city);if(saved)return saved;
  if(valid(stamp)&&stamp.lat>=22.15&&stamp.lat<=22.40&&stamp.lng>=113.83&&stamp.lng<=114.43)return hongKong(stamp);
  return {...UNSORTED_CITY};
}
const columnsAt=row=>Math.max(1,Math.round(2*Math.PI*R*Math.cos(Math.min(89.999999,-90+(row+.5)*100/(RAD*R))*RAD)/100));
const cells=value=>[...new Set((Array.isArray(value)?value:[]).flatMap(v=>{
  if(typeof v!=='string'||!/^\d{1,6}:\d{1,6}$/.test(v))return [];
  const [row,col]=v.split(':').map(Number);return row<Math.ceil(Math.PI*R/100)&&col<columnsAt(row)?[`${row}:${col}`]:[];
}))].slice(0,MAX_CELLS);
const liveStamps=state=>(Array.isArray(state?.stamps)?state.stamps:[]).filter(s=>s&&s.mode!=='demo'&&text(s.id,200));

export function toggleFavorite(state,id){
  if(!liveStamps(state).some(s=>s.id===id))return state;
  const favorites=new Set((Array.isArray(state.favorites)?state.favorites:[]).filter(v=>typeof v==='string'&&v.length<=200));
  if(favorites.has(id))favorites.delete(id);else favorites.add(id);
  return {...state,favorites:[...favorites]};
}

export function groupJourneys(state){
  const groups=new Map(),favoriteIds=new Set(Array.isArray(state?.favorites)?state.favorites:[]);
  const get=city=>{if(!groups.has(city.key))groups.set(city.key,{city:{...city},stamps:[],distance:0,areaKm2:0,topPlaces:[],favorites:[],placeCount:0,visitCount:0,lastVisitedAt:0,_cells:new Set()});return groups.get(city.key);};
  for(const item of Object.values(state?.journeys&&typeof state.journeys==='object'?state.journeys:{})){
    const city=cityValue(item?.city);if(!city)continue;const group=get(city);group.distance=add(group.distance,item.distance);for(const cell of cells(item.cells))group._cells.add(cell);group.lastVisitedAt=Math.max(group.lastVisitedAt,number(item.lastWalkAt));
  }
  for(const stamp of liveStamps(state)){const group=get(cityForStamp(stamp));group.stamps.push({...stamp});group.lastVisitedAt=Math.max(group.lastVisitedAt,number(stamp.collectedAt));}
  for(const group of groups.values()){
    group.areaKm2=group._cells.size*.01;delete group._cells;
    group.stamps.sort((a,b)=>number(b.collectedAt)-number(a.collectedAt));const places=new Map();
    for(const stamp of group.stamps){const previous=places.get(stamp.id);if(previous)previous.visits++;else places.set(stamp.id,{...stamp,visits:1,favorite:favoriteIds.has(stamp.id)});}
    group.topPlaces=[...places.values()].sort((a,b)=>Number(b.favorite)-Number(a.favorite)||b.visits-a.visits||number(b.collectedAt)-number(a.collectedAt)).slice(0,3);
    group.favorites=[...places.values()].filter(p=>p.favorite);group.placeCount=places.size;group.visitCount=group.stamps.length;
  }
  return [...groups.values()].sort((a,b)=>b.lastVisitedAt-a.lastVisitedAt||a.city.name.localeCompare(b.city.name));
}

export function journeySummary(state){
  const groups=groupJourneys(state),stamps=liveStamps(state),known=groups.filter(g=>g.city.key!=='unsorted');
  const favoriteIds=new Set(Array.isArray(state?.favorites)?state.favorites:[]);
  const footprint=new Set();for(const item of Object.values(state?.journeys||{}))for(const cell of cells(item?.cells))footprint.add(cell);
  const assigned=groups.reduce((sum,g)=>add(sum,g.distance),0),distance=Math.max(number(state?.distance),assigned);
  return {distance,unassignedDistance:Math.max(0,distance-assigned),areaKm2:footprint.size*.01,cityCount:known.length,countryCount:new Set(known.map(g=>g.city.countryCode).filter(Boolean)).size,placeCount:new Set(stamps.map(s=>s.id)).size,visitCount:stamps.length,favoriteCount:new Set(stamps.filter(s=>favoriteIds.has(s.id)).map(s=>s.id)).size,topPlaces:groups.flatMap(g=>g.topPlaces).sort((a,b)=>b.visits-a.visits||number(b.collectedAt)-number(a.collectedAt)).slice(0,3)};
}

// Latitude bands have ~100m north/south height; each band divides its parallel
// into ~100m columns. Cell area is an approximate footprint, not a city share.
function cellAt(position){
  const row=Math.max(0,Math.min(Math.ceil(Math.PI*R/100)-1,Math.floor((position.lat+90)*RAD*R/100)));
  const columns=columnsAt(row);
  const longitude=((position.lng+180)%360+360)%360,col=Math.min(columns-1,Math.floor(longitude/360*columns));return `${row}:${col}`;
}
export function recordWalkSegment(state,previous,next,city,{active=true,foreground=true,now=Date.now()}={}){
  if(!state||!active||!foreground||!valid(previous)||!valid(next)||!Number.isFinite(now))return state;
  if(!Number.isFinite(previous.accuracy)||previous.accuracy<0||previous.accuracy>35||!Number.isFinite(next.accuracy)||next.accuracy<0||next.accuracy>35||!Number.isFinite(previous.timestamp)||!Number.isFinite(next.timestamp)||next.timestamp>now+5000||now-next.timestamp>60000||next.timestamp<=number(state.walkRecordedAt))return state;
  const seconds=(next.timestamp-previous.timestamp)/1000;if(seconds<=0||seconds>60)return state;
  const distance=distanceMeters(previous,next);if(distance<8||distance/seconds>3.5)return state;
  const resolved=cityValue(city)||{...UNSORTED_CITY},journeys={...(state.journeys||{})},old=Object.hasOwn(journeys,resolved.key)?journeys[resolved.key]:null;
  const footprint=new Set(cells(old?.cells)),total=Object.values(journeys).reduce((sum,item)=>sum+cells(item?.cells).length,0),budget=Math.max(0,MAX_CELLS-total);
  let added=0,limited=!!old?.footprintLimited;const samples=Math.ceil(distance/25),delta=((next.lng-previous.lng+540)%360)-180;
  for(let i=0;i<=samples;i++){const t=i/samples,cell=cellAt({lat:previous.lat+(next.lat-previous.lat)*t,lng:previous.lng+delta*t});if(!footprint.has(cell)){if(added<budget){footprint.add(cell);added++;}else limited=true;}}
  journeys[resolved.key]={city:cityValue(old?.city)||resolved,distance:add(old?.distance,distance),cells:[...footprint],lastWalkAt:next.timestamp,...(limited?{footprintLimited:true}:{})};
  return {...state,distance:add(state.distance,distance),journeys,walkRecordedAt:next.timestamp};
}
