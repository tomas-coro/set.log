import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../index.html", import.meta.url), "utf8");

function extractFunction(name){
  const start=source.indexOf(`function ${name}(`);
  assert.notEqual(start,-1,`${name} deve esistere`);
  const brace=source.indexOf("{",start);
  let depth=0;
  for(let i=brace;i<source.length;i++){
    if(source[i]==="{") depth++;
    if(source[i]==="}" && --depth===0) return source.slice(start,i+1);
  }
  throw new Error(`Chiusura non trovata per ${name}`);
}

function schema(){
  const context={};
  vm.runInNewContext(`${extractFunction("defaultSchema")}; result=defaultSchema();`,context);
  return context.result;
}

function migrate(db){
  let saves=0;
  const context={DB:db,save:()=>saves++};
  vm.runInNewContext(`${extractFunction("defaultSchema")}; ${extractFunction("migrateAnteriorPosteriorV8")}; result=migrateAnteriorPosteriorV8();`,context);
  return {result:context.result,saves};
}

const expectedDays = [
  ["A - Anterior A","Petto + spalle + quadricipiti + tricipiti",[
    ["Incline press macchina",3,8,10,"1-2",150], ["Hack squat",3,8,10,"2",150],
    ["Pec fly / pectoral machine",4,10,15,"1",90], ["Shoulder press macchina",3,8,10,"1-2",150],
    ["Alzate laterali",3,12,20,"1",90], ["Pushdown tricipiti",3,10,15,"1-2",90],
  ]],
  ["B - Posterior A","Schiena + catena posteriore + deltoide posteriore + bicipiti",[
    ["Lat machine frontale",3,8,10,"1-2",150], ["High row / tirata sagittale gomiti stretti",3,8,10,"1-2",150],
    ["Romanian deadlift",3,8,10,"2",150], ["Reverse pec deck",3,12,20,"1",90],
    ["Preacher curl",3,8,12,"1-2",90],
  ]],
  ["C - Anterior B","Petto + spalle + quadricipiti + tricipiti + abduttori",[
    ["Incline press macchina",3,8,10,"1-2",150], ["Leg extension",3,10,15,"1-2",90],
    ["Croci low-to-high",4,10,15,"1",90], ["Shoulder press macchina / plate-loaded",3,8,10,"1-2",150],
    ["Alzate laterali",3,12,20,"1",90], ["Overhead triceps extension",3,10,15,"1-2",90],
    ["Abductor machine",2,12,20,"1-2",75],
  ]],
  ["D - Posterior B","Schiena + femorali + deltoide posteriore + bicipiti + polpacci",[
    ["Lat machine frontale",3,8,10,"1-2",150], ["Remata chest-supported gomiti larghi",3,8,10,"1-2",150],
    ["Leg curl seduto",3,10,15,"1-2",90], ["Reverse pec deck",3,12,20,"1",90],
    ["Hammer curl",3,8,12,"1-2",90], ["Calf raise",3,10,15,"1-2",90],
  ]],
];

function compact(days){
  return JSON.parse(JSON.stringify(Array.from(days,day=>[
    day.name,day.focus,Array.from(day.exercises,e=>[e.name,e.sets,e.repsLow,e.repsHigh,e.rir,e.restSec]),
  ])));
}

test("nuova installazione usa la split definitiva A-B-C-D",()=>{
  const value=schema();
  assert.equal(value.rotationIndex,0);
  assert.deepEqual(compact(value.days),expectedDays);
  assert.ok(value.days.flatMap(d=>d.exercises).every(e=>e.bilateral===true && e.ss===null && e.failLast===false));
  assert.equal(new Set(value.days.flatMap(d=>[d.id,...d.exercises.map(e=>e.id)])).size,28);
  assert.equal(value.days.flatMap(d=>d.exercises).some(e=>/dip|trazion|pullover|face pull/i.test(e.name)),false);
  assert.deepEqual(Array.from({length:6},(_,i)=>value.days[i%value.days.length].name),[
    "A - Anterior A","B - Posterior A","C - Anterior B","D - Posterior B","A - Anterior A","B - Posterior A",
  ]);
});

