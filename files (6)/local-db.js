/* local-db.js — brauzer xotirasida ishlaydigan zaxira baza.

   Sayt Claude ichida ochilsa, haqiqiy server bazasi ishlatiladi.
   O'z kompyuteringizda yoki oddiy hostingda ochilsa, shu fayl
   o'sha bazaning aynan o'zidek API beradi, lekin ma'lumotni
   localStorage da saqlaydi. Shuning uchun boshqa hech bir fayl
   qayerda ishlayotganini bilishi shart emas. */

const LS_DB   = 'eduportal.db.v1';
const LS_ME   = 'eduportal.me.v1';
const LS_SEED = 'eduportal.seeded.v1';

/* ── Xotira ────────────────────────────────────────── */
function loadAll(){
  try { return JSON.parse(localStorage.getItem(LS_DB)) || {}; }
  catch(e){ return {}; }
}
function saveAll(map){
  try { localStorage.setItem(LS_DB, JSON.stringify(map)); }
  catch(e){ console.warn('localStorage to\'ldi', e); }
}

const listeners = [];
function notify(){
  // Nusxa olamiz: tinglovchi ichida obuna bekor qilinishi mumkin.
  listeners.slice().forEach(l => { try { l(); } catch(e){ console.error(e); } });
}

// Boshqa tab/oynada o'zgarsa ham yangilanadi.
window.addEventListener('storage', e => { if(e.key === LS_DB) notify(); });

function snap(path, body){
  const id = path.split('/').pop();
  const frozen = body ? Object.freeze(JSON.parse(JSON.stringify(body))) : undefined;
  return { id, exists: !!body, data: () => frozen,
           metadata: { fromCache:false, hasPendingWrites:false } };
}

function qsnap(docs){
  return { docs, size: docs.length, empty: docs.length === 0,
           docChanges: () => docs.map((d,i) => ({ type:'added', doc:d, oldIndex:-1, newIndex:i })),
           metadata: { fromCache:false, hasPendingWrites:false } };
}

/* ── Hujjat ────────────────────────────────────────── */
function docRef(path){
  if(path.split('/').length % 2 !== 0) throw new TypeError('Hujjat yo\'li juft bo\'lishi kerak: '+path);
  return {
    id: path.split('/').pop(),
    path,
    async get(){ return snap(path, loadAll()[path]); },
    async set(data){
      const m = loadAll(); m[path] = JSON.parse(JSON.stringify(data)); saveAll(m); notify();
    },
    async update(data){
      const m = loadAll();
      if(!m[path]){ const e = new Error('yo\'q'); e.code = 'invalid_argument'; throw e; }
      m[path] = Object.assign({}, m[path], JSON.parse(JSON.stringify(data)));
      saveAll(m); notify();
    },
    async delete(){ const m = loadAll(); delete m[path]; saveAll(m); notify(); },
    async acquire(){ return { acquired:true, expiresAt:new Date(Date.now()+30000).toISOString() }; },
    onSnapshot(next){
      const fire = () => next(snap(path, loadAll()[path]));
      listeners.push(fire);
      setTimeout(fire, 0);
      return () => { const i = listeners.indexOf(fire); if(i >= 0) listeners.splice(i,1); };
    },
    collection(sub){ return collRef(path + '/' + sub); }
  };
}

/* ── Kolleksiya va so'rov ──────────────────────────── */
function matches(v, op, target){
  switch(op){
    case '==': return v === target;
    case '!=': return v !== target;
    case '<':  return v <  target;
    case '<=': return v <= target;
    case '>':  return v >  target;
    case '>=': return v >= target;
    case 'in': return Array.isArray(target) && target.indexOf(v) >= 0;
    case 'not-in': return Array.isArray(target) && target.indexOf(v) < 0;
    case 'array-contains': return Array.isArray(v) && v.indexOf(target) >= 0;
    default: return false;
  }
}

