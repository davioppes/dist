import {distanceMeters,formatDistance,lightLevel,discoveryRadius,arrivalStatus,createState,awardStamp,revealPlaces,parseOverpass} from './core.mjs';
import {SEED_PLACES} from './seed.mjs';
import {loadNearby} from './places.mjs';
import {PLACE_MEDIA} from './place-media.mjs';
import {companionMarkup,syncCompanionStates} from './companion.mjs';
import {stampMarkup,stampIdentity} from './stamps.mjs';
import {fetchWalkingRoute,routeProgress} from './routing.mjs';
import {createRouteSession,usableRoutePosition} from './navigation.mjs';
import {installEnvironment,installGuideMarkup} from './platform.mjs';
import {resolveCity,groupJourneys,recordWalkSegment,toggleFavorite} from './journeys.mjs';
import {makeTripRecap} from './recap.mjs';
import {arrivalAssistance,collectionMilestone,nextUnvisitedDestination} from './exploration.mjs';

const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths={compass:'<circle cx="12" cy="12" r="9"/><path d="m16 8-3 5-5 3 3-5Z"/>',passport:'<rect x="5" y="3" width="15" height="18" rx="3"/><path d="M8 3v18"/><circle cx="14" cy="10" r="3"/><path d="M12 16h4"/>',flame:'<path d="M13 3c1 5 6 6 6 12a7 7 0 0 1-14 0c0-4 3-7 5-9-1 4 0 5 1 6 3-2 3-6 2-9Z"/><path d="M12 13c1 2 3 3 3 5a3 3 0 0 1-6 0c0-2 2-3 3-5Z"/>',leaf:'<path d="M20 3C9 1 3 7 4 13c0 5 6 7 10 4 4-3 5-9 6-14Z"/><path d="M3 21 14 10"/>',mountain:'<path d="m2 19 7-13 5 8 3-5 5 10Z"/><path d="m7 10 2 2 2-2"/>',coffee:'<path d="M4 8h13v7a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5Z"/><path d="M17 9h2a3 3 0 0 1 0 6h-2M7 3v2m5-2v2M2 22h18"/>',arch:'<path d="m3 8 9-5 9 5H3ZM5 11v7m7-7v7m7-7v7M3 21h18M4 18h16"/>',sparkles:'<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5ZM20 2v4m-2-2h4"/>',camera:'<path d="M3 7h4l2-3h6l2 3h4v14H3Z"/><circle cx="12" cy="13" r="4"/>',search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',locate:'<circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/>',plus:'<path d="M12 5v14M5 12h14"/>',minus:'<path d="M5 12h14"/>','arrow-right':'<path d="M4 12h16m-6-6 6 6-6 6"/>','chevron-down':'<path d="m6 9 6 6 6-6"/>',check:'<path d="m5 12 4 4L19 6"/>',x:'<path d="m6 6 12 12M6 18 18 6"/>',download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',upload:'<path d="M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5"/>',share:'<circle cx="6" cy="12" r="3"/><circle cx="18" cy="5" r="3"/><circle cx="18" cy="19" r="3"/><path d="m9 10 6-4M9 14l6 4"/>',refresh:'<path d="M20 8a8 8 0 0 0-14-3L3 8m0-5v5h5M4 16a8 8 0 0 0 14 3l3-3m0 5v-5h-5"/>',settings:'<path d="m10 3-.6 3-2 .9-2.7-1-2 3.4 2.1 2.1v2.3l-2.1 2.1 2 3.4 2.8-1 2 .9.5 3h4l.5-3 2-.9 2.8 1 2-3.4-2.1-2.1v-2.3l2.1-2.1-2-3.4-2.8 1-2-.9L14 3Z"/><circle cx="12" cy="13" r="3"/>',book:'<path d="M12 6c-3-3-7-3-10-2v15c4-1 7 0 10 2 3-2 6-3 10-2V4c-3-1-7-1-10 2Zm0 0v15"/>',walk:'<circle cx="13" cy="4" r="2"/><path d="m7 21 4-7m5 7-2-7-4-4 3-3 3 5h4M5 12l3-4 5-1"/>',shield:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/><path d="m8 12 3 3 5-6"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',pin:'<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',pause:'<path d="M8 4v16M16 4v16"/>'};
const icon=n=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[n]||paths.sparkles}</svg>`;
function icons(root=document){root.querySelectorAll('[data-icon]').forEach(e=>e.innerHTML=icon(e.dataset.icon));}
const cats={all:{name:'All spots',icon:'sparkles'},nature:{name:'Nature',icon:'leaf'},views:{name:'Views',icon:'mountain'},culture:{name:'Culture',icon:'arch'},food:{name:'Cafés',icon:'coffee'}};
const nav=[['explore','compass','Map'],['passport','passport','Passport']];
const STORAGE='jiayou-v1-'; let storageWarning=false;
function read(key,fallback){try{return JSON.parse(localStorage.getItem(STORAGE+key))??fallback;}catch{return fallback;}}
function write(key,value){try{localStorage.setItem(STORAGE+key,JSON.stringify(value));return true;}catch{if(!storageWarning){storageWarning=true;toast('Storage is full or unavailable. Export your memories before closing.');}return false;}}
function loadState(mode){const s=read(mode,null);return s?.version===1&&Array.isArray(s.stamps)&&Array.isArray(s.visited)?s:createState();}
const mode='real';
let state=loadState('real'), position=null, currentView='explore', filter='all', query='', selected=null, walking=false;
let places=[], visiblePlaces=[], markers=[], watch=null, stream=null, cameraGeneration=0, pendingPhoto=null, installPrompt=null, loadingPlaces=false, requestController=null, toastTimer, liveRequestEpoch=0, lastSearch=null;
let sheetType=null, map, avatar, accuracyCircle, glowCircle; let walkAnchor=null;
let announcedArrivalId=null,currentCity=null,cityAnchor=null,cityRequest=0,passportCity=null,memorySelectedId=null,cameraFacing='environment',appReady=false;
let recapController=null,recapUrl=null,recapResult=null;
let nearbyOpen=false,routeLayers=[],drawnRoute=null,followWalk=true;
const routeSession=createRouteSession(fetchWalkingRoute,routeChanged);
let locationGeneration=0,locationPhase='paused',locationWaitTimer=null,resumeLocationOnVisible=false,locationFallbackRequested=false;
let motionEnabled=read('motion',true);
document.documentElement.dataset.motion=motionEnabled?'on':'off';
const sheet=$('#sheet'),content=$('#sheet-content');
function save(){return write('real',state);}
function toast(message){clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').hidden=false;toastTimer=setTimeout(()=>$('#toast').hidden=true,5200);}
function banner(message,action,label){const e=$('#status-banner');if(!message){e.hidden=true;return;}e.innerHTML=`${esc(message)} ${action?`<button data-action="${action}">${esc(label)}</button>`:''}`;e.hidden=false;}
function centerPosition(){return position;}
function seal(place,extra=''){return stampMarkup(place,{size:extra==='collected'?'pin':extra==='hero'?'hero':'card',collected:state.visited.includes(place.id),animate:extra==='reward'});}

function utilityRow(action,i,title,description=''){return `<button class="utility-row" data-action="${action}"><span class="utility-icon">${icon(i)}</span><span><strong>${title}</strong>${description?`<small>${description}</small>`:''}</span><span class="utility-arrow">${icon('arrow-right')}</span></button>`;}
function mediaFor(place){return PLACE_MEDIA[place.id]||null;}
function thumbnail(place){const media=mediaFor(place);return `<span class="place-thumbnail ${esc(place.category)}">${icon(cats[place.category]?.icon||'pin')}${media?`<img src="${esc(media.src)}" alt="" loading="lazy" decoding="async">`:''}</span>`;}
function photoHero(place){const media=mediaFor(place);return media?`<figure class="place-photograph"><img src="${esc(media.src)}" alt="${esc(media.alt)}" decoding="async"><figcaption><span>${esc(media.caption)}</span><a href="${esc(media.sourceUrl)}" target="_blank" rel="noopener">Photo: ${esc(media.credit)}</a><a href="${esc(media.licenseUrl)}" target="_blank" rel="noopener">${esc(media.license)}</a></figcaption></figure>`:`<div class="place-cover ${esc(place.category)}">${seal(place)}<span class="no-photo-label">${esc(cats[place.category]?.name||'Discovery')} stamp</span></div>`;}
function landmarkCue(place){const media=mediaFor(place);return media?.landmarkCue||place.landmarkCue||`Look for the name “${place.name}” on the entrance or local signs. A map pin is an estimate; check the surroundings before entering.`;}
function setNearby(open,{focus=false}={}){
  nearbyOpen=!!open;$('.discovery-tray').hidden=!nearbyOpen;
  $('#explore-view').classList.toggle('nearby-open',nearbyOpen);
  $('#nearby-toggle').setAttribute('aria-expanded',String(nearbyOpen));
  if(!nearbyOpen&&focus)($('.menu-toggle')||$('#nearby-toggle')).focus();
}
function routeMinutes(seconds){return `${Math.max(1,Math.round(seconds/60))} min`;}
function turnSymbol(step){
  const instruction=(step?.instruction||'').toLowerCase();
  if(/arriv|destination/.test(instruction))return icon('pin');
  const d=instruction.includes('left')?'M16 20V9H5m5-5L5 9l5 5':instruction.includes('right')?'M8 20V9h11m-5-5 5 5-5 5':'M12 21V3m-6 6 6-6 6 6';
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
}
function routeError(){const e=routeSession.state.error||'';return /NO_ROUTE|NoRoute|NoSegment/i.test(e)?'No walking route was found here. Try another place.':/TIMEOUT/i.test(e)?'Directions are taking too long. Try again.':'Directions are unavailable. Check your connection and retry.';}
function currentRouteProgress(){return routeSession.state.route&&position?routeProgress(routeSession.state.route,position):null;}
function clearRoute(){routeSession.reset();}
function routeChanged(){
  const route=routeSession.state.route;
  if(route!==drawnRoute){
    routeLayers.forEach(layer=>map?.removeLayer(layer));routeLayers=[];drawnRoute=route;
    if(route&&map){
      const options={interactive:false,lineCap:'round',lineJoin:'round',pane:'routePane'};
      routeLayers=[L.polyline(route.coordinates,{...options,color:'#fff',weight:5,opacity:.95}),L.polyline(route.coordinates,{...options,color:'#4e8273',weight:2.5,opacity:1})];
      routeLayers.forEach(layer=>layer.addTo(map));fitWalkingRoute();
    }
  }
  renderWalk();if(sheet.open&&sheetType==='directions')renderDirections();
}
function fitWalkingRoute(){
  if(!map||!routeSession.state.route)return;
  const rect=$('#map').getBoundingClientRect();
  map.fitBounds(routeSession.state.route.coordinates,{paddingTopLeft:[35,Math.min(160,rect.height*.24)],paddingBottomRight:[35,Math.min(245,rect.height*.38)],maxZoom:17,animate:motionEnabled&&!matchMedia('(prefers-reduced-motion:reduce)').matches});
}
function requestWalkingRoute(force=false){
  if(!selected)return;return routeSession.request(position,selected,mode,{force});
}
function ensureWalkingRoute(){
  if(walking&&selected&&!state.visited.includes(selected.id)&&['idle','waiting'].includes(routeSession.state.phase)&&usableRoutePosition(position,mode))requestWalkingRoute();
}
function renderDirections(){
  if(!selected)return;
  const r=routeSession.state,route=r.route,progress=currentRouteProgress();
  let body='';
  if(route){
    body=`<div class="route-overview"><strong>${routeMinutes(route.duration)}</strong><span>${formatDistance(route.distance)} walking · ${esc(selected.name)}</span></div><p class="route-note">Follow public paths and local signs. Estimates may change.</p><ol class="route-steps">${route.steps.map((step,i)=>`<li ${i===progress?.stepIndex?'aria-current="step"':''}><span class="step-symbol">${turnSymbol(step)}</span><div><strong>${esc(step.instruction)}</strong><small>${step.distance>0?formatDistance(step.distance):'Destination'}</small></div></li>`).join('')}</ol><div class="route-sheet-actions"><button class="button primary" data-action="route-overview">Show on map</button><button class="button secondary" data-action="reroute">Update route</button></div>`;
  }else if(r.phase==='loading')body='<div class="route-loading" role="status"><span class="route-loading-line"></span><h3>Finding a walking route</h3><p>Checking the paths to your destination…</p></div>';
  else if(r.phase==='waiting'||r.phase==='idle')body=`<div class="route-status"><h3>Find your starting point</h3><p>${position&&position.accuracy>80?'Your location is approximate. Wait for a more accurate fix to get directions.':'Turn on location to get walking directions from where you are.'}</p><button class="button primary" data-action="route-location">Find my location</button></div>`;
  else body=`<div class="route-status" role="status"><h3>Route unavailable</h3><p>${esc(routeError())}</p><button class="button primary" data-action="reroute">Try again</button><button class="text-button" data-action="choose-alternative">Choose another place</button></div>`;
  modal(`<div class="sheet-body">${heading('Walking directions')}${body}<button class="find-place-link" data-action="find-place">${icon('pin')}Find the place <span>Landmarks & access</span></button><p class="route-provider">Routing by <a href="https://routing.openstreetmap.de/about.html" target="_blank" rel="noopener">FOSSGIS / OSRM</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a> · <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noopener">Fix map</a></p></div>`,'directions');
}
function showDirections(){if(!selected)return;setNearby(false);renderDirections();const r=routeSession.state;if(r.phase!=='ready'||r.id!==selected.id||r.mode!==mode)requestWalkingRoute();}
function showFindPlace(){
  if(!selected)return;
  const p=selected,help=arrivalAssistance(p,mediaFor(p));
  const facts=help.details.map(item=>`<div><dt>${esc(item.label)}</dt><dd>${esc(item.value)}</dd></div>`).join('');
  modal(`<div class="sheet-body">${heading('Find the place',p.name)}<div class="approach-summary"><span>${icon('pin')}</span><div><h3>${help.hasReference?'Look for this landmark':'Check the local signs'}</h3><p>${esc(help.cue)}</p></div></div>${help.hasReference?photoHero(p):''}<p class="small-copy">The map pin marks the place, not a verified entrance. ${help.hasReference?'This reference photo is not a live view.':''}</p><dl class="approach-facts"><div><dt>Entrance</dt><dd>Not mapped. Look for a signed public entrance.</dd></div><div><dt>Floor / indoor route</dt><dd>Not mapped. Check the building directory or ask staff.</dd></div>${facts}</dl><p class="small-copy">${help.details.length?'Access details come from OpenStreetMap. ':''}Follow current signs and opening hours. If access is closed or unclear, choose another place.</p><div class="task-box"><strong>${icon('camera')}Once you find it</strong><p>${esc(p.task||'Notice a detail you would like to remember.')}</p></div><div class="approach-actions"><button class="button primary full" data-action="view-place">View place & visit options</button><button class="button secondary full" data-action="directions">Walking directions</button><button class="text-button" data-action="choose-alternative">Can’t find it? Choose another place</button></div></div>`,'find-place');
}
function renderWalk(){
  const hud=$('#walk-hud');if(!hud)return;
  const active=walking&&selected&&!state.visited.includes(selected.id);
  hud.hidden=!active;$('#explore-view').classList.toggle('has-walk',!!active);
  if(active&&nearbyOpen)setNearby(false);
  if(!active)return;
  const distance=position?distanceMeters(position,selected):null,status=arrivalStatus(position,selected),r=routeSession.state;
  const arrived=status.eligible;
  const paused=watch===null;
  const progress=currentRouteProgress(),ready=r.phase==='ready'&&r.id===selected.id;
  const stale=!usableRoutePosition(position,mode);
  const offRoute=!stale&&ready&&progress?.offRouteDistance>Math.max(60,position?.accuracy||0);
  const title=arrived?'You’ve arrived':paused?'Finding your location':'On your way';
  const step=ready?r.route.steps[Math.min((progress?.stepIndex||0)+1,r.route.steps.length-1)]:null;
  const distanceText=arrived?'Ready to save your visit':ready?`${routeMinutes(progress?.remainingDuration??r.route.duration)} · ${formatDistance(progress?.remainingDistance??r.route.distance)}`:`${formatDistance(distance)} <span>straight-line distance</span>`;
  const direction=arrived?'':offRoute?`<div class="route-status" role="status"><span>You’re away from the route.</span><button data-action="reroute">Update route</button></div>`:stale?'<div class="route-status" role="status"><span>Waiting for an accurate location.</span><button data-action="location-help">Help</button></div>':ready?`<button class="route-next" data-action="directions"><span class="turn-symbol">${turnSymbol(step)}</span><span><strong>${esc(step?.instruction||'Continue to your destination')}</strong><small>In ${formatDistance(progress?.stepRemainingDistance??step?.distance??0)}</small></span>${icon('chevron-down')}</button>`:r.phase==='error'?`<div class="route-status" role="status"><span>${esc(routeError())}</span><button data-action="reroute">Retry</button></div>`:'<div class="route-status" role="status"><span>Finding a walking route…</span></div>';
  const html=`<div class="walk-hud-top">${thumbnail(selected)}<div><span class="walk-state ${arrived?'arrived':''}">${icon(arrived?'check':'walk')}${title}</span><strong>${esc(selected.name)}</strong><span class="walk-distance">${distanceText}</span></div><button class="icon-button" data-action="end-walk" aria-label="Stop this walk">${icon('x')}</button></div>${direction}<button class="find-place-link" data-action="find-place">${icon('pin')}Find the place <span>${!stale&&distance<=150?'Nearby · landmarks & access':'Landmarks & access'}</span></button><div class="walk-actions"><button class="button primary" data-action="${paused?'start-live':'view-place'}">${icon(arrived?'check':'pin')}${arrived?'Save visit':paused?'Resume walk':'View place'}</button><button class="button secondary" data-action="directions">${icon('compass')}Steps</button></div>`;
  if(hud.innerHTML!==html)hud.innerHTML=html;
  if(arrived&&announcedArrivalId!==selected.id){announcedArrivalId=selected.id;toast('You’ve arrived. Stop somewhere safe and save your visit.');if(!sheet.open&&currentView==='explore')renderPlace();}
}
function chooseAlternative(){walking=false;selected=null;clearRoute();announcedArrivalId=null;closeSheet();filter='all';query='';$('#place-search').value='';renderFilters();navigate('explore');updateMap();setNearby(true);}
function endWalk(){walking=false;walkAnchor=null;selected=null;clearRoute();announcedArrivalId=null;closeSheet();updateMap();toast('Walk finished. Your progress is saved.');}
function beginWalk(){walking=true;walkAnchor=position;followWalk=true;announcedArrivalId=null;setNearby(false);if(watch===null){startLive();return;}closeSheet();navigate('explore');requestWalkingRoute();updateMap();}
function modal(html,type='other'){stopCamera();if(type!=='recap')releaseRecap();sheetType=type;sheet.dataset.type=type;content.innerHTML=html;icons(content);const title=content.querySelector('h2');if(title){title.id='sheet-title';title.tabIndex=-1;}if(!sheet.open)sheet.showModal();title?.focus({preventScroll:true});sheet.scrollTop=0;const scroller=content.querySelector('.place-scroll');if(scroller)scroller.scrollTop=0;}
function heading(title,kicker=''){return `<div class="sheet-top"><div>${kicker?`<span class="field-label">${esc(kicker)}</span>`:''}<h2>${esc(title)}</h2></div><button class="icon-button" data-action="close" aria-label="Close">${icon('x')}</button></div>`;}
function releaseRecap(){recapController?.abort();recapController=null;if(recapUrl)URL.revokeObjectURL(recapUrl);recapUrl=null;recapResult=null;}
function closeSheet(){stopCamera();releaseRecap();pendingPhoto=null;sheetType=null;sheet.close();}
sheet.addEventListener('close',()=>{if(!sheet.open){stopCamera();releaseRecap();sheetType=null;pendingPhoto=null;}});
sheet.addEventListener('click',e=>{if(e.target===sheet){const r=sheet.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeSheet();}});
function startMap(){
  if(!globalThis.L){banner('The map could not load. Check your connection and reload.');return;}
  map=L.map('map',{zoomControl:false,attributionControl:false,minZoom:2,maxZoom:19}).setView([20,0],2);
  const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,keepBuffer:1,updateWhenIdle:true});
  tiles.addTo(map);let tileErrors=0;tiles.on('tileerror',()=>{if(++tileErrors===4)banner('Map tiles are unavailable. Saved places still work; reconnect to reload the map.','refresh','Retry');});tiles.on('tileload',()=>{tileErrors=0;});
  glowCircle=L.circle([0,0],{radius:90,stroke:false,fillColor:'#f5d57b',fillOpacity:.13,interactive:false,className:'discovery-radius'});
  accuracyCircle=L.circle([0,0],{radius:0,weight:1,color:'#719b83',fillColor:'#99bba7',fillOpacity:.08,interactive:false});
  avatar=L.marker([0,0],{icon:L.divIcon({className:'explorer-marker',html:companionMarkup({variant:'map',oil:lightLevel(state),label:'Your explorer'}),iconSize:[74,82],iconAnchor:[37,67]}),zIndexOffset:1000,keyboard:false,interactive:false});
  map.createPane('routePane');map.getPane('routePane').style.zIndex='450';map.on('dragstart',()=>{followWalk=false;});
  map.on('move zoom resize',drawFog);map.on('moveend',drawFog);new ResizeObserver(()=>{map.invalidateSize();drawFog();}).observe($('#map'));
  updateMap();
}
function drawFog(){
  if(!map)return;const canvas=$('#fog'),rect=$('#map').getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);if(!rect.width||!rect.height)return;
  canvas.width=rect.width*dpr;canvas.height=rect.height*dpr;const ctx=canvas.getContext('2d');if(!position)return;ctx.scale(dpr,dpr);ctx.fillStyle='rgba(238,243,235,.76)';ctx.fillRect(0,0,rect.width,rect.height);ctx.globalCompositeOperation='destination-out';
  const pos=centerPosition(),radius=discoveryRadius(lightLevel(state));const trail=[...(state.explored||[]).slice(-60),pos];
  for(const [i,p] of trail.entries()){if(!Number.isFinite(p.lat)||!Number.isFinite(p.lng))continue;const xy=map.latLngToContainerPoint([p.lat,p.lng]);const metres=i===trail.length-1?radius:140;const edge=map.latLngToContainerPoint([p.lat+metres/111320,p.lng]);const r=Math.max(25,Math.abs(edge.y-xy.y));const g=ctx.createRadialGradient(xy.x,xy.y,r*.52,xy.x,xy.y,r);g.addColorStop(0,'rgba(0,0,0,1)');g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(xy.x,xy.y,r,0,Math.PI*2);ctx.fill();}ctx.globalCompositeOperation='source-over';
}
function updateMap(){
  if(routeSession.state.phase!=='idle'&&selected&&state.visited.includes(selected.id))clearRoute();
  const pos=centerPosition();visiblePlaces=revealPlaces(places,pos,state,filter).filter(p=>!query||p.name.toLowerCase().includes(query.toLowerCase())).slice(0,40);
  if(map){markers.forEach(m=>map.removeLayer(m));markers=[];for(const p of visiblePlaces){const done=state.visited.includes(p.id);const el=`<div class="pin-inner ${esc(p.category)} ${done?'collected':''}">${done?seal(p,'collected'):icon(cats[p.category]?.icon)}</div>`;const marker=L.marker([p.lat,p.lng],{icon:L.divIcon({html:el,className:`pin ${selected?.id===p.id?'selected':''} ${done?'collected-pin':''}`,iconSize:[44,48],iconAnchor:[22,46]}),title:p.name,alt:p.name}).addTo(map);marker.getElement()?.setAttribute('aria-label',`${p.name}${done?' — stamp collected':''}`);marker.on('click',()=>showPlace(p.id));marker.bindTooltip(esc(p.name),{direction:'top',offset:[0,-43]});markers.push(marker);}if(pos){[avatar,accuracyCircle,glowCircle].forEach(layer=>{if(!map.hasLayer(layer))layer.addTo(map);});avatar.setLatLng([pos.lat,pos.lng]);accuracyCircle.setLatLng([pos.lat,pos.lng]).setRadius(position.accuracy);glowCircle.setLatLng([pos.lat,pos.lng]).setRadius(50+lightLevel(state)*1.2);}drawFog();}
  $('#place-count').textContent=visiblePlaces.length?`${visiblePlaces.length} places`:'';
  $('[data-nearby-count]').textContent=visiblePlaces.length||'';
  $('#place-list').innerHTML=visiblePlaces.length?visiblePlaces.slice(0,20).map(p=>`<button class="place-card" data-place="${esc(p.id)}">${thumbnail(p)}<span class="place-card-copy"><strong>${esc(p.name)}</strong><span>${cats[p.category]?.name||'A local place'} · ${formatDistance(p.distance)}</span><span class="card-meta">${icon(state.visited.includes(p.id)?'check':'flame')}${state.visited.includes(p.id)?'Stamp collected':'+30 light'}</span></span></button>`).join(''):`<div class="empty-list">${query?'No revealed spots match that search.':loadingPlaces?'Finding places nearby…':'No spots in this view yet.'} <button data-action="${query?'clear-search':'refresh'}">${query?'Clear search':'Look nearby'}</button></div>`;
  $('#region-label').textContent=currentCity?.name||'Near you';
  $('#nearby-label').textContent='Choose a destination';
  const goal=$('#collection-goal');if(goal)goal.innerHTML=collectionGoalMarkup();
  renderLocationGate();renderLightValues();renderWalk();
}
function renderLocationGate(){
  const gate=$('#location-gate');if(!gate)return;
  gate.hidden=!!position;$('#explore-view').classList.toggle('awaiting-location',!position);
  if(position)return;
  const info={locating:['Finding your world','Keep JiaYou open while your phone finds your location.'],denied:['Location is off','Allow location in your browser and device settings to discover places around you.'],waiting:['Still finding you','Your phone hasn’t returned a location yet. Check location access, then try again outdoors.'],unavailable:['Open in your browser','Open JiaYou in Safari or Chrome to use your phone’s location.']};
  const status=info[locationPhase],title=status?.[0]||'Start where you are',message=status?.[1]||'Allow location to see your map and discover your next stop.';
  gate.innerHTML=`<span class="gate-explorer">${companionMarkup({variant:'map',oil:lightLevel(state)})}</span><h2>${title}</h2><p>${message}</p><button class="button primary" data-action="${status?'location-help':'start-live'}">${icon(status?'book':'locate')}${status?'Location help':'Allow location'}</button><small>Nearby search and directions use your location. Photos stay on this device.</small>`;
}
function renderLightValues(){const oil=Math.round(lightLevel(state));$('#sidebar-oil').textContent=oil;$('#mobile-oil').textContent=oil;$('#sidebar-oil-fill').style.width=oil+'%';$('#companion-message').textContent=oil>70?'Ready to explore.':oil>30?'Let’s head out.':'Time to add oil.';syncCompanionStates(document,{walking:walking&&watch!==null,oil,arrived:!!(walking&&selected&&arrivalStatus(position,selected).eligible),arrivalKey:selected?.id||''});}
function renderNav(){const destination=currentView==='passport'?['explore','compass','Back to map']:['passport','passport','Passport'];const[id,i,label]=destination;const html=`<a href="#${id}" class="nav-item" aria-label="${label}" title="${label}">${icon(i)}</a>`;$('.desktop-nav').innerHTML=html;$('.bottom-nav').innerHTML=html;}
function showView(view){if(!nav.some(n=>n[0]===view))view='explore';currentView=view;if(view!=='explore')setNearby(false);for(const[n]of nav){$(`#${n}-view`).hidden=n!==view;$(`#${n}-view`).classList.toggle('active',n===view);}renderNav();if(view==='explore'){setTimeout(()=>{map?.invalidateSize();drawFog();},30);updateMap();if(appReady&&watch===null)autoConnect();}if(view==='passport')renderPassport();renderLightValues();}
function navigate(view){if(location.hash===`#${view}`)showView(view);else location.hash=view;}
function cityMetric(value,kind){return value==null?'Not recorded':kind==='area'?`${value<1?value.toFixed(2):value.toFixed(1)} km²`:formatDistance(value);}
function renderPassport(){
  const groups=groupJourneys(state),cityCount=groups.filter(g=>g.city.key!=='unsorted').length,total=state.stamps.length,group=groups.find(g=>g.city.key===passportCity);
  if(passportCity&&!group)passportCity=null;
  const card=s=>`<button class="stamp-card" data-memory="${esc(s.id)}">${stampMarkup(s,{size:'card',collected:true})}<strong>${esc(s.name)}</strong><small>${date(s.collectedAt)}</small>${(state.favorites||[]).includes(s.id)?'<span class="stamp-status">Favorite</span>':''}</button>`;
  if(group){
    const g=group;
    $('#passport-view').innerHTML=`<div class="city-heading"><button class="text-button" data-action="passport-home">← Passport</button><div><span class="field-label">${esc(g.city.country&&g.city.country!==g.city.name?g.city.country:'Your city collection')}</span><h1>${esc(g.city.name)}</h1><p>${g.stamps.length?'Every visit, a little more of the story.':'Your walks are the start of a story.'}</p></div><button class="icon-button" data-action="rename-city" aria-label="Edit trip name">${icon('settings')}</button></div><div class="city-stats"><div><strong>${g.stamps.length}</strong><span>${g.stamps.length===1?'place visited':'places visited'}</span></div><div><strong>${cityMetric(g.distance,'distance')}</strong><span>recorded walking</span></div><div><strong>${cityMetric(g.areaKm2,'area')}</strong><span>walking footprint</span></div></div><button class="recap-cta" data-action="recap" ${g.stamps.length?'':'disabled'}><span>${icon('sparkles')}</span><span><strong>Create trip recap</strong><small>Your places and memories in one shareable image.</small></span>${icon('arrow-right')}</button>${g.topPlaces.length?`<div class="section-title"><h2>Trip highlights</h2><span>${g.favorites.length?'Favorites first':'Up to three places'}</span></div><div class="city-highlights">${g.topPlaces.map(s=>`<button data-memory="${esc(s.id)}">${thumbnail(s)}<strong>${esc(s.name)}</strong></button>`).join('')}</div>`:''}<div class="section-title"><h2>Your collection</h2><span>${g.stamps.length} ${g.stamps.length===1?'stamp':'stamps'}</span></div><div class="stamp-grid">${g.stamps.map(card).join('')}</div><p class="storage-footnote">Walking distance is recorded during active walks with JiaYou open. Footprint estimates the area around recorded paths; it is not a percentage of the city. Favorite a visit to feature it in your recap.</p>`;
  }else{
    $('#passport-view').innerHTML=`<div class="page-heading"><div><span class="field-label">Your travel journal</span><h1>Passport</h1><p>Places you’ve been. Stories you keep.</p></div><button class="icon-button" data-action="settings" aria-label="Passport settings">${icon('settings')}</button></div><div class="passport-summary"><div><strong>${total}</strong><span>${total===1?'place visited':'places visited'}</span></div><div><strong>${cityCount}</strong><span>${cityCount===1?'city':'cities'}</span></div><div><strong>${formatDistance(state.distance||0)}</strong><span>recorded walking</span></div></div>${groups.length?`<div class="section-title"><h2>Your cities</h2><span>Open a collection</span></div><div class="journey-grid">${groups.map(g=>`<button class="journey-card" data-city="${esc(g.city.key)}"><span class="journey-art">${g.stamps.slice(0,3).map(st=>stampMarkup(st,{size:'card',collected:true})).join('')||icon('walk')}</span><span class="journey-copy"><h2>${esc(g.city.name)}</h2><p>${esc(g.city.country&&g.city.country!==g.city.name?g.city.country:'Your city collection')}</p><span class="journey-meta"><span>${g.stamps.length} ${g.stamps.length===1?'place':'places'}</span><span>${cityMetric(g.distance,'distance')} recorded</span></span></span>${icon('arrow-right')}</button>`).join('')}</div>`:`<div class="passport-empty"><span>${icon('passport')}</span><div><h2>Your story starts outside</h2><p>Find a place, walk there and mark your visit. Add a photo if you’d like. Your stamps and trip recaps will live here.</p></div><button class="button primary" data-action="explore">Find your first place</button></div>`}<p class="storage-footnote">Saved on this device. Back up your passport before switching phones.</p>`;
  }
}
function showLight(){const oil=Math.round(lightLevel(state));modal(`<div class="sheet-body">${heading('Your light')}<div class="light-mini">${companionMarkup({variant:'card',oil})}<strong>${oil}<small> / 100</small></strong></div><h3>${oil>70?'Ready for something new':oil>30?'Keep your curiosity glowing':'A little visit goes a long way'}</h3><p class="small-copy">Each new place adds 30 light and reveals more of the map. Your current discovery range is about ${formatDistance(discoveryRadius(oil))}.</p><p class="small-copy">Light fades slowly: one point every 30 minutes, down to a minimum of 10. Your collected stamps always stay with you.</p><button class="button primary full" data-action="explore">Explore nearby</button></div>`,'light-info');}
function showGuide(){modal(`<div class="sheet-body">${heading('A little guide')}<div class="guide-list">${[['pin','Find your next stop','Open Nearby or tap a place on the map.'],['walk','Make your way there','Start a walk for directions inside JiaYou.'],['check','Keep the memory','Within 50 m, mark your visit or take a photo or selfie. Each new stamp adds 30 light.'],['passport','Tell your story','Open Passport for your city collections, favorites and shareable trip recaps.']].map(([i,t,p])=>`<div class="guide-step"><span>${icon(i)}</span><div><h3>${t}</h3><p>${p}</p></div></div>`).join('')}</div><p class="small-copy">Maps and new searches need internet. Keep JiaYou open to record your walk; location pauses in the background.</p></div>`,'guide');}

