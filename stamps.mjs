// Original vector destination keepsakes. Seven scenes interpret the visual cues
// documented in place-media.mjs; the other designs are intentionally symbolic.
// No SVG definitions or IDs: repeated instances remain independent in one page.
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const text = (value, fallback = '', length = 120) => typeof value === 'string'
  ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, length) || fallback
  : fallback;
const hash = value => { let n = 2166136261; for (const c of value) { n ^= c.codePointAt(0); n = Math.imul(n, 16777619); } return n >>> 0; };
const palette = (ink, color, accent, paper, sky) => Object.freeze({ ink, color, accent, paper, sky });
const PALETTES = [
  palette('#234c52', '#729b8b', '#daaf60', '#f3f2dd', '#dbe9e1'),
  palette('#3c5844', '#a4b56e', '#dabd62', '#f5f2d9', '#e1e9d4'),
  palette('#49446b', '#8b93aa', '#d6a074', '#f6eedf', '#e5e4ee'),
  palette('#305a48', '#7a9f6d', '#c9a95c', '#f4f1d9', '#e6ebd4'),
  palette('#765039', '#c49163', '#8b9e73', '#faf0db', '#ebe7d4'),
  palette('#263f62', '#618b9c', '#e6be65', '#f3efd9', '#dbe8ea'),
  palette('#245c68', '#78a9ac', '#d5ab64', '#f6f2de', '#dceced'),
  palette('#245b59', '#48a29b', '#dc9d4b', '#f0f1db', '#dae9df'),
  palette('#354a58', '#7b9c9b', '#a6b96f', '#f0f0dc', '#dce9e8'),
  palette('#703b3b', '#c9584d', '#ceac64', '#f7eddb', '#e8ded5'),
  palette('#315648', '#638a70', '#c9a165', '#f4efdc', '#dce6d7'),
  palette('#78433d', '#bd6c59', '#cea15c', '#f7efdd', '#eaddce')
];
const SHAPES = Object.freeze({
  scallop: 'M120 15Q138 9 151 23Q172 16 182 34Q204 34 207 56Q228 65 220 85Q237 101 225 120Q237 141 222 157Q230 178 210 190Q210 212 188 215Q181 237 158 231Q143 250 122 239Q101 252 85 237Q62 244 54 224Q32 223 30 201Q10 190 18 168Q1 150 15 130Q2 110 17 92Q9 70 30 59Q32 37 55 36Q65 15 86 23Q101 8 120 15Z',
  arch: 'M27 243V103C27 48 67 15 120 15S213 48 213 103V243Z',
  ticket: 'M24 20H216V62Q198 68 216 78V176Q198 186 216 196V241H24V196Q42 186 24 176V78Q42 68 24 62Z',
  disc: 'M120 15C183 15 224 63 224 127S184 244 120 244S16 192 16 127S57 15 120 15Z',
  lozenge: 'M120 14C145 14 151 33 177 36C209 39 223 63 223 96V170C223 202 201 219 176 222C151 225 144 245 120 245S89 225 64 222C39 219 17 202 17 170V96C17 63 31 39 63 36C89 33 95 14 120 14Z',
  wave: 'M25 26Q48 14 72 26T120 26T168 26T215 26V233Q192 245 168 233T120 233T72 233T25 233Z',
  pennant: 'M22 18H218V216L120 246L22 216Z',
  octagon: 'M66 16H174L219 61V198L174 244H66L21 198V61Z',
  portal: 'M20 244V84C20 45 63 15 120 15S220 45 220 84V244H152V235H88V244Z',
  crest: 'M28 24Q74 31 120 14Q166 31 212 24V164C212 210 173 232 120 247C67 232 28 210 28 164Z',
  capsule: 'M65 16H175Q216 16 216 58V201Q216 243 175 243H65Q24 243 24 201V58Q24 16 65 16Z',
  postage: 'M28 18H212V30H222V43H212V56H222V69H212V82H222V95H212V108H222V121H212V134H222V147H212V160H222V173H212V186H222V199H212V212H222V225H212V242H28V225H18V212H28V199H18V186H28V173H18V160H28V147H18V134H28V121H18V108H28V95H18V82H28V69H18V56H28V43H18V30H28Z'
});
const known = (number, label, lines, motif, shape, basis) => Object.freeze({ number, label, lines, motif, shape, basis });
const KNOWN = Object.freeze({
  'way/135248210': known(1, 'Hang Hau Man Kuk Lane Park', ['Man Kuk Lane', 'Park'], 'pond-footbridge', 'scallop', 'photo-cue'),
  'way/127382876': known(2, 'Hang Hau Garden', ['Hang Hau', 'Garden'], 'garden-fans', 'arch', 'symbolic'),
  'way/28125713': known(3, 'Pui Shing Garden', ['Pui Shing', 'Garden'], 'garden-mosaic', 'ticket', 'symbolic'),
  'way/205651322': known(4, 'Tong Ming Street Park', ['Tong Ming', 'Street Park'], 'circular-terraces', 'disc', 'photo-cue'),
  'way/205639134': known(5, 'Tong Ming Street Sitting-out Area', ['Tong Ming', 'Sitting-out Area'], 'quiet-seat', 'lozenge', 'symbolic'),
  'way/311764682': known(6, 'Tseung Kwan O Waterfront Park', ['TKO Waterfront', 'Park'], 'waterfront-lights', 'wave', 'photo-cue'),
  'way/675488827': known(7, 'Tseung Kwan O South Waterfront Promenade', ['TKO South', 'Waterfront Promenade'], 'promenade-path', 'pennant', 'photo-cue'),
  'way/549773032': known(8, 'Tseung Kwan O South Park', ['TKO South', 'Park'], 'turquoise-wayfinder', 'octagon', 'photo-cue'),
  'way/240091532': known(9, 'LG7 Lawn Area', ['LG7 Lawn', 'HKUST'], 'curved-library', 'portal', 'photo-cue'),
  'node/2439950828': known(10, 'Red Bird', ['Red Bird', 'HKUST'], 'red-crescent', 'crest', 'photo-cue'),
  'node/3726142013': known(11, 'Starbucks', ['Starbucks', 'HKUST'], 'coffee-constellation', 'capsule', 'symbolic'),
  'way/1560841330': known(12, 'American Diner', ['American Diner', 'HKUST'], 'diner-table', 'postage', 'symbolic')
});
const LIVE_MOTIFS = Object.freeze({
  nature: ['wildflower', 'fern-frond', 'garden-stones'],
  culture: ['open-window', 'tile-rosette', 'gallery-arch'],
  views: ['sunrise-ridge', 'open-horizon', 'wind-lines'],
  food: ['ceramic-cup', 'tea-pot', 'table-setting']
});

