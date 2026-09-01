import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../index.html", import.meta.url), "utf8");

function extractFunction(name){
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `La funzione ${name} deve esistere`);
  const brace = source.indexOf("{", start);
  let depth = 0;
  for(let i=brace;i<source.length;i++){
    if(source[i]==="{") depth++;
    if(source[i]==="}" && --depth===0) return source.slice(start,i+1);
  }
  throw new Error(`Chiusura non trovata per ${name}`);
}

function runMigration(name,db){
  let nextId = 0;
  let saves = 0;
  const context = {
    DB: db,
    uid: () => `${name}-${++nextId}`,
    save: () => { saves++; },
  };
  vm.runInNewContext(`${extractFunction(name)}; result=${name}();`, context);
  return { result:context.result, saves };
}

const ex = (name, sets, repsLow, repsHigh, rir, restSec, note, options={}) => ({
  name, note, sets, repsLow, repsHigh, rir, restSec,
  failLast:false, ss:options.ss||null, bilateral:!!options.bilateral,
});

const expectedV6Days = [
  {name:"A - Petto + spalle", focus:"Petto + spalle + braccia", exercises:[
    ex("Panca inclinata manubri (20-30°)",3,6,10,"2",150,"scapole stabili, discesa controllata; focus petto alto",{bilateral:true}),
    ex("Chest press convergente",3,8,12,"1-2",120,"spingi mantenendo il petto alto e senza perdere assetto"),
    ex("Croci ai cavi",2,12,15,"1",75,"gomiti morbidi, arco controllato e stretch senza forzare la spalla"),
    ex("Shoulder press macchina",3,8,12,"1-2",120,"schiena aderente allo schienale, traiettoria controllata"),
    ex("Alzate laterali ai cavi",3,12,20,"1",75,"guida il movimento col gomito, niente slancio"),
    ex("Curl bilanciere EZ",3,8,12,"1-2",0,"gomiti fermi e ROM completo",{ss:"armA"}),
    ex("Pushdown ai cavi (corda)",3,10,15,"1-2",90,"gomiti fermi, estensione completa",{ss:"armA"}),
  ]},
  {name:"B - Schiena", focus:"Schiena + deltoide posteriore + bicipiti", exercises:[
    ex("Lat machine presa neutra",3,6,10,"2",150,"petto alto, gomiti verso il basso"),
    ex("Rematore chest-supported",3,8,12,"1-2",120,"petto appoggiato, tira i gomiti indietro senza slancio"),
    ex("Rematore unilaterale al cavo",3,8,12,"1-2",90,"controlla la scapola e mantieni il busto stabile"),
    ex("Pullover machine / straight-arm pulldown",2,10,15,"1",75,"braccia quasi tese, movimento dalla spalla; focus gran dorsale"),
    ex("Reverse pec deck",3,12,20,"1",75,"deltoide posteriore, movimento controllato senza inarcare"),
    ex("Curl manubri su panca inclinata",3,8,12,"1-2",90,"spalla ferma, allungamento completo",{bilateral:true}),
    ex("Curl martello manubri",2,10,15,"1-2",75,"presa neutra, gomiti vicini al busto",{bilateral:true}),
  ]},
  {name:"C - Gambe + upper", focus:"Gambe complete + richiamo upper", exercises:[
    ex("Hack squat",3,6,10,"2",150,"ROM controllato, ginocchia in linea coi piedi"),
    ex("Romanian deadlift",3,8,10,"2",120,"anca indietro, schiena neutra, tensione sui femorali"),
    ex("Leg curl seduto",3,10,15,"1-2",90,"controlla bene eccentrica e chiusura"),
    ex("Leg extension",2,10,15,"1",75,"controllo completo, senza slancio"),
    ex("Calf raise",3,10,15,"1-2",75,"pausa in alto e stretch controllato in basso"),
    ex("Chest press macchina",3,8,12,"2",120,"richiamo petto senza arrivare al cedimento"),
    ex("High row / lat machine",3,8,12,"2",120,"richiamo schiena, tecnica pulita e volume moderato"),
  ]},
  {name:"D - Upper", focus:"Focus petto + spalle + braccia", exercises:[
    ex("Chest press plate-loaded / panca piana",3,6,10,"2",150,"scegli la variante più stabile e progressiva senza fastidi"),
    ex("Shoulder press macchina",3,6,10,"2",120,"spinta controllata, evita di perdere assetto"),
    ex("Lat machine presa media/larga",3,8,12,"1-2",120,"petto alto e gomiti verso il basso"),
    ex("Alzate laterali manubri",3,12,20,"1",75,"niente slancio, guida col gomito",{bilateral:true}),
    ex("Pec deck",2,10,15,"1",75,"chiusura controllata, tensione continua sul petto"),
    ex("Face pull",2,12,20,"1-2",75,"tira verso il viso con gomiti alti ma comodi"),
    ex("Curl al cavo",3,10,15,"1-2",0,"tensione continua e gomiti fermi",{ss:"armD"}),
    ex("Estensioni tricipiti overhead al cavo",3,10,15,"1-2",90,"gomiti stretti, allungamento del capo lungo",{ss:"armD"}),
  ]},
];

