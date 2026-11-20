// Isolated macro compositions: same entry task, data, starting state and detail interaction.
// No geolocation, camera, service worker, account or storage APIs are used.
import {SEED_PLACES} from '../seed.mjs';
import {PLACE_MEDIA} from '../place-media.mjs';
import {distanceMeters} from '../core.mjs';
const params=new URLSearchParams(location.search),option=['a','b','c'].includes(params.get('option'))?params.get('option'):'a';
const names={a:'A · Map first',b:'B · Places first',c:'C · Collection first'};
const root=document.querySelector('#prototype');root.classList.add(`option-${option}`);
document.querySelector('#option-label').textContent=names[option];document.title=`JiaYou macro — ${names[option]}`;
document.querySelector(`.disclosure nav a[href="?option=${option}"]`).setAttribute('aria-current','page');
const ids=['node/2439950828','way/240091532','node/3726142013'];
const origin={lat:22.3365262,lng:114.2629606};
const places=ids.map(id=>SEED_PLACES.find(p=>p.id===id)).map(p=>({...p,distance:Math.round(distanceMeters(origin,p))}));
const categories={culture:'Museum',nature:'Nature',food:'Cafe'};
const icons={culture:'<path d="m3 7 9-5 9 5ZM3 21h18M6 10v8m6-8v8m6-8v8M3 9h18"/>',nature:'<path d="M19 4C7 3 3 6 5 14s14 8 14-10ZM5 21 15 10"/>',food:'<path d="M4 6h12v11H4zM16 7h2a4 4 0 0 1 0 8h-2M3 21h15"/>'};
const icon=category=>`<svg viewBox="0 0 24 24" aria-hidden="true">${icons[category]}</svg>`;
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let category='all',query='',activePlace=null,timer;
const map=L.map('map',{zoomControl:false,attributionControl:true,scrollWheelZoom:false,fadeAnimation:false,minZoom:13,maxZoom:19});map.attributionControl.setPrefix(false);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>'}).addTo(map);
const bounds=L.latLngBounds([...[origin],...places].map(p=>[p.lat,p.lng]));
function fit(){map.invalidateSize();map.fitBounds(bounds,{padding:[40,55],maxZoom:17});}
const markers=places.map(p=>({place:p,marker:L.marker([p.lat,p.lng],{title:p.name,icon:L.divIcon({className:`sample-pin ${p.category}`,html:`<span class="pin-shape">${icon(p.category)}</span>`,iconSize:[36,40],iconAnchor:[18,36]})}).addTo(map).bindTooltip(p.name,{permanent:true,direction:'right',offset:[10,-17],className:'place-name'}).on('click',()=>openPlace(p.id))}));
L.marker([origin.lat,origin.lng],{interactive:false,keyboard:false,icon:L.divIcon({className:'companion',html:'<img src="../assets/linda-character.svg" alt="Illustrative starting point">',iconSize:[54,67],iconAnchor:[27,56]})}).addTo(map);
const dialog=document.querySelector('#details'),body=document.querySelector('#detail-body');
function image(p){const media=PLACE_MEDIA[p.id];return media?`<img class="place-image" src="${escape(media.src.replace('./','../'))}" alt="${escape(media.alt)}">`:`<span class="place-image">${icon(p.category)}</span>`;}
function render(){
 const visible=places.filter(p=>(category==='all'||category===p.category)&&(!query||p.name.toLowerCase().includes(query)));
 document.querySelector('#place-list').innerHTML=visible.length?visible.map((p,i)=>`<button class="place-card ${i===0?'featured':''}" data-place="${p.id}">${image(p)}<span class="place-copy"><strong>${escape(p.name)}</strong><span class="place-meta">${p.distance} m · ${categories[p.category]}</span><span class="place-cue">${escape(PLACE_MEDIA[p.id]?.landmarkCue||'Look for the cafe sign. Public access is unverified.')}</span><span class="view-label">View place →</span></span></button>`).join(''):'<p class="empty">No sample places match. Clear the search or category.</p>';
 markers.forEach(({place,marker})=>visible.some(p=>p.id===place.id)?marker.addTo(map):map.removeLayer(marker));
}
function info(title,html){activePlace=null;body.innerHTML=`<h2 id="detail-title">${escape(title)}</h2>${html}`;dialog.showModal();}
function openPlace(id){
 const p=places.find(p=>p.id===id);if(!p)return;activePlace=p;const media=PLACE_MEDIA[p.id];
 body.innerHTML=`<h2 id="detail-title">${escape(p.id===ids[0]?'HKUST RED BIRD':p.name)}</h2>${media?`<figure><img src="${escape(media.src.replace('./','../'))}" alt="${escape(media.alt)}"><figcaption><a href="${escape(media.sourceUrl)}" target="_blank" rel="noopener">${escape(media.credit)}</a> · <a href="${escape(media.licenseUrl)}" target="_blank" rel="noopener">${escape(media.license)}</a> · reference photo, resized</figcaption></figure>`:''}<div class="detail-facts"><span>${p.distance} m</span><span>+30 light</span><span>1 stamp</span></div><p>${escape(p.description)}</p><p class="task">Task: ${escape(p.task)}</p><p>Entrance and floor: not mapped. Follow public-access signs.</p><button class="begin" data-action="begin">Begin Journey</button><p class="sample-note">Illustrative sample. This does not start GPS, route tracking or award a stamp.</p>`;
 if(!dialog.open)dialog.showModal();
}
function toast(message){const el=document.querySelector('#toast');el.textContent=message;el.hidden=false;clearTimeout(timer);timer=setTimeout(()=>el.hidden=true,4500);}
document.addEventListener('click',event=>{
 const filter=event.target.closest('[data-category]');if(filter){category=category===filter.dataset.category?'all':filter.dataset.category;document.querySelectorAll('[data-category]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.category===category)));render();return;}
 const place=event.target.closest('[data-place]');if(place){openPlace(place.dataset.place);return;}
 const action=event.target.closest('[data-action]')?.dataset.action;
 if(action==='close')dialog.close();
 if(action==='about')info('Same task, three compositions','<p>Choose a nearby place and inspect what to look for before beginning a journey.</p><p>Each alternative uses the same Red Bird, LG7 Lawn and Starbucks records, illustrative starting point, 45 light, 0/3 collection and detail actions. Only information priority and layout differ.</p><p>No GPS, camera, account or saved progress is used.</p>');
 if(action==='passport')info('Your first three places','<p>0 of 3 sample stamps. Visit three different places to complete a small collection in the working app.</p><p>This design sample does not save progress or validate arrival.</p>');
 if(action==='list'){document.querySelector('.places').classList.toggle('expanded');if(option!=='a')document.querySelector('#place-list').scrollIntoView({block:'nearest'});}
 if(action==='scan'){category='all';query='';document.querySelector('#search').value='';document.querySelectorAll('[data-category]').forEach(b=>b.setAttribute('aria-pressed','false'));render();fit();toast('Same three sample places shown. No live nearby search.');}
 if(action==='locate'){fit();toast('Returned to the illustrative starting point.');}
 if(action==='begin'){dialog.close();toast(`Selected ${activePlace?.name||'this place'}. In the working app, this begins a location-based walk.`);}
});
document.querySelector('#search').addEventListener('input',event=>{query=event.target.value.toLowerCase().trim();render();});
render();fit();window.addEventListener('resize',fit);