/** A stable visual identity; `basis` distinguishes observed cues from symbols. */
export function stampIdentity(place = {}) {
  const p = place && typeof place === 'object' ? place : {};
  const id = text(p.id, '', 200);
  const category = Object.hasOwn(LIVE_MOTIFS, p.category) ? p.category : 'nature';
  const entry = Object.hasOwn(KNOWN, id) ? KNOWN[id] : null;
  const label = entry?.label || text(p.name, 'Little discovery');
  const key = id || `${category}:${label}`;
  const seed = hash(key);
  const osm = /^(node|way|relation)\/([1-9]\d{0,15})$/.exec(id);
  return Object.freeze({
    key,
    serial: osm ? `${osm[1][0].toUpperCase()}${osm[2]}` : `JY${seed.toString(36).toUpperCase().padStart(7, '0')}`,
    label,
    motif: entry?.motif || LIVE_MOTIFS[category][(seed >>> 8) % 3],
    shape: entry?.shape || Object.keys(SHAPES)[seed % 12],
    palette: PALETTES[entry ? entry.number - 1 : (seed >>> 16) % 12],
    basis: entry?.basis || 'symbolic'
  });
}

const line = (d, extra = '') => `<path d="${d}" fill="none" ${/\bstroke=/.test(extra) ? '' : 'stroke="var(--stamp-ink)"'} ${/\bstroke-width=/.test(extra) ? '' : 'stroke-width="2.4"'} stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
const fill = (d, color = 'color', extra = '') => `<path d="${d}" fill="var(--stamp-${color})" ${extra}/>`;
const circle = (x, y, r, color = 'accent', extra = '') => `<circle cx="${x}" cy="${y}" r="${r}" fill="var(--stamp-${color})" ${extra}/>`;
const star = (x, y, r = 5) => fill(`M${x} ${y-r}L${x+1.7} ${y-1.7}L${x+r} ${y}L${x+1.7} ${y+1.7}L${x} ${y+r}L${x-1.7} ${y+1.7}L${x-r} ${y}L${x-1.7} ${y-1.7}Z`, 'accent');
const ellipse = (x, y, rx, ry, color) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="var(--stamp-${color})"/>`;