test("V8 sostituisce solo i giorni e preserva dati, sessione attiva, rotazione ed exId compatibili",()=>{
  const sessions=[{id:"storica",entries:[{exId:"hack-id",name:"Hack squat",sets:[{kg:"100",reps:"8"}]}]}];
  const bodyweight=[{date:"2026-01-01",kg:80}];
  const active={id:"attiva",dayId:"old-c",entries:[{exId:"active-id",name:"Esercizio già iniziato",sets:[]} ]};
  const settings={theme:"dark",sound:false};
  const db={
    schema:{rotationIndex:2,customField:"resta",days:[
      {id:"old-a",exercises:[{id:"pushdown-id",name:"Pushdown ai cavi (corda)"}]},
      {id:"old-b",exercises:[{id:"reverse-id",name:"Reverse pec deck"},{id:"rdl-id",name:"Romanian deadlift"}]},
      {id:"old-c",exercises:[{id:"hack-id",name:"Hack squat"},{id:"leg-extension-id",name:"Leg extension"}]},
      {id:"old-d",exercises:[{id:"hammer-id",name:"Curl martello manubri"},{id:"calf-id",name:"Calf raise"}]},
    ]},
    sessions,bodyweight,active,settings,otherLocalData:{keep:true},migrations:{workoutV7:true},
  };
  const activeBefore=JSON.stringify(active);
  const {result,saves}=migrate(db);

  assert.equal(result,1);
  assert.equal(saves,1);
  assert.deepEqual(compact(db.schema.days),expectedDays);
  assert.equal(db.schema.rotationIndex,2);
  assert.equal(db.schema.customField,"resta");
  assert.equal(JSON.stringify(db.schema.days.map(d=>d.id)),JSON.stringify(["old-a","old-b","old-c","old-d"]));
  assert.equal(db.schema.days[0].exercises.find(e=>e.name==="Pushdown tricipiti").id,"pushdown-id");
  assert.equal(db.schema.days[0].exercises.find(e=>e.name==="Hack squat").id,"hack-id");
  assert.equal(db.schema.days[1].exercises.find(e=>e.name==="Romanian deadlift").id,"rdl-id");
  assert.equal(db.schema.days[1].exercises.find(e=>e.name==="Reverse pec deck").id,"reverse-id");
  assert.equal(db.schema.days[2].exercises.find(e=>e.name==="Leg extension").id,"leg-extension-id");
  assert.equal(db.schema.days[3].exercises.find(e=>e.name==="Hammer curl").id,"hammer-id");
  assert.equal(db.schema.days[3].exercises.find(e=>e.name==="Calf raise").id,"calf-id");
  assert.strictEqual(db.sessions,sessions);
  assert.strictEqual(db.bodyweight,bodyweight);
  assert.strictEqual(db.active,active);
  assert.equal(JSON.stringify(db.active),activeBefore);
  assert.strictEqual(db.settings,settings);
  assert.deepEqual(db.otherLocalData,{keep:true});
  assert.equal(db.migrations.workoutV7,true);
  assert.equal(db.migrations.anteriorPosteriorV8,true);
  assert.equal(db.schema.days[db.schema.rotationIndex].name,"C - Anterior B");
  assert.equal((db.schema.days.findIndex(d=>d.id===db.active.dayId)+1)%4,3);
});

test("V8 è idempotente",()=>{
  const db={schema:schema(),sessions:[],bodyweight:[],active:null,migrations:{anteriorPosteriorV8:true}};
  const days=db.schema.days;
  const {result,saves}=migrate(db);
  assert.equal(result,0);
  assert.equal(saves,0);
  assert.strictEqual(db.schema.days,days);
});