function date(n){return new Intl.DateTimeFormat('en',{day:'numeric',month:'short',year:'numeric'}).format(n);}
function showPlace(id){const p=places.find(p=>p.id===id)||state.stamps.find(s=>s.id===id);if(!p)return;setNearby(false);walking=false;clearRoute();selected=p;announcedArrivalId=null;if(state.stamps.some(s=>s.id===id)){showMemory(id);return;}walking=false;renderPlace();if(map){map.panTo([p.lat,p.lng],{animate:!matchMedia('(prefers-reduced-motion:reduce)').matches});}updateMap();}
const arrivalMessages={LOCATION_REQUIRED:'Turn on location to check your arrival.',LOCATION_INACCURATE:'GPS accuracy is low. Move to an open spot and try again.',LOCATION_STALE:'Your location needs a fresh update.',INVALID_LOCATION:'Your location could not be read. Try again.',TOO_FAR:'Come within 50 m to save your visit.',ARRIVED:'You’re here. Mark your visit or take a photo.'};
function renderPlace(){
  if(!selected)return;
  const p=selected,media=mediaFor(p),distance=position?distanceMeters(position,p):null,arrival=arrivalStatus(position,p),arrived=arrival.eligible;
  const title=p.id==='node/2439950828'?'HKUST Red Bird':p.name;
  const photo=media?`<figure class="destination-photo"><img src="${esc(media.src)}" alt="${esc(media.alt)}" decoding="async"></figure>`:`<div class="destination-no-photo">${stampMarkup(p,{size:'card'})}<span>Destination stamp</span></div>`;
  const credits=media?`<div class="destination-photo-credit"><p>${esc(media.caption)}</p><a href="${esc(media.sourceUrl)}" target="_blank" rel="noopener">Photo: ${esc(media.credit)}</a> · <a href="${esc(media.licenseUrl)}" target="_blank" rel="noopener">${esc(media.license)}</a></div>`:'';
  modal(`<div class="destination-popup"><header class="destination-heading"><h2 id="sheet-title" tabindex="-1">${esc(title)}</h2><button class="icon-button" data-action="close" aria-label="Close">${icon('x')}</button></header>${photo}<div class="detail-metrics"><span><span id="detail-distance">${formatDistance(distance)}</span></span><span>+30 light</span><span>1 stamp</span></div><p class="destination-description">${esc(p.description||'A place to discover nearby. Check local signs for public access.')}</p><div class="destination-task">${icon('camera')}<p><strong>Task:</strong> ${esc(p.task||'Notice a detail you would like to remember.')}</p></div><div id="visit-controls">${visitControls(arrived)}</div><div class="destination-arrival"><span id="arrival-title" class="visually-hidden">${arrived?'You’ve arrived':walking?'On your way':'Ready when you are'}</span><span id="arrival-message">${arrivalMessages[arrival.reason]}</span></div><details class="destination-more"><summary>Directions, access & photo options</summary>${p.localName?`<p class="local-place-name">${esc(p.localName)}</p>`:''}<button class="find-place-link" data-action="find-place">${icon('pin')}Find the place</button><button class="button secondary full" data-action="directions">Walking directions</button><button class="button secondary full" data-action="camera" id="photo-visit-button" ${arrived?'':'disabled'} aria-describedby="arrival-message">${icon('camera')}Take a photo instead</button><p class="gps-detail" id="gps-detail">${position?`Location accuracy: ±${Math.round(position.accuracy)} m`:'A fresh location within 50 m lets you save your visit.'}</p>${placeMetadata(p)}<p class="small-copy">Distances are straight-line estimates. Follow public paths and local signs. If access is closed or unclear, choose another place.</p><p class="route-disclosure">Directions share your starting point and destination with FOSSGIS / OpenStreetMap.</p>${p.sourceUrl?`<a class="source-link" href="${safeOsmUrl(p.sourceUrl)}" target="_blank" rel="noopener">OpenStreetMap place record</a>`:''}<button class="text-button" data-action="choose-alternative">Choose another place</button>${credits}</details></div>`,'place');
}
function placeMetadata(p){const details=[['Opening hours',p.openingHours],['Wheelchair access',p.wheelchair],['Access',p.access],['On foot',p.foot]].filter(([,value])=>value);return details.length?`<dl class="place-metadata">${details.map(([label,value])=>`<div><dt>${label}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl><p>OpenStreetMap information. Check current signs and conditions on arrival.</p>`:'';}
function safeOsmUrl(url){return /^https:\/\/www\.openstreetmap\.org\/(node|way|relation)\/\d+$/.test(url)?url:'https://www.openstreetmap.org';}
function visitControls(arrived){return `<div class="destination-actions"><button class="button primary" data-action="walk" id="walk-button">${walking?'Resume Journey':'Begin Journey'}</button><button class="button secondary" data-action="mark-visited" ${arrived?'':'disabled'} aria-describedby="arrival-message">Already Been</button></div>`;}
function refreshArrival(){if(sheetType!=='place'||!selected)return;const status=arrivalStatus(position,selected);$('#detail-distance').textContent=formatDistance(status.distance);$('#arrival-message').textContent=arrivalMessages[status.reason];$('#gps-detail').textContent=position?`Location accuracy: ±${Math.round(position.accuracy)} m`:'Waiting for your location.';$('#arrival-title').textContent=status.eligible?'You’ve arrived':walking?'On your way':'Ready when you are';const controls=$('#visit-controls'),html=visitControls(status.eligible);if(controls&&controls.innerHTML!==html)controls.innerHTML=html;const photo=$('#photo-visit-button');if(photo)photo.disabled=!status.eligible;}
function recordWalkingFix(next){if(!walking||document.hidden){walkAnchor=null;return;}if(next.accuracy>35)return;if(!walkAnchor||next.timestamp-walkAnchor.timestamp>60000){walkAnchor=next;return;}if(next.timestamp<=walkAnchor.timestamp)return;if(distanceMeters(walkAnchor,next)<8)return;const updated=recordWalkSegment(state,walkAnchor,next,currentCity,{active:walking,foreground:!document.hidden,now:Date.now()});walkAnchor=next;if(updated!==state){Object.assign(state,updated);save();}}
async function updateCity(point){const token=++cityRequest;cityAnchor={...point};currentCity=null;updateMap();try{const city=await resolveCity(point);if(token!==cityRequest)return;currentCity=city;updateMap();}catch{ /* Keep the anchor to avoid retrying each GPS sample; saving a visit retries lookup. */ }}
async function autoConnect(){if(watch!==null||document.hidden||currentView!=='explore')return;try{const permission=await navigator.permissions?.query({name:'geolocation'});if(permission?.state==='granted'&&watch===null&&!document.hidden&&currentView==='explore')startLive({resume:true});}catch{}}

function stopLocation({resume=false}={}){
  locationGeneration++;clearTimeout(locationWaitTimer);locationWaitTimer=null;
  resumeLocationOnVisible=resume;locationPhase='paused';walkAnchor=null;
  if(watch!==null){navigator.geolocation?.clearWatch(watch);watch=null;}
  updateMap();
}
async function startLive({resume=false}={}){
  const resumePlace=(sheetType==='place'||sheetType==='directions'||walking)?selected:null;
  stopLocation();
  if(!resume){setNearby(false);closeSheet();$('#welcome').close();state.onboarded=true;save();navigate('explore');}

  locationPhase='locating';locationFallbackRequested=false;updateMap();
  if(globalThis.isSecureContext===false||typeof navigator.geolocation?.watchPosition!=='function'){
    locationPhase='unavailable';banner('This browser cannot provide live location. Open JiaYou in Safari or Chrome.','location-help','Location help');updateMap();return;
  }
  banner('Finding your location…','location-help','Help');
  const generation=locationGeneration;let receivedFix=false;
  const current=()=>generation===locationGeneration;
  locationWaitTimer=setTimeout(()=>{
    if(!current()||receivedFix)return;
    locationPhase='waiting';banner('Your browser hasn’t returned a location yet. Check permission, then retry.','location-help','Fix location');updateMap();
  },12000);
  const onFix=p=>{
    if(!current())return;
    const next={lat:p.coords?.latitude,lng:p.coords?.longitude,accuracy:p.coords?.accuracy,timestamp:p.timestamp};
    if(!Number.isFinite(next.lat)||Math.abs(next.lat)>90||!Number.isFinite(next.lng)||Math.abs(next.lng)>180||!Number.isFinite(next.accuracy)||next.accuracy<0||!Number.isFinite(next.timestamp)||Date.now()-next.timestamp>60000||next.timestamp>Date.now()+10000)return;
    if(position&&next.timestamp<position.timestamp)return;
    // A delayed network fix must not replace an already fresh, precise GPS fix.
    if(position&&position.accuracy<=80&&next.accuracy>80&&Date.now()-position.timestamp<15000)return;
    clearTimeout(locationWaitTimer);locationWaitTimer=null;
    receivedFix=true;const previous=position;position=next;locationPhase=next.accuracy<=80?'ready':'approximate';
    if(next.accuracy<=80){
      recordWalkingFix(next);
      const trail=state.explored||[];if(!trail.length||distanceMeters(trail.at(-1),next)>60){state.explored=[...trail,{lat:next.lat,lng:next.lng}].slice(-60);save();}
      if(!loadingPlaces)banner('');
    }else banner(`Approximate location · ±${Math.round(next.accuracy)} m. Waiting for a more accurate fix. Keep JiaYou open.`, 'location-help','Help');
    const corrected=previous&&previous.accuracy>80&&next.accuracy<=80;
    if(!previous||corrected){map?.setView([next.lat,next.lng],next.accuracy>1000?13:16);}
    if(!previous||(corrected&&distanceMeters(previous,next)>700)){
      requestController?.abort();liveRequestEpoch++;loadingPlaces=false;lastSearch=null;
      places=SEED_PLACES.filter(x=>distanceMeters(next,x)<5000);
      if(resumePlace&&!places.some(x=>x.id===resumePlace.id))places.push(resumePlace);
      fetchNearby();
    }else if(lastSearch&&distanceMeters(next,lastSearch)>700&&!loadingPlaces)fetchNearby();
    if(!cityAnchor||distanceMeters(cityAnchor,next)>1200)updateCity(next);
    ensureWalkingRoute();if(walking&&followWalk&&map&&!sheet.open&&currentView==='explore')map.panTo([next.lat,next.lng],{animate:false});
    updateMap();refreshArrival();
  };
  const onError=e=>{
    if(!current())return;
    clearTimeout(locationWaitTimer);locationWaitTimer=null;
    if(e.code===1){stopLocation();locationPhase='denied';banner('Location access is blocked. Allow it in your browser and device settings.','location-help','Fix location');updateMap();return;}
    locationPhase=position?(position.accuracy<=80?'ready':'approximate'):'waiting';
    banner(e.code===3?'Your browser is taking longer to find you. Check location access or try again outdoors.':'Your browser could not find your location. Check device Location Services and try again.','location-help','Fix location');
    // Some devices can return a network-based fix while high-accuracy GPS warms up.
    // It can centre the map, but cannot bypass the normal arrival accuracy checks.
    if(!receivedFix&&!locationFallbackRequested&&typeof navigator.geolocation.getCurrentPosition==='function'){
      locationFallbackRequested=true;
      try{navigator.geolocation.getCurrentPosition(onFix,error=>{if(current()&&error.code===1)onError(error);},{enableHighAccuracy:false,maximumAge:15000,timeout:10000});}catch{}
    }
    updateMap();
  };
  try{watch=navigator.geolocation.watchPosition(onFix,onError,{enableHighAccuracy:true,maximumAge:0,timeout:15000});}
  catch(e){onError({code:e.name==='SecurityError'?1:2});}
  updateMap();
}

async function fetchNearby(){const pos=position;if(!pos){startLive();return;}if(loadingPlaces)return;if(lastSearch&&distanceMeters(pos,lastSearch)<250&&Date.now()-lastSearch.time<60000){toast('Nearby places are up to date.');return;}loadingPlaces=true;updateMap();const epoch=liveRequestEpoch;const controller=new AbortController();requestController=controller;
  try{const found=await loadNearby(pos,{signal:controller.signal});if(epoch!==liveRequestEpoch)return;const all=new Map(places.map(p=>[p.id,p]));for(const fresh of found){const previous=all.get(fresh.id);all.set(fresh.id,{...fresh,...previous,...Object.fromEntries(['localName','openingHours','wheelchair','access','foot'].map(k=>[k,fresh[k]]))});}places=[...all.values()].filter(p=>distanceMeters(pos,p)<6000).slice(0,160);lastSearch={...pos,time:Date.now()};write('places',{center:{lat:pos.lat,lng:pos.lng},time:Date.now(),places});if(found.length)toast(`${found.length} places found nearby.`);else banner('No named spots were returned here. Try again in another neighbourhood.');}
  catch{if(epoch!==liveRequestEpoch)return;const cache=read('places',null);if(cache?.center&&distanceMeters(pos,cache.center)<3000){places=cache.places;banner('Showing previously saved places. Nearby search is unavailable right now.','refresh','Retry');}else{banner(places.length?'Nearby search is unavailable. Showing places already on your map.':'Nearby search is unavailable. Check your connection and try again.','refresh','Retry');}}
  finally{if(epoch===liveRequestEpoch){loadingPlaces=false;updateMap();}}
}
function stopCamera(){cameraGeneration++;if(stream){stream.getTracks().forEach(t=>t.stop());stream=null;}}
async function showCamera(){
  if(!selected)return;
  if(!arrivalStatus(position,selected).eligible){toast('Come within 50 m with an accurate location to save your visit.');renderPlace();return;}
  modal(`<div class="flow-header">${heading('Make a memory')}<p>${esc(selected.name)}</p></div><div class="flow-scroll camera-scroll"><div class="camera-task">${icon('camera')}<span>A selfie, a view, a detail. Make it yours.</span></div><div id="camera-area" class="camera-empty"><span class="camera-reticle">${icon('camera')}</span><h3>Opening camera</h3><p>Allow camera access to continue.</p></div><div id="camera-error" class="inline-error" role="alert" hidden></div><div class="camera-tools"><button class="button secondary" data-action="switch-camera">${icon('refresh')}${cameraFacing==='user'?'Use rear camera':'Take a selfie'}</button></div><p class="camera-privacy">${icon('shield')}Your photos stay on your device.</p></div><div class="flow-footer camera-footer"><button id="shutter" class="button primary full shutter-button" data-action="shutter" disabled>${icon('camera')}Take photo</button><button class="text-button" data-action="mark-visited">Save without a photo</button><button class="text-button" data-action="return-place">Back to place</button></div>`,'camera');

  const gen=cameraGeneration,originMode=mode,originSelected=selected;
  const current=()=>gen===cameraGeneration&&mode===originMode&&selected===originSelected&&sheet.open&&sheetType==='camera';
  try{
    if(!navigator.mediaDevices?.getUserMedia)throw Error('CAMERA_UNAVAILABLE');
    const media=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:cameraFacing},width:{ideal:1280},height:{ideal:1280}},audio:false});
    if(!current()){media.getTracks().forEach(t=>t.stop());return;}
    stream=media;$('#camera-area').outerHTML='<video id="camera-video" class="camera-view" autoplay playsinline muted aria-label="Live camera preview"></video>';
    const video=$('#camera-video'),shutter=$('#shutter');video.srcObject=media;await video.play();
    if(!current()){media.getTracks().forEach(t=>t.stop());return;}
    const ready=()=>{if(current()&&$('#shutter')===shutter)shutter.disabled=false;};
    video.addEventListener('loadeddata',ready,{once:true});if(video.readyState>=2)ready();
  }catch(e){
    if(!current())return;stopCamera();
    const video=$('#camera-video');if(video)video.outerHTML='<div id="camera-area" class="camera-empty"></div>';
    const area=$('#camera-area'),error=$('#camera-error'),shutter=$('#shutter');
    if(area)area.innerHTML=icon('camera')+'<p>Your camera isn’t available yet.</p>';
    if(error){error.textContent=e.name==='NotAllowedError'?'Camera access is off. Allow it in your browser settings, then try again.':'This browser could not open the camera. Try Safari or Chrome on your phone.';error.hidden=false;}
    if(shutter){shutter.disabled=false;shutter.dataset.action='camera';shutter.innerHTML=icon('refresh')+'Try camera again';}
  }
}
function takePhoto(){const v=$('#camera-video');if(!v?.videoWidth){toast('Wait for the camera preview, then try again.');return;}const canvas=document.createElement('canvas');const scale=Math.min(1,1100/Math.max(v.videoWidth,v.videoHeight));canvas.width=v.videoWidth*scale;canvas.height=v.videoHeight*scale;canvas.getContext('2d').drawImage(v,0,0,canvas.width,canvas.height);pendingPhoto={data:canvas.toDataURL('image/jpeg',.82),sample:false,method:'photo'};showReview();}
function markVisited(){if(!selected)return;if(!arrivalStatus(position,selected).eligible){toast('Come within 50 m with an accurate location to mark your visit.');renderPlace();return;}pendingPhoto={method:'checkin',data:null,sample:false};showReview();}
function showReview(){
  stopCamera();const photo=pendingPhoto;if(!photo||!selected)return;
  const withPhoto=photo.method!=='checkin';
  modal(`<div class="flow-header">${heading(withPhoto?'Keep this memory?':'You were here')}<p>${esc(selected.name)}</p></div><div class="flow-scroll review-scroll">${withPhoto?`<figure class="review-photo"><img src="${esc(photo.data)}" alt="Your photo of ${esc(selected.name)}"></figure>`:`<div class="checkin-art">${stampMarkup(selected,{size:'hero'})}<p>A new place in your story.</p></div>`}<div class="review-collectible">${stampMarkup(selected,{size:'card'})}<div><strong>${esc(stampIdentity(selected).label)}</strong><span>Destination stamp · +30 light</span></div>${icon('check')}</div><label class="label" for="memory-note">Add a note <span>Optional</span></label><textarea id="memory-note" maxlength="1000" rows="2" placeholder="What did you notice?"></textarea><div id="save-error" class="inline-error" role="alert" hidden></div></div><div class="flow-footer review-footer"><button class="button primary full" data-action="collect" id="collect-button">Save visit ${icon('check')}</button><button class="text-button" data-action="camera">${withPhoto?'Retake photo':'Add a photo instead'}</button></div>`,'review');pendingPhoto=photo;
}

let dbPromise;
function database(){
  if(!dbPromise){
    const opening=new Promise((resolve,reject)=>{
      if(!globalThis.indexedDB){reject(Error('Storage unavailable'));return;}
      const req=indexedDB.open('jiayou-memories',1);
      req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('photos'))req.result.createObjectStore('photos');};
      req.onerror=()=>reject(req.error||Error('Storage unavailable'));
      req.onblocked=()=>{toast('Close other JiaYou tabs to finish opening photo storage.');};
      req.onsuccess=()=>{const db=req.result;db.onversionchange=()=>{db.close();dbPromise=null;};resolve(db);};
    });
    dbPromise=opening.catch(error=>{dbPromise=null;throw error;});
  }
  return dbPromise;
}
async function photoStore(action,key,value){const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('photos',action==='get'?'readonly':'readwrite'),s=tx.objectStore('photos');const r=action==='get'?s.get(key):action==='delete'?s.delete(key):s.put(value,key);let result;r.onsuccess=()=>{result=r.result;};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Storage aborted'));});}
let collectionToken=0,collectionPending=false,memoryToken=0,restoreToken=0,restorePending=false;
async function collect(){
  if(collectionPending||!selected||!pendingPhoto||sheetType!=='review'||!sheet.open)return;
  const btn=$('#collect-button');if(!btn)return;
  const token=++collectionToken,originMode=mode,profile='real',originState=state,originSelected=selected;
  const place={...selected},photo=pendingPhoto,note=$('#memory-note')?.value||'';
  const key=photo.method==='checkin'?null:`${profile}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  const current=()=>token===collectionToken&&mode===originMode&&state===originState&&selected===originSelected&&pendingPhoto===photo&&sheet.open&&sheetType==='review'&&$('#collect-button')===btn;
  let stored=false,committed=false;collectionPending=true;btn.disabled=true;btn.textContent='Saving…';
  try{
    awardStamp(originState,place,{now:Date.now(),photoKey:key,note,mode:profile,method:photo.method||'photo',position});
    try{place.city=await resolveCity(place);}catch{ /* An unresolved city stays editable in Passport. */ }
    if(!current())return;
    if(key){await photoStore('put',key,{data:photo.data,sample:false});stored=true;}
    if(!current())return;
    // Revalidate arrival at commit and retain foreground distance/trail updates.
    const next=awardStamp(originState,place,{now:Date.now(),photoKey:key,note,mode:profile,method:photo.method||'photo',position});
    if(!write(profile,next))throw Error('STORAGE_FAILED');
    state=next;committed=true;pendingPhoto=null;walking=false;walkAnchor=null;const oldVisible=new Set(revealPlaces(places,centerPosition(),originState).map(p=>p.id));updateMap();showReward(place,visiblePlaces.filter(p=>!oldVisible.has(p.id)).length);navigator.vibrate?.([35,50,35]);
  }catch(e){
    if(current()){
      const error=$('#save-error');if(error){error.textContent=arrivalMessages[e.code]||(e.code==='DUPLICATE_STAMP'?'This stamp is already in your passport.':'Your memory could not be saved. Check device storage, then try again.');error.hidden=false;}
    }else if(committed)toast('Your stamp was saved. Open Passport to see it.');
  }finally{
    if(stored&&!committed){try{await photoStore('delete',key);}catch{}}
    if(token===collectionToken)collectionPending=false;
    if($('#collect-button')===btn){btn.disabled=false;btn.innerHTML='Save visit '+icon('check');}
  }
}
function collectionGoalMarkup(){
  const goal=collectionMilestone(state);
  const title=goal.complete?'Three places, one collection':goal.completedSets?'Your next three places':'Your first three places';
  const message=goal.complete?'Collection complete. Your next visit begins another.':`${goal.remaining} ${goal.remaining===1?'new place':'new places'} to complete this collection.`;
  return `<div class="collection-copy"><strong>${title}</strong><span>${message}</span></div><div class="collection-dots" role="progressbar" aria-label="Three-place collection" aria-valuenow="${goal.progress}" aria-valuemax="3" aria-valuemin="0">${[0,1,2].map(i=>`<i class="${i<goal.progress?'is-filled':''}" aria-hidden="true">${i<goal.progress?icon('check'):i+1}</i>`).join('')}</div>`;
}
function showReward(p,newCount=0){
  const next=nextUnvisitedDestination(revealPlaces(places,centerPosition(),state),centerPosition(),state);
  const nextAction=next?`<button class="next-stop" data-place="${esc(next.id)}">${thumbnail(next)}<span class="next-stop-copy"><small>Next place to discover</small><strong>${esc(next.name)}</strong><span>${formatDistance(next.distance)} · straight-line distance</span></span>${icon('arrow-right')}</button>`:'<p class="small-copy">No more places to suggest here yet. Explore the map when you’re ready for somewhere new.</p>';
  modal(`<div class="reward-screen"><button class="icon-button reward-close" data-action="close" aria-label="Close">${icon('x')}</button><div class="reward-heading"><span>Visit saved</span><h2>New stamp collected</h2></div><div class="stamp-reveal"><span class="reward-orbit" aria-hidden="true"></span>${stampMarkup(p,{size:'hero',collected:true,animate:true})}</div><h3 class="reward-place">${esc(p.name)}</h3><div class="reward-progress"><span>${icon('flame')}<strong>+30</strong> light</span><span>${icon('passport')}<strong>${state.stamps.length}</strong> ${state.stamps.length===1?'stamp':'stamps'}</span></div><div class="collection-goal">${collectionGoalMarkup()}</div>${nextAction}<button class="button secondary full" data-action="passport">View passport</button><button class="text-button" data-action="continue">Back to map</button></div>`,'reward');
}
async function showMemory(id){
  const found=state.stamps.find(x=>x.id===id);if(!found)return;memorySelectedId=id;
  const s={...found},token=++memoryToken,originMode=mode,originState=state;
  const favorite=(state.favorites||[]).includes(id);
  modal(`<div class="flow-header">${heading('Your visit')}<p>${date(s.collectedAt)}${s.city?.name?' · '+esc(s.city.name):''}</p></div><div class="flow-scroll memory-scroll"><div id="memory-image" class="${s.photoKey?'camera-empty':'checkin-art'}">${s.photoKey?'<p>Loading your photo…</p>':stampMarkup(s,{size:'hero',collected:true})+'<p>Location checked. Memory kept.</p>'}</div><div class="memory-destination">${stampMarkup(s,{size:'card',collected:true})}<div><h2>${esc(s.name)}</h2><span>Stamp collected</span></div></div><button class="favorite-toggle ${favorite?'is-favorite':''}" data-action="favorite" aria-pressed="${favorite}">${icon('sparkles')}${favorite?'A favorite place':'Add to favorites'}</button>${s.note?`<div class="visit-note"><span>Your note</span><p>${esc(s.note)}</p></div>`:''}</div><div class="flow-footer"><button class="button secondary full" data-action="passport">Back to passport</button></div>`,'memory');
  if(!s.photoKey)return;
  const placeholder=$('#memory-image');
  const current=()=>token===memoryToken&&mode===originMode&&state===originState&&sheet.open&&sheetType==='memory'&&$('#memory-image')===placeholder;
  try{const p=await photoStore('get',s.photoKey);if(!current())return;placeholder.outerHTML=p&&!p.sample?`<div id="memory-image"><img class="memory-photo" src="${esc(p.data)}" alt="Saved memory of ${esc(s.name)}"></div>`:`<div class="checkin-art">${seal(s)}<p>Your stamp is here. This photo is unavailable on this device.</p></div>`;}catch{if(current())placeholder.innerHTML=seal(s)+'<p>Your photo storage is unavailable. Your stamp is safely recorded.</p>';}
}
function favoriteVisit(){if(!memorySelectedId)return;const next=toggleFavorite(state,memorySelectedId);if(!write('real',next))return;state=next;showMemory(memorySelectedId);if(currentView==='passport')renderPassport();}
async function showRecap(){
  const group=groupJourneys(state).find(g=>g.city.key===passportCity);if(!group||!group.stamps.length)return;
  releaseRecap();const controller=new AbortController();recapController=controller;
  modal(`<div class="sheet-body">${heading('Your trip, in one picture')}<div class="recap-status" role="status"><span class="route-loading-line"></span><h3>Putting your story together</h3><p>Collecting your places, photos and favorite moments…</p></div></div>`,'recap');
  const current=()=>recapController===controller&&!controller.signal.aborted&&sheet.open&&sheetType==='recap';
  try{const result=await makeTripRecap(group,{getPhoto:key=>photoStore('get',key),signal:controller.signal});if(!current())return;recapResult=result;recapUrl=URL.createObjectURL(result.blob);modal(`<div class="flow-header">${heading('Made of little adventures')}<p>${esc(group.city.name)} · Your trip recap</p></div><div class="flow-scroll"><div class="recap-preview"><img src="${esc(recapUrl)}" alt="Your ${esc(group.city.name)} trip collage with visited places and walking statistics"></div><p class="small-copy">Made on your device. Share only the memories you want others to see.</p></div><div class="flow-footer recap-actions"><button class="button primary" data-action="share-recap">${icon('share')}Share recap</button><button class="button secondary" data-action="download-recap">${icon('download')}Save image</button></div>`,'recap');}catch(error){if(current())modal(`<div class="sheet-body">${heading('Let’s try that again')}<div class="recap-empty"><p>Your recap couldn’t be created. Your visits are safely saved.</p><button class="button primary" data-action="recap">Try again</button></div></div>`,'recap');}
}
function downloadRecap(){if(!recapResult||!recapUrl)return;const a=document.createElement('a');a.href=recapUrl;a.download=recapResult.filename;a.click();toast('Image downloaded. Find it in your browser’s downloads.');}
async function shareRecap(){if(!recapResult)return;const result=recapResult;const file=new File([result.blob],result.filename,{type:'image/png'});if(navigator.share&&navigator.canShare?.({files:[file]})){try{await navigator.share({files:[file],title:'My JiaYou trip'});}catch(error){if(error.name!=='AbortError'&&recapResult===result)downloadRecap();}}else downloadRecap();}
function renameCity(){const g=groupJourneys(state).find(g=>g.city.key===passportCity);if(!g)return;modal(`<div class="sheet-body">${heading('Name this trip')}<label class="label" for="city-name">City or region</label><input class="name-input" id="city-name" maxlength="80" value="${esc(g.city.name==='Unsorted places'?'':g.city.name)}" placeholder="e.g. Hong Kong"><label class="label" for="city-country">Country or region <span>Optional</span></label><input class="name-input" id="city-country" maxlength="80" value="${esc(g.city.country||'')}"><button class="button primary full" data-action="save-city">Save trip name</button></div>`,'city-name');}
function saveCityName(){const name=$('#city-name')?.value.trim(),country=$('#city-country')?.value.trim()||'';if(!name){toast('Add a city or region name.');return;}const g=groupJourneys(state).find(g=>g.city.key===passportCity);if(!g)return;const city={...g.city,name,country},ids=new Set(g.stamps.map(s=>s.id)),next={...state,stamps:state.stamps.map(s=>ids.has(s.id)?{...s,city}:s),journeys:{...state.journeys}};if(next.journeys[city.key])next.journeys[city.key]={...next.journeys[city.key],city};if(!write('real',next))return;state=next;closeSheet();renderPassport();}