function illustration(motif) {
  switch (motif) {
    case 'pond-footbridge': return `${ellipse(119,146,76,28,'sky')}${line('M52 149Q83 165 113 154M117 163Q148 169 179 152', 'opacity=".35"')}${fill('M52 134L65 123L83 126L88 139L70 144ZM161 151L171 139L190 142L196 153L179 160Z','color')}${fill('M63 117Q118 78 177 117V129Q119 94 63 129Z','paper')}${line('M63 117Q118 78 177 117M63 129Q119 94 177 129M70 113V135M93 102V124M119 98V119M145 102V124M171 113V135')}${line('M49 134V105M49 119Q32 109 38 101M49 113Q64 103 61 95M185 132V99M185 117Q199 107 195 99')}${circle(71,77,7,'accent')}`;
    case 'garden-fans': return `${fill('M58 164Q120 126 182 164L172 178H70Z','sky')}${line('M81 160L93 104M127 163L127 89M155 160L148 115')}${fill('M93 116C58 111 48 91 58 75L93 100L71 64C95 54 120 64 125 88Z','accent')}${fill('M127 111C99 94 105 67 123 61L130 88L142 59C166 68 172 91 151 106Z','color')}${fill('M149 132C124 121 131 103 145 97L150 118L164 98C184 113 178 131 162 136Z','color')}${line('M64 174Q116 147 176 172M93 116L93 100M127 111L130 88M149 132L150 118', 'opacity=".6"')}${circle(179,72,5,'accent')}`;
    case 'garden-mosaic': return `${fill('M57 69H183V174H57Z','sky')}${fill('M65 77H116V120H65ZM124 128H175V167H124Z','color')}${fill('M124 77H175V120H124ZM65 128H116V167H65Z','accent')}${line('M61 124H179M120 73V171M80 114Q99 96 80 84Q66 100 80 114ZM150 137Q134 153 150 163Q165 152 150 137Z')}${line('M136 98H163M149 85V111M77 145H104M90 132V159', 'opacity=".65"')}${fill('M108 73L120 61L132 73L120 85Z','ink')}`;
    case 'circular-terraces': return `${ellipse(120,131,79,47,'sky')}${ellipse(120,131,68,39,'accent')}${ellipse(120,131,56,32,'paper')}${ellipse(120,131,43,25,'color')}${line('M42 132C45 158 83 179 120 178C160 179 194 158 198 132M54 132Q120 175 186 132M64 116L51 107M91 103L85 89M147 103L155 89M176 116L189 108', 'opacity=".65"')}${fill('M52 98V73H73V96M83 89V61H98V86M152 87V66H169V94M178 99V77H188V105Z','color','opacity=".55"')}${circle(126,71,10,'accent')}${line('M118 76L126 68L134 76')}`;
    case 'quiet-seat': return `${circle(118,103,49,'sky')}${fill('M59 112Q57 77 83 64Q111 56 118 86Q133 57 157 69Q180 83 172 111Z','color')}${line('M78 107L87 81M153 110L151 87M65 162H183')}${fill('M75 133H169V145H75ZM78 113H166V126H78Z','accent')}${line('M78 120H166M83 145V166M160 145V166M92 112V135M152 112V135')}${fill('M47 169Q99 160 193 170L182 178H61Z','sky')}${star(184,77,5)}`;
    case 'waterfront-lights': return `${fill('M48 68H192V159H48Z','ink')}${circle(158,89,13,'paper')}${fill('M48 138L192 109V145L48 170Z','paper')}${fill('M48 151L192 126V145L48 174Z','color')}${line('M56 140L186 113M54 145L186 120M76 136V145M110 129V138M147 121V132M178 116V125', 'stroke="var(--stamp-accent)"')}${fill('M50 169L192 146V176H50Z','sky')}${line('M62 160L169 145M86 169L182 153', 'opacity=".45"')}${fill('M76 121H79V86H76ZM119 112H121V82H119ZM155 106H157V79H155Z','accent')}${circle(78,84,6,'accent')}${circle(120,80,4,'accent')}${circle(156,77,3,'accent')}${star(64,81,3)}`;
    case 'promenade-path': return `${circle(156,87,18,'accent')}${fill('M48 114Q111 103 192 113V145H48Z','sky')}${fill('M48 141Q108 119 153 119Q128 132 127 177H48Z','color')}${fill('M130 178Q116 141 164 118L177 117Q143 143 157 178Z','paper')}${fill('M157 178Q143 143 177 117L192 115V178Z','sky')}${line('M69 158V88L83 84M109 142V99L120 96M146 123V104L155 102')}${circle(84,84,4,'accent')}${circle(121,96,3,'accent')}${line('M167 147L188 143M169 160L189 156', 'opacity=".5"')}${fill('M43 178H197V182H43Z','ink')}`;
    case 'turquoise-wayfinder': return `${circle(124,110,57,'sky')}${fill('M46 175L181 153L198 176L62 188Z','accent','opacity=".5"')}${fill('M88 76H163V147H88Z','color')}${fill('M88 76H163V88H88Z','accent')}${fill('M96 94H153V138H96Z','paper')}${line('M104 102H143M104 108H132M104 130L114 120L124 125L144 114M101 147V171M151 147V165')}${circle(146,129,4,'accent')}${fill('M50 155Q43 129 62 111Q80 132 72 152Z','color')}${line('M61 155V128M172 151V111M172 132L185 120')}`;
    case 'curved-library': return `${fill('M46 174Q117 133 195 169L190 183H53Z','accent')}${fill('M52 89Q114 56 187 86V148Q119 117 52 151Z','color')}${fill('M60 92Q119 66 179 89V136Q119 113 60 139Z','sky')}${line('M62 107Q120 83 179 104M62 124Q120 100 179 121M79 85V132M103 77V125M128 76V123M154 81V126M53 151Q117 119 187 148')}${line('M77 169Q126 150 167 164', 'opacity=".6"')}${circle(185,64,8,'accent')}${fill('M47 157L62 150L67 169L51 172Z','paper')}`;
    case 'red-crescent': return `${circle(122,113,54,'sky')}${ellipse(119,167,66,15,'accent')}${ellipse(119,167,50,10,'paper')}${line('M58 169L78 165M120 178V171M179 167L160 165M82 158L92 161', 'opacity=".65"')}${fill('M142 64C100 57 70 84 73 117C76 145 107 156 136 144C113 146 96 130 98 111C100 91 119 80 142 81Z','color')}${fill('M121 79L145 59L134 91L119 136L110 151L113 114Z','color')}${line('M121 83L113 144', 'stroke="var(--stamp-paper)" stroke-width="1.5" opacity=".65"')}${fill('M113 151H126L131 163H108Z','ink')}${star(172,84,5)}`;
    case 'coffee-constellation': return `${circle(120,117,54,'sky')}${ellipse(117,167,56,9,'accent')}${fill('M79 102H152L145 151Q116 164 87 151Z','paper')}${line('M79 102H152L145 151Q116 164 87 151ZM152 110H163Q183 129 149 138M83 115Q115 126 149 115')}${fill('M102 126L123 120L139 130L123 144L104 138Z','color')}${line('M101 90C85 76 111 75 102 60M120 89C108 75 130 75 125 63M139 91C130 80 149 76 143 68')}${star(62,83,7)}${star(174,84,5)}${circle(175,148,3,'accent')}`;
    case 'diner-table': return `${fill('M47 125H194V176H47Z','sky')}${fill('M47 125H73V143H47ZM99 125H125V143H99ZM151 125H177V143H151ZM73 143H99V161H73ZM125 143H151V161H125ZM177 143H194V161H177ZM47 161H73V176H47ZM99 161H125V176H99ZM151 161H177V176H151Z','color','opacity=".6"')}${ellipse(112,129,48,17,'paper')}${ellipse(112,129,34,11,'accent')}${fill('M148 87H178L174 123H152Z','color')}${line('M164 88L171 64L181 60M69 107V76M63 76V92Q69 100 75 92V76M62 83H76M126 103V78Q143 78 139 105H126Z')}${circle(110,91,17,'accent')}${star(53,63,4)}`;
    case 'wildflower': return `${ellipse(120,170,64,10,'sky')}${line('M120 165V103M120 143Q83 148 77 128Q106 122 120 143M120 127Q148 130 161 110Q137 103 120 127')}${fill('M118 108C95 123 79 96 99 86C79 64 109 53 120 76C132 53 160 69 142 87C166 104 140 124 124 107Z','color')}${circle(121,91,12,'accent')}${star(177,78,4)}`;
    case 'fern-frond': return `${ellipse(120,171,63,9,'sky')}${line('M85 170Q125 122 147 68')}${fill('M96 156Q64 144 74 121Q98 127 104 145ZM111 137Q83 120 93 101Q117 109 119 124ZM125 117Q104 96 117 79Q136 90 132 104ZM137 95Q132 69 150 59Q162 82 147 91ZM104 146Q114 119 142 127Q138 150 104 154ZM120 124Q132 100 155 108Q152 128 120 132ZM136 103Q150 84 169 95Q163 114 136 110Z','color')}${circle(72,83,8,'accent')}`;
    case 'garden-stones': return `${ellipse(120,166,72,13,'sky')}${fill('M63 157Q56 137 87 130Q109 124 117 145L111 160ZM110 159Q106 134 132 127Q163 124 177 150L170 163Z','color')}${fill('M88 125Q88 106 116 101Q139 102 149 120L140 129H100Z','accent')}${line('M123 103V77M123 88Q103 84 101 68Q122 66 123 88M123 89Q146 84 148 67Q125 66 123 89M59 176Q119 185 182 175', 'opacity=".8"')}`;
    case 'open-window': return `${fill('M69 69H171V173H69Z','color')}${fill('M80 80H160V161H80Z','sky')}${circle(141,105,13,'accent')}${fill('M81 145L104 120L127 142L141 130L159 149V160H81Z','color')}${line('M119 78V163M78 118H161M60 174H180M69 70L49 86V170L69 159M171 70L191 86V170L171 159')}`;
    case 'tile-rosette': return `${fill('M54 68H186V179H54Z','sky')}${fill('M120 69L137 95L166 88L160 115L185 129L158 143L165 170L137 164L120 185L103 164L76 172L82 144L57 129L82 115L75 89L103 95Z','color')}${circle(120,128,31,'paper')}${fill('M120 102L127 120L146 128L127 136L120 154L112 136L94 128L112 120Z','accent')}${circle(120,128,5,'ink')}`;
    case 'gallery-arch': return `${fill('M62 174V106Q62 61 120 61Q178 61 178 106V174Z','color')}${fill('M81 174V107Q81 79 120 79Q159 79 159 107V174Z','sky')}${fill('M103 135L120 105L137 135L127 147H112Z','accent')}${fill('M97 153H143V171H97Z','paper')}${line('M54 175H186M69 103H80M160 103H172M89 78L96 87M149 80L143 88M120 63V78')}`;
    case 'sunrise-ridge': return `${circle(126,103,32,'accent')}${fill('M45 160L89 99L125 151L153 120L195 173H45Z','color')}${fill('M89 99L109 130L94 123L82 130L73 120Z','paper')}${line('M52 181H187M59 171H179M66 77L77 85M164 73L157 83M124 58V69')}`;
    case 'open-horizon': return `${circle(120,111,35,'accent')}${fill('M49 123H191V172H49Z','sky')}${fill('M49 132Q84 111 112 132T191 131V143Q154 155 119 143T49 145Z','color')}${line('M57 155Q89 144 117 157T184 156M65 169Q104 157 142 168M72 88Q81 78 90 88M156 83Q165 74 174 83')}`;
    case 'wind-lines': return `${fill('M57 165L109 114L133 144L158 117L187 171H57Z','color')}${circle(74,87,17,'accent')}${line('M78 104H142Q167 104 162 86Q157 74 145 82M108 119H177Q195 119 187 103M50 138H96M62 151H84M147 166H181')}${fill('M109 114L123 132L111 129L100 135Z','paper')}`;
    case 'ceramic-cup': return `${ellipse(119,165,66,12,'accent')}${fill('M71 101H155V143Q152 166 114 160Q75 163 71 137Z','color')}${ellipse(113,102,42,11,'paper')}${line('M155 110H168Q190 131 155 143M87 89C71 75 103 76 94 61M118 89C106 75 132 74 125 59M136 123Q123 134 107 123', 'stroke="var(--stamp-ink)"')}${star(175,78,5)}`;
    case 'tea-pot': return `${ellipse(120,169,67,10,'sky')}${fill('M84 106Q122 93 153 110L162 145Q146 168 104 159L78 134L58 101L78 110L90 126Z','color')}${fill('M88 102Q121 83 151 104Z','accent')}${circle(120,90,5,'ink')}${line('M153 113Q184 95 183 122Q183 143 161 142M110 77Q98 64 114 59M131 77Q118 64 136 57')}${circle(122,129,11,'paper')}`;
    case 'table-setting': return `${circle(120,125,51,'color')}${circle(120,125,41,'paper')}${circle(120,125,28,'accent')}${line('M52 84V173M44 84V104Q52 116 60 104V84M44 96H60M185 172V85Q170 91 173 125H185M106 125Q119 113 133 125M105 136Q119 145 134 135')}${star(171,64,5)}${circle(73,67,4,'accent')}`;
    default: return '';
  }
}