function collRef(path, filters, order, lim){
  if(path.split('/').length % 2 === 0) throw new TypeError('Kolleksiya yo\'li toq bo\'lishi kerak: '+path);
  filters = filters || []; 

  function run(){
    const m = loadAll();
    const depth = path.split('/').length + 1;
    let rows = Object.keys(m)
      .filter(k => k.indexOf(path + '/') === 0 && k.split('/').length === depth)
      .map(k => ({ path:k, body:m[k] }));

    filters.forEach(f => { rows = rows.filter(r => matches(r.body[f.field], f.op, f.value)); });

    if(order){
      const dir = order.dir === 'desc' ? -1 : 1;
      rows.sort((a,b) => {
        const x = a.body[order.field], y = b.body[order.field];
        if(x === undefined) return 1;
        if(y === undefined) return -1;
        return x > y ? dir : x < y ? -dir : 0;
      });
    } else {
      rows.sort((a,b) => a.path.localeCompare(b.path));
    }

    if(lim) rows = rows.slice(0, lim);
    return qsnap(rows.map(r => snap(r.path, r.body)));
  }

  const api = {
    path,
    where(field, op, value){ return collRef(path, filters.concat([{field,op,value}]), order, lim); },
    orderBy(field, dir){ return collRef(path, filters, {field,dir}, lim); },
    limit(n){ return collRef(path, filters, order, n); },
    async get(){ return run(); },
    onSnapshot(next){
      const fire = () => next(run());
      listeners.push(fire);
      setTimeout(fire, 0);
      return () => { const i = listeners.indexOf(fire); if(i >= 0) listeners.splice(i,1); };
    },
    doc(id){ return docRef(path + '/' + (id || newId())); },
    async add(data){ const r = docRef(path + '/' + newId()); await r.set(data); return r; }
  };
  return api;
}

function newId(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,8); }

const localDB = { doc: docRef, collection: collRef };

/* ── Foydalanuvchi ─────────────────────────────────── */
function loadMe(){
  let me;
  try { me = JSON.parse(localStorage.getItem(LS_ME)); } catch(e){}
  if(!me || !me.id){
    me = { id: 'local_' + newId(), name: '', role: 'admin' };
    localStorage.setItem(LS_ME, JSON.stringify(me));
  }
  return me;
}
function saveLocalMe(patch){
  const me = Object.assign(loadMe(), patch);
  localStorage.setItem(LS_ME, JSON.stringify(me));
  notify();
  return me;
}
function localRole(){ return loadMe().role; }

function clearLocal(){
  [LS_DB, LS_SEED].forEach(k => localStorage.removeItem(k));
}

function initialsAvatar(name, color){
  const ch = (name || '?').trim().charAt(0).toUpperCase();
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72">'+
    '<rect width="72" height="72" rx="20" fill="'+color+'"/>'+
    '<text x="36" y="48" font-family="sans-serif" font-size="32" font-weight="700" '+
    'fill="#fff" text-anchor="middle">'+ch+'</text></svg>';
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

const localUser = {
  async me(){
    const m = loadMe();
    return { id:m.id, name:m.name || '', avatarUrl: initialsAvatar(m.name, '#5b5bd6'),
             color:'#5b5bd6', email:null,
             isOwner: m.role === 'admin', canEdit: m.role === 'admin' };
  },
  async id(){ return loadMe().id; },
  async isOwner(){ return loadMe().role === 'admin'; },
  async canEdit(){ return loadMe().role === 'admin'; },
  async can(){ return true; },
  async profiles(ids){
    const m = loadMe(); const out = {};
    (Array.isArray(ids) ? ids : [ids]).forEach(i => {
      out[i] = { id:i, name: i === m.id ? (m.name||'') : '',
                 avatarUrl: initialsAvatar(i === m.id ? m.name : '?', '#8b95b0'),
                 color:'#8b95b0', email:null, isMe: i === m.id };
    });
    return out;
  },
  async search(){ return []; },
  async name(){ return loadMe().name || ''; }
};

/* ── Fayl yuklash (zaxira) ─────────────────────────── */
const localAssets = {
  async upload(file){
    if(file.size > 400*1024){
      const e = new Error('katta'); e.code = 'too_large'; throw e;
    }
    const url = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result); r.onerror = rej;
      r.readAsDataURL(file);
    });
    return { id:newId(), url, sizeBytes:file.size, contentType:file.type };
  },
  async list(){ return { assets:[], usage:{} }; },
  async delete(){ }
};