function showPhotoCredits(){modal(`<div class="sheet-body">${heading('Destination photography','Sources & licences')}<p class="small-copy">These are real photographs of the named places. They are reference images, not live views or proof of current access.</p><div class="photo-credits-list">${Object.entries(PLACE_MEDIA).map(([id,m])=>`<article><img src="${esc(m.src)}" alt="${esc(m.alt)}" loading="lazy"><h3>${esc(SEED_PLACES.find(p=>p.id===id)?.name||'Place photograph')}</h3><p>${esc(m.caption)}</p><p><a href="${esc(m.sourceUrl)}" target="_blank" rel="noopener">${esc(m.credit)}</a> · <a href="${esc(m.licenseUrl)}" target="_blank" rel="noopener">${esc(m.license)}</a></p></article>`).join('')}</div></div>`,'credits');}
async function showLocationHelp(){
  const env=installEnvironment();
  const phaseText=locationPhase==='denied'?'Location access is blocked.':position?`Location accuracy: ±${Math.round(position.accuracy)} m.`:'Your browser has not returned a location yet.';
  const policy=document.permissionsPolicy||document.featurePolicy;
  const policyBlocked=policy?.allowsFeature?.('geolocation')===false;
  modal(`<div class="sheet-body location-help">${heading('Find your location')}<p class="location-summary" role="status">${esc(phaseText)}</p>${policyBlocked?'<p class="inline-error">This browser frame does not allow location. Open the shared link directly in Safari or Chrome.</p>':''}<ol><li><strong>Open in your phone’s browser</strong><p>If you opened JiaYou inside Codex or a chat app, copy the link below into Safari on iPhone or Chrome on Android.</p></li><li><strong>Allow location access</strong><p>Check JiaYou’s site permission and your device’s Location Services. Allow your browser to use your location; enable Precise Location if offered.</p></li><li><strong>Try again with JiaYou open</strong><p>Move near a window or outdoors if the signal is weak. An approximate fix can show the map; collecting a stamp needs an accurate fix at the place.</p></li></ol><input class="name-input" aria-label="JiaYou link" readonly value="${esc(location.origin+'/')}" onclick="this.select()"><button class="button primary full" data-action="start-live">${icon('locate')}Try location again</button><p class="small-copy" id="location-permission-status">${env.locationSupported?'Location is available in this browser.':'This browser does not expose location access.'}</p></div>`,'location-help');
  try{const permission=await navigator.permissions?.query({name:'geolocation'});if(sheetType==='location-help'&&permission)$('#location-permission-status').textContent=permission.state==='denied'?'Browser permission: blocked. Change the site permission, then retry.':permission.state==='granted'?'Browser permission: allowed. Device Location Services must also be on.':'Browser permission: waiting for your choice. Accept the location prompt when it appears.';}catch{}
}
function showSettings(){modal(`<div class="sheet-body">${heading('Menu')}<div class="settings-group"><h3>Explore</h3>${utilityRow('browse-nearby','compass','Nearby places')}<div class="menu-filters"><button class="filter menu-filter" data-filter="all" aria-pressed="${filter==='all'}">All spots</button><button class="filter menu-filter" data-filter="views" aria-pressed="${filter==='views'}">${icon('mountain')}Views</button></div></div><div class="settings-group"><h3>Experience</h3><button class="utility-row" data-theme-toggle aria-pressed="${document.documentElement.dataset.mapTheme==='dark'}" aria-label="Switch to ${document.documentElement.dataset.mapTheme==='dark'?'light':'dark'} map"><span class="utility-icon">${icon('compass')}</span><span><strong>Dark map</strong><small>Switch between light and dark</small></span></button><label class="motion-setting"><span>Animations<small>Follows your device’s reduced-motion setting.</small></span><input type="checkbox" id="motion-toggle" ${motionEnabled?'checked':''}></label>${utilityRow('location-help','locate','Location help')}${utilityRow('help','book','How JiaYou works')}</div><div class="settings-group"><h3>Passport & storage</h3><p>Your stamps, photos and notes are saved on this device.</p>${utilityRow('export','download','Back up passport')}${utilityRow('import','upload','Restore backup')}</div><div class="settings-group"><h3>App</h3>${utilityRow('install','download','Install JiaYou')}${utilityRow('share','share','Share app')}${utilityRow('about','book','About JiaYou')}${utilityRow('photo-credits','camera','Photo credits')}</div><button class="text-button danger" data-action="reset-confirm">Reset passport</button><p class="version-note">JiaYou 1.6</p></div>`,'settings');}