function labelLines(label) {
  const words = label.split(' '), lines = [''];
  for (const word of words) {
    const last = lines.length - 1;
    if (lines[last] && `${lines[last]} ${word}`.length > 21 && lines.length < 2) lines.push(word);
    else lines[last] += (lines[last] ? ' ' : '') + word;
  }
  return lines.map(line => line.length > 25 ? `${line.slice(0, 24)}…` : line);
}

/**
 * Return inert HTML/SVG. `animate` is a one-shot collection response, never idle
 * motion. Pin artwork omits microtype; its accessible name keeps the full place.
 */
export function stampMarkup(place, options = {}) {
  const { size: requestedSize = 'card', collected = false, animate = false } = options || {};
  const size = ['pin', 'card', 'hero'].includes(requestedSize) ? requestedSize : 'card';
  const identity = stampIdentity(place);
  const entry = KNOWN[identity.key];
  const lines = entry?.lines || labelLines(identity.label);
  const printPalette = {ink:'#745c49',color:'#f8f4ee',accent:'#e9dfd1',paper:'#ffffff',sky:'#fbf9f5'};
  const colors = Object.entries(printPalette).map(([key, value]) => `--stamp-${key}:${value}`).join(';');
  const state = collected === true;
  const play = animate === true && size !== 'pin';
  const accessible = `${identity.label}. ${state ? 'Collected stamp' : 'Destination stamp'}.${identity.basis === 'symbolic' ? ' Symbolic illustration.' : ''}`;
  // Shared postage framing is a rendering choice; the saved identity remains intact.
  const edge = ['M20 18'];
  for (let x=26;x<=206;x+=20) edge.push(`H${x}a5 5 0 0 0 10 0`);
  edge.push('H220V24');
  for (let y=24;y<=224;y+=20) edge.push(`V${y}a5 5 0 0 0 0 10`);
  edge.push('V242H214');
  for (let x=214;x>=34;x-=20) edge.push(`H${x}a5 5 0 0 0 -10 0`);
  edge.push('H20V236');
  for (let y=236;y>=36;y-=20) edge.push(`V${y}a5 5 0 0 0 0 -10`);
  edge.push('V18Z');
  const shape = edge.join('');
  const artwork = illustration(identity.motif).replaceAll('fill="var(--stamp-ink)"', 'fill="var(--stamp-paper)"');
  const type = lines.map((label, index) => `<text x="120" y="${lines.length === 1 ? 211 : 201 + index * 15}" text-anchor="middle" font-size="${label.length > 22 ? 10 : label.length > 18 ? 11 : 13}" font-weight="400">${escape(label)}</text>`).join('');
  return `<span class="destination-stamp destination-stamp--${size}" data-stamp-motif="${identity.motif}" data-collected="${state}" data-animate="${play}" role="img" aria-label="${escape(accessible)}" style="${colors}"><svg viewBox="0 0 240 260" width="240" height="260" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg"><g class="stamp__print"><path d="${shape}" fill="var(--stamp-paper)" stroke="var(--stamp-ink)" stroke-width=".65"/><rect x="36" y="34" width="168" height="192" fill="none" stroke="var(--stamp-ink)" stroke-width=".8"/><g class="stamp__ink"><g class="stamp__small-type" fill="var(--stamp-ink)" font-family="Georgia,Times New Roman,serif"><text x="120" y="48" text-anchor="middle" font-size="8" letter-spacing="1.7" font-weight="400">JIAYOU</text></g><g class="stamp__art" stroke="var(--stamp-ink)" stroke-width="1.1" stroke-linejoin="round">${artwork}</g><path d="M87 187H153" fill="none" stroke="var(--stamp-ink)" stroke-width=".8" opacity=".45"/><g class="stamp__small-type" fill="var(--stamp-ink)" font-family="Georgia,Times New Roman,serif">${type}<text x="120" y="234" text-anchor="middle" font-size="6.5" letter-spacing=".7" font-weight="400">${escape(identity.serial)}</text></g></g><g class="stamp__collected-mark" opacity="${state ? 1 : 0}"><circle cx="183" cy="48" r="7" fill="var(--stamp-ink)"/><path d="M179 48L182 51L187 45" fill="none" stroke="var(--stamp-paper)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g></g></svg><i class="stamp__spark stamp__spark--one" aria-hidden="true"></i><i class="stamp__spark stamp__spark--two" aria-hidden="true"></i><i class="stamp__spark stamp__spark--three" aria-hidden="true"></i></span>`;
}