const localDownloads = {
  async save({ filename, data }){
    const blob = data instanceof Blob ? data : new Blob([data], { type:'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return { status:'saved' };
  }
};

/* ── Namuna ma'lumotlar ────────────────────────────── */
function seedIfEmpty(){
  if(localStorage.getItem(LS_SEED)) return false;
  localStorage.setItem(LS_SEED, '1');
  const m = loadAll();
  if(Object.keys(m).length) return false;

  const now = Date.now(), day = 86400000;
  const iso = d => new Date(now + d*day).toISOString().slice(0,10);

  m['meta/settings'] = {
    schoolName: "41-umumta'lim maktabi",
    quarter: "1-chorak",
    classes: ["9-A","9-B","9-V","9-G"],
    subjects: ["Matematika","Fizika","Informatika","Ona tili","Ingliz tili","Kimyo","Biologiya","Tarix"]
  };

  m['announcements/a1'] = { title: "CHSB imtihonlari yaqinlashmoqda",
    body: "Barcha o'quvchilar BSB ishlarini 20-sanagacha topshirishlari so'raladi.",
    createdAt: now - 2*3600000 };

  m['tasks/t1'] = { type:'bsb', title:"Matematika — 1-BSB", subject:"Matematika",
    about:"Algebraik tenglamalar va tengsizliklar", deadline: iso(5), maxScore:100, createdAt: now - 3*day };
  m['tasks/t2'] = { type:'bsb', title:"Fizika — 1-BSB", subject:"Fizika",
    about:"Kinematika va dinamika asoslari", deadline: iso(9), maxScore:100, createdAt: now - 2*day };
  m['tasks/t3'] = { type:'chsb', title:"1-chorak yakuniy nazorati", subject:"Informatika",
    about:"Algoritmlar, ma'lumot turlari va sikllar", deadline: iso(14), maxScore:100, createdAt: now - day };

  m['exams/e1'] = { title:"Informatika — qisqa test", subject:"Informatika", minutes:10, createdAt: now - day,
    questions:[
      { q:"HTML nimani belgilaydi?", options:["Sahifa tuzilmasini","Sahifa ranglarini","Server mantiqini"], answer:0 },
      { q:"CSS asosan nima uchun ishlatiladi?", options:["Ma'lumot saqlash","Ko'rinishni bezash","Tarmoqqa ulanish"], answer:1 },
      { q:"Massivning birinchi elementi indeksi qanday?", options:["1","0","-1"], answer:1 }
    ] };

  const demo = [
    ['s1',"Jasurbek Rahimov",'9-A',92,95,{Matematika:96,Fizika:88,Informatika:98,"Ona tili":90}],
    ['s2',"Nilufar Karimova",'9-A',88,91,{Matematika:90,Fizika:85,Informatika:93,"Ona tili":94}],
    ['s3',"Sardor Aliyev",'9-B',79,84,{Matematika:80,Fizika:76,Informatika:88,"Ona tili":82}],
    ['s4',"Malika To'rayeva",'9-B',85,80,{Matematika:84,Fizika:78,Informatika:86,"Ona tili":88}],
    ['s5',"Bekzod Yusupov",'9-V',71,68,{Matematika:70,Fizika:65,Informatika:75,"Ona tili":72}],
    ['s6',"Zilola Ergasheva",'9-V',66,74,{Matematika:68,Fizika:70,Informatika:78,"Ona tili":76}]
  ];
  demo.forEach(([id,name,cls,bsb,chsb,subjects], i) => {
    m['students/'+id] = { name, className:cls, joinedAt: now - (30-i)*day };
    m['grades/'+id]   = { bsb, chsb, subjects, updatedAt: now - i*day };
  });

  m['submissions/s3'] = { studentId:'s3', name:"Sardor Aliyev", className:'9-B', updatedAt: now - 5*3600000,
    items:[{ id:'q1', taskId:'t1', note:"Barcha misollarni ishladim, 7-masalada shubham bor.",
             link:'', image:'', at: now - 5*3600000, status:'pending', score:null, feedback:'' }] };

  saveAll(m);
  return true;
}