function withoutIds(days){
  return JSON.parse(JSON.stringify(Array.from(days,day=>({
    name:day.name,
    focus:day.focus,
    exercises:Array.from(day.exercises,({id,...exercise})=>exercise),
  }))));
}

test("V6 sostituisce solo la scheda e conserva tutti i dati storici",()=>{
  const sessions=[{id:"sessione-storica",entries:[{exId:"vecchio-id",name:"Vecchio esercizio"}]}];
  const bodyweight=[{date:"2026-08-31",kg:80}];
  const active={id:"sessione-attiva",entries:[{exId:"attivo-id",name:"Esercizio attivo"}]};
  const db={
    schema:{rotationIndex:3,days:[{id:"vecchio-giorno"}],customField:"resta"},
    sessions, bodyweight, active, migrations:{reorderV5:true}, extra:"resta",
  };

  const {result,saves}=runMigration("migrateWorkoutV6",db);

  assert.equal(result,1);
  assert.equal(saves,1);
  assert.equal(db.schema.rotationIndex,3);
  assert.equal(db.schema.customField,"resta");
  assert.strictEqual(db.sessions,sessions);
  assert.strictEqual(db.bodyweight,bodyweight);
  assert.strictEqual(db.active,active);
  assert.equal(db.extra,"resta");
  assert.equal(db.migrations.reorderV5,true);
  assert.equal(db.migrations.workoutV6,true);
  assert.deepEqual(withoutIds(db.schema.days),expectedV6Days);
  assert.equal(new Set(db.schema.days.flatMap(day=>[day.id,...day.exercises.map(e=>e.id)])).size,33);
});

test("V6 è idempotente e non sovrascrive una scheda già migrata",()=>{
  const customDays=[{id:"personalizzato",name:"Scheda personalizzata",focus:"",exercises:[]}];
  const db={schema:{rotationIndex:2,days:customDays},sessions:[],bodyweight:[],active:null,migrations:{workoutV6:true}};

  const {result,saves}=runMigration("migrateWorkoutV6",db);

  assert.equal(result,0);
  assert.equal(saves,0);
  assert.strictEqual(db.schema.days,customDays);
  assert.equal(db.schema.rotationIndex,2);
});