function showAbout(){modal(`<div class="sheet-body">${heading('About JiaYou')}<div class="about-brand"><img src="./assets/icon-192.png" width="70" height="70" alt=""><h3>JiaYou 加油</h3><p>Explore. Collect. Keep going.</p></div><p class="small-copy">ISDN3300 · Group 5<br>Victor Nesteruk, Chunzi (Linda) Liu and Davi Oppes.</p><p class="small-copy">Companion artwork adapts Linda’s hooded explorer sketch with AI-assisted rendering. Destination stamps are original vector illustrations; some are symbolic designs.</p><p class="small-copy">Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>. Map interface: <a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>. Nearby places: Overpass / OpenStreetMap map API. Walking directions: <a href="https://routing.openstreetmap.de/about.html" target="_blank" rel="noopener">FOSSGIS OSRM pedestrian service</a>. <a href="https://photon.komoot.io" target="_blank" rel="noopener">Photon</a> resolves city names from rounded coordinates. Nunito by Vernon Adams, Cyreal and Jacques Le Bailly (SIL OFL).</p><details class="about-rules"><summary>Visits & privacy</summary><p>Arrival within 50 m, GPS accuracy within 50 m and a fix no older than 60 seconds. A new stamp adds 30 light. Photos are visit memories; their contents are not automatically verified. Mark a visit with or without a photo. Photos, favorites, walking statistics and recaps stay on your device. Keep JiaYou open to record walks; background GPS is paused.</p></details><button class="button secondary full" data-action="photo-credits">Photo credits</button></div>`,'about');}
function showInstall(){modal(`<div class="sheet-body">${heading('Install JiaYou')}${installGuideMarkup(installEnvironment(),{canPrompt:!!installPrompt})}<button class="button secondary full" data-action="share">${icon('share')}Share app link</button></div>`,'install');}
async function shareApp(){try{const data={title:'JiaYou',text:'Explore nearby places and collect destination stamps with JiaYou. Open in Safari or Chrome and add it to your home screen.',url:location.origin+'/'};if(navigator.share)await navigator.share(data);else{await navigator.clipboard.writeText(data.url);toast('App link copied.');}}catch(e){if(e.name!=='AbortError')modal(`<div class="sheet-body">${heading('Share JiaYou')}<p class="small-copy">Copy this link into your group chat:</p><input class="name-input" readonly value="${esc(location.origin+'/')}" aria-label="Shareable app link" onclick="this.select()"></div>`,'share');}}
async function exportData(){const exportState=structuredClone(state),exportMode='real';toast('Preparing your memory backup…');try{const photos={};for(const s of exportState.stamps){if(!s.photoKey)continue;const p=await photoStore('get',s.photoKey);if(p)photos[s.photoKey]=p;}const blob=new Blob([JSON.stringify({app:'jiayou',version:1,mode:exportMode,exportedAt:new Date().toISOString(),state:exportState,photos})],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`JiaYou-memories-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);toast('Backup downloaded. Keep it somewhere safe.');}catch{toast('Backup could not read your photos. Try again with device storage available.');}}
function validateBackup(data){
  if(data?.app!=='jiayou'||data.version!==1||data.mode!=='real'||data.state?.version!==1||!Array.isArray(data.state.stamps)||data.state.stamps.length>500||!data.photos||typeof data.photos!=='object')throw Error('INVALID_BACKUP');
  const st=data.state;if(!Number.isFinite(st.oil)||st.oil<0||st.oil>100||!Number.isFinite(st.oilUpdatedAt)||!Number.isFinite(st.distance)||st.distance<0)throw Error('INVALID_BACKUP');
  const ids=new Set(),stamps=[];
  const cleanCity=c=>c&&typeof c.key==='string'&&c.key.length<=180&&!['__proto__','constructor','prototype'].includes(c.key)&&typeof c.name==='string'&&c.name.trim()&&c.name.length<=120?{key:c.key,name:c.name,country:typeof c.country==='string'?c.country.slice(0,120):'',countryCode:/^[a-z]{2}$/i.test(c.countryCode||'')?c.countryCode:'',...(Number.isFinite(c.lat)&&Math.abs(c.lat)<=90&&Number.isFinite(c.lng)&&Math.abs(c.lng)<=180?{lat:c.lat,lng:c.lng}:{})}:undefined;
  for(const item of st.stamps){
    const s={...item},method=s.method||'photo';
    if(typeof s.id!=='string'||!s.id||s.id.length>200||ids.has(s.id)||typeof s.name!=='string'||!s.name||s.name.length>120||!Object.hasOwn(cats,s.category)||s.category==='all'||!Number.isFinite(s.lat)||Math.abs(s.lat)>90||!Number.isFinite(s.lng)||Math.abs(s.lng)>180||!Number.isFinite(s.collectedAt)||s.collectedAt<0||!['photo','checkin'].includes(method)||(method==='photo'&&(typeof s.photoKey!=='string'||!s.photoKey))||(s.photoKey!=null&&typeof s.photoKey!=='string')||typeof s.note!=='string'||s.note.length>1000||s.mode!=='real')throw Error('INVALID_BACKUP');
    ids.add(s.id);const p=s.photoKey?data.photos[s.photoKey]:null;if(p&&(p.sample||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(p.data)||p.data.length>5000000))throw Error('INVALID_BACKUP');
    stamps.push({id:s.id,name:s.name,category:s.category,lat:s.lat,lng:s.lng,collectedAt:s.collectedAt,photoKey:s.photoKey||null,note:s.note,mode:'real',method,...(cleanCity(s.city)?{city:cleanCity(s.city)}:{})});
  }
  const journeys={};let count=0,totalCells=0;
  for(const item of Object.values(st.journeys&&typeof st.journeys==='object'?st.journeys:{})){
    if(++count>500)throw Error('INVALID_BACKUP');const city=cleanCity(item?.city);if(!city||!Number.isFinite(item.distance)||item.distance<0)continue;
    const cells=[...new Set((Array.isArray(item.cells)?item.cells:[]).filter(v=>typeof v==='string'&&/^\d{1,6}:\d{1,6}$/.test(v)))];totalCells+=cells.length;if(totalCells>50000)throw Error('INVALID_BACKUP');
    journeys[city.key]={city,distance:item.distance,cells,lastWalkAt:Number.isFinite(item.lastWalkAt)?item.lastWalkAt:0};
  }
  return {...createState(),oil:st.oil,oilUpdatedAt:st.oilUpdatedAt,distance:st.distance,onboarded:true,stamps,visited:[...ids],journeys,favorites:[...new Set((Array.isArray(st.favorites)?st.favorites:[]).filter(id=>ids.has(id)))],walkRecordedAt:Number.isFinite(st.walkRecordedAt)?st.walkRecordedAt:0,explored:Array.isArray(st.explored)?st.explored.filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lng)&&Math.abs(p.lat)<=90&&Math.abs(p.lng)<=180).map(p=>({lat:p.lat,lng:p.lng})).slice(-60):[],settings:{}};
}
let pendingImport=null;
$('#import-file').addEventListener('change',async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;try{if(f.size>30000000)throw Error();const data=JSON.parse(await f.text());const cleaned=validateBackup(data);pendingImport={...data,state:cleaned};modal(`<div class="sheet-body">${heading('Restore passport?')}<p class="place-description">This backup contains ${cleaned.stamps.length} stamps. It will replace your passport on this device.</p><button class="button primary full" data-action="restore-confirm">Restore backup</button><button class="button secondary full" data-action="close">Keep current memories</button></div>`,'restore');}catch{toast('That isn’t a valid JiaYou backup, or it is larger than 30 MB.');}});
async function restoreBackup(){
  if(restorePending||!pendingImport||sheetType!=='restore'||!sheet.open)return;
  const imp=pendingImport,targetMode=imp.mode,originMode=mode,originState=state,token=++restoreToken;
  if(targetMode!=='real')return;
  const confirm=$('[data-action="restore-confirm"]'),staged=[],snapshot={...imp.state,stamps:imp.state.stamps.map(s=>({...s})),visited:[...imp.state.visited]};
  let storedBefore,committed=false;restorePending=true;
  const current=()=>token===restoreToken&&pendingImport===imp&&mode===originMode&&state===originState&&sheet.open&&sheetType==='restore'&&$('[data-action="restore-confirm"]')===confirm;
  try{
    storedBefore=localStorage.getItem(STORAGE+targetMode);
    for(const s of snapshot.stamps){
      if(!current())return;
      if(!s.photoKey)continue;
      const photo=imp.photos[s.photoKey];
      const key=`${targetMode}-restore-${Date.now()}-${Math.random().toString(36).slice(2,10)}-${staged.length}`;
      s.photoKey=key;
      if(photo){staged.push(key);await photoStore('put',key,photo);}
    }
    if(!current()||localStorage.getItem(STORAGE+targetMode)!==storedBefore)return;
    if(!write(targetMode,snapshot))throw Error('STORAGE_FAILED');
    committed=true;if(originMode===targetMode)state=snapshot;
    pendingImport=null;closeSheet();updateMap();showView(currentView);toast(`${snapshot.stamps.length} stamps restored to your passport.`);
  }catch{if(current())toast('Restore could not finish. Free some device storage and retry.');}
  finally{
    if(!committed)for(const key of staged){try{await photoStore('delete',key);}catch{}}
    if(token===restoreToken)restorePending=false;
  }
}
function confirmReset(){modal(`<div class="sheet-body">${heading('Reset passport?')}<p class="place-description">This removes your stamps, notes, photos and walking statistics on this device. Back up your passport first if you want to keep them.</p><button class="button secondary full" data-action="export">Back up first</button><button class="button danger full" data-action="reset">Reset passport</button><button class="text-button" data-action="close">Cancel</button></div>`,'reset');}
async function reset(){clearRoute();setNearby(false);const old=state;state=createState();state.onboarded=true;if(!save()){state=old;return;}selected=null;walking=false;passportCity=null;closeSheet();updateMap();showView(currentView);for(const s of old.stamps){if(s.photoKey)try{await photoStore('delete',s.photoKey);}catch{}}toast('Passport reset.');}
const actions={close:closeSheet,settings:showSettings,help:showGuide,light:showLight,passport:()=>{closeSheet();navigate('passport');},'passport-home':()=>{passportCity=null;renderPassport();},explore:()=>{closeSheet();navigate('explore');},'start-live':()=>startLive(),'dismiss-welcome':()=>$('#welcome').close(),locate:()=>{if(watch!==null&&position){followWalk=true;map?.setView([position.lat,position.lng],17);}else startLive();},'zoom-in':()=>map?.zoomIn(),'zoom-out':()=>map?.zoomOut(),refresh:()=>{if(map)map.eachLayer(l=>{if(l instanceof L.TileLayer)l.redraw();});fetchNearby();},'clear-search':()=>{query='';$('#place-search').value='';updateMap();},walk:beginWalk,camera:showCamera,shutter:takePhoto,'mark-visited':markVisited,'switch-camera':()=>{cameraFacing=cameraFacing==='user'?'environment':'user';showCamera();},'return-place':renderPlace,collect,continue:()=>{closeSheet();navigate('explore');if(position)map?.setView([position.lat,position.lng],15);},install:showInstall,'install-now':async()=>{const prompt=installPrompt;installPrompt=null;if(!prompt){showInstall();return;}try{await prompt.prompt();const choice=await prompt.userChoice;if(choice.outcome==='accepted')toast('Follow your browser to finish installing JiaYou.');else showInstall();}catch{showInstall();}},share:shareApp,export:exportData,import:()=>$('#import-file').click(),'restore-confirm':restoreBackup,'reset-confirm':confirmReset,reset,favorite:favoriteVisit,recap:showRecap,'share-recap':shareRecap,'download-recap':downloadRecap,'rename-city':renameCity,'save-city':saveCityName};
Object.assign(actions,{'browse-nearby':()=>{closeSheet();navigate('explore');setNearby(true);},'find-place':showFindPlace,'view-place':renderPlace,'choose-alternative':chooseAlternative,'end-walk':endWalk,'photo-credits':showPhotoCredits,about:showAbout,'location-help':showLocationHelp,nearby:()=>setNearby(!nearbyOpen), 'close-nearby':()=>setNearby(false,{focus:true}),directions:showDirections,reroute:()=>requestWalkingRoute(true),'route-overview':()=>{walking=true;followWalk=false;setNearby(false);closeSheet();navigate('explore');if(watch===null)startLive();else{updateMap();fitWalkingRoute();}},'route-location':()=>{walking=true;startLive();}});

document.addEventListener('change',e=>{if(e.target.id==='motion-toggle'){motionEnabled=e.target.checked;write('motion',motionEnabled);document.documentElement.dataset.motion=motionEnabled?'on':'off';}});
document.addEventListener('error',e=>{if(e.target instanceof HTMLImageElement&&e.target.closest('.place-thumbnail'))e.target.hidden=true;},true);
document.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(b){const result=actions[b.dataset.action]?.();if(result?.catch)result.catch(()=>toast('That didn’t finish. Please try again.'));}const city=e.target.closest('[data-city]');if(city){passportCity=city.dataset.city;renderPassport();$('#passport-view').scrollTop=0;}const p=e.target.closest('[data-place]');if(p)showPlace(p.dataset.place);const m=e.target.closest('[data-memory]');if(m)showMemory(m.dataset.memory);const f=e.target.closest('[data-filter]');if(f)selectFilter(f.dataset.filter);});
function renderFilters(){$('#filters').innerHTML=[['food','Cafe'],['culture','Museum'],['nature','Nature']].map(([id,label])=>`<button class="filter ${filter===id?'active':''}" data-filter="${id}" aria-pressed="${filter===id}">${icon(cats[id].icon)}${label}</button>`).join('');}
function selectFilter(id){if(!Object.hasOwn(cats,id))return;filter=filter===id?'all':id;renderFilters();updateMap();if(sheetType==='settings'){closeSheet();navigate('explore');setNearby(true);}}
$('#place-search').addEventListener('input',e=>{query=e.target.value.trim();updateMap();if(query&&!walking)setNearby(true);});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&nearbyOpen&&!sheet.open){setNearby(false,{focus:true});return;}if(e.key==='/'&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)&&!sheet.open&&!$('#welcome').open){e.preventDefault();navigate('explore');$('#place-search').focus();}});
window.addEventListener('hashchange',()=>showView(location.hash.slice(1)));
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;});
window.addEventListener('appinstalled',()=>{installPrompt=null;toast('JiaYou is ready on your home screen.');});
window.addEventListener('offline',()=>{banner('You’re offline. Your saved stamps are here; map tiles and new searches need internet.');});
window.addEventListener('online',()=>{banner('');toast('You’re back online.');});
function handleVisibilityChange(){
  if(document.hidden){
    stopCamera();if(sheetType==='camera'&&$('#shutter')){const shutter=$('#shutter');shutter.disabled=false;shutter.dataset.action='camera';shutter.innerHTML=icon('camera')+'Reopen camera';}
    if(watch!==null){stopLocation({resume:true});banner('Location is paused while JiaYou is in the background.');}
  }else if(resumeLocationOnVisible){
    resumeLocationOnVisible=false;startLive({resume:true});
  }else updateMap();
}
document.addEventListener('visibilitychange',handleVisibilityChange);
setInterval(()=>{updateMap();refreshArrival();},15000);
document.querySelectorAll('[data-companion-slot]').forEach(el=>{el.innerHTML=companionMarkup({variant:el.dataset.companionSlot,oil:lightLevel(state),label:'Linda’s explorer'});});
const welcomeStamps=$('.welcome-stamps');if(welcomeStamps)welcomeStamps.innerHTML=[SEED_PLACES[3],SEED_PLACES[9],SEED_PLACES[7]].map(p=>stampMarkup(p,{size:'card'})).join('');
icons();renderFilters();startMap();showView(location.hash.slice(1)||'explore');appReady=true;autoConnect();

if('serviceWorker'in navigator&&location.protocol!=='file:')navigator.serviceWorker.register('./sw.js').catch(()=>toast('Offline mode could not start. The online app still works.'));

// The on-screen keyboard changes the visual viewport on iOS without always
// changing CSS viewport units. Keep the task footer inside the visible area.
function syncVisualViewport(){const viewport=window.visualViewport;document.documentElement.style.setProperty('--visual-height',`${viewport?.height||window.innerHeight}px`);document.documentElement.style.setProperty('--visual-top',`${viewport?.offsetTop||0}px`);}
window.visualViewport?.addEventListener('resize',syncVisualViewport);
window.visualViewport?.addEventListener('scroll',syncVisualViewport);
window.addEventListener('resize',syncVisualViewport);
syncVisualViewport();