const expectedV7Days = [
  {name:"A - Petto + spalle", focus:"Petto + spalle + braccia", exercises:[
    ex("Panca inclinata manubri (20-30°)",3,6,10,"2",150,"scapole stabili, discesa controllata; focus petto alto",{bilateral:true}),
    ex("Chest press convergente",3,8,12,"1-2",120,"spingi mantenendo il petto alto e senza perdere assetto"),
    ex("Shoulder press macchina",3,8,12,"1-2",120,"schiena aderente allo schienale, traiettoria controllata"),
    ex("Croci ai cavi",2,12,15,"1",75,"gomiti morbidi, arco controllato e stretch senza forzare la spalla"),
    ex("Alzate laterali ai cavi",3,12,20,"1",75,"guida il movimento col gomito, niente slancio"),
    ex("Curl bilanciere EZ",3,8,12,"1-2",0,"gomiti fermi e ROM completo",{ss:"armA"}),
    ex("Pushdown ai cavi (corda)",3,10,15,"1-2",90,"gomiti fermi, estensione completa",{ss:"armA"}),
  ]},
  {name:"B - Schiena", focus:"Schiena + deltoide posteriore + bicipiti", exercises:[
    ex("Lat machine presa neutra",3,6,10,"2",150,"petto alto, gomiti verso il basso"),
    ex("Rematore chest-supported",3,8,12,"1-2",120,"petto appoggiato, tira i gomiti indietro senza slancio"),
    ex("Rematore unilaterale al cavo",3,8,12,"1-2",90,"controlla la scapola e mantieni il busto stabile"),
    ex("Pullover machine / straight-arm pulldown",2,10,15,"1",0,"braccia quasi tese, movimento dalla spalla; focus gran dorsale",{ss:"backB"}),
    ex("Reverse pec deck",3,12,20,"1",90,"deltoide posteriore, movimento controllato senza inarcare",{ss:"backB"}),
    ex("Curl manubri su panca inclinata",3,8,12,"1-2",90,"spalla ferma, allungamento completo",{bilateral:true}),
    ex("Curl martello manubri",2,10,15,"1-2",75,"presa neutra, gomiti vicini al busto",{bilateral:true}),
  ]},
  {name:"C - Gambe + upper", focus:"Gambe complete + richiamo upper", exercises:[
    ex("Hack squat",3,6,10,"2",150,"ROM controllato, ginocchia in linea coi piedi"),
    ex("Romanian deadlift",3,8,10,"2",120,"anca indietro, schiena neutra, tensione sui femorali"),
    ex("Leg curl seduto",3,10,15,"1-2",0,"controlla bene eccentrica e chiusura",{ss:"legsC"}),
    ex("Calf raise",3,10,15,"1-2",90,"pausa in alto e stretch controllato in basso",{ss:"legsC"}),
    ex("Chest press macchina",3,8,12,"2",120,"richiamo petto senza arrivare al cedimento"),
    ex("High row / lat machine",3,8,12,"2",120,"richiamo schiena, tecnica pulita e volume moderato"),
    ex("Leg extension",2,12,15,"1",75,"opzionale: eseguila se recuperi bene e la corsa della settimana non ha già affaticato molto le gambe"),
  ]},
  {name:"D - Upper", focus:"Focus petto + spalle + braccia", exercises:[
    ex("Chest press plate-loaded / panca piana",3,6,10,"2",150,"scegli la variante più stabile e progressiva senza fastidi"),
    ex("Shoulder press plate-loaded",3,6,10,"1-2",150,"movimento controllato, schiena stabile e progressione graduale dei carichi"),
    ex("Lat machine presa media/larga",3,8,12,"1-2",120,"petto alto e gomiti verso il basso"),
    ex("Alzate laterali manubri",3,12,20,"1",75,"niente slancio, guida col gomito",{bilateral:true}),
    ex("Pec deck",2,10,15,"1",75,"chiusura controllata, tensione continua sul petto"),
    ex("Face pull",2,12,20,"1-2",75,"tira verso il viso con gomiti alti ma comodi"),
    ex("Curl al cavo",3,10,15,"1-2",0,"tensione continua e gomiti fermi",{ss:"armD"}),
    ex("Estensioni tricipiti overhead al cavo",3,10,15,"1-2",90,"gomiti stretti, allungamento del capo lungo",{ss:"armD"}),
  ]},
];

test("V7 applica la scheda definitiva senza alterare dati e rotazione",()=>{
  const sessions=[{id:"sessione-storica",entries:[{exId:"vecchio-id",name:"Vecchio esercizio"}]}];
  const bodyweight=[{date:"2026-08-31",kg:80}];
  const active={id:"sessione-attiva",entries:[{exId:"attivo-id",name:"Esercizio attivo"}]};
  const db={
    schema:{rotationIndex:3,days:[{id:"giorno-v6"}],customField:"resta"},
    sessions, bodyweight, active, migrations:{workoutV6:true}, extra:"resta",
  };

  const {result,saves}=runMigration("migrateWorkoutV7",db);

  assert.equal(result,1);
  assert.equal(saves,1);
  assert.equal(db.schema.rotationIndex,3);
  assert.equal(db.schema.customField,"resta");
  assert.strictEqual(db.sessions,sessions);
  assert.strictEqual(db.bodyweight,bodyweight);
  assert.strictEqual(db.active,active);
  assert.equal(db.extra,"resta");
  assert.equal(db.migrations.workoutV6,true);
  assert.equal(db.migrations.workoutV7,true);
  assert.deepEqual(withoutIds(db.schema.days),expectedV7Days);
  const supersets=JSON.parse(JSON.stringify(Array.from(db.schema.days,day=>[...new Set(day.exercises.map(e=>e.ss).filter(Boolean))])));
  assert.deepEqual(supersets,[["armA"],["backB"],["legsC"],["armD"]]);
  assert.equal(new Set(db.schema.days.flatMap(day=>[day.id,...day.exercises.map(e=>e.id)])).size,33);
});

test("V7 è idempotente e conserva una scheda già migrata",()=>{
  const customDays=[{id:"personalizzato",name:"Scheda personalizzata",focus:"",exercises:[]}];
  const db={schema:{rotationIndex:1,days:customDays},sessions:[],bodyweight:[],active:null,migrations:{workoutV7:true}};

  const {result,saves}=runMigration("migrateWorkoutV7",db);

  assert.equal(result,0);
  assert.equal(saves,0);
  assert.strictEqual(db.schema.days,customDays);
  assert.equal(db.schema.rotationIndex,1);
});
