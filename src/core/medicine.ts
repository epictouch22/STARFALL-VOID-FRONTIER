import type {Health,Wound,State} from './types';
import {consume,shipStats} from './state';
export function injure(h:Health,part:number,type:Wound,amount:number){const p=h.parts[part];p.health=Math.max(0,p.health-amount);p.wounds[type]=(p.wounds[type]??0)+amount;h.pain=Math.min(100,h.pain+amount*.5);}
export function treat(s:State,id:string,part:number){const h=s.health,p=h.parts[part];if(!p)return false;
 const valid=id==='bandage'?!!(p.wounds.cut||p.wounds.puncture):id==='splint'?!!p.wounds.fracture:id==='medkit'?p.health<100:id==='painkiller'?h.pain>0:id==='antirad'?h.radiation>0:id==='antidote'?h.parts.some(p=>p.wounds.toxin):id==='blood'?h.blood<100:id==='stimulant'?h.consciousness<100:false;
 if(!valid||!consume(s,id))return false;
 if(id==='bandage'){delete p.wounds.cut;delete p.wounds.puncture;}if(id==='splint')delete p.wounds.fracture;
 if(id==='medkit'){p.health=Math.min(100,p.health+65);delete p.wounds.burn;delete p.wounds.cold;delete p.wounds.bruise;delete p.wounds.radiation;delete p.wounds.suffocation;}
 if(id==='painkiller')h.pain=Math.max(0,h.pain-50);if(id==='blood')h.blood=Math.min(100,h.blood+40);if(id==='antirad'){h.radiation=Math.max(0,h.radiation-60);h.parts.forEach(p=>delete p.wounds.radiation);}if(id==='antidote')h.parts.forEach(p=>delete p.wounds.toxin);if(id==='stimulant')h.consciousness=Math.min(100,h.consciousness+65);return true;
}
export function medicalTick(s:State,dt:number){const h=s.health;const bleed=h.parts.reduce((n,p)=>n+(p.wounds.cut??0)+(p.wounds.puncture??0),0);h.blood=Math.max(0,h.blood-bleed*.002*dt);h.pain=Math.max(0,h.pain-dt*.03);h.hunger=Math.max(0,h.hunger-dt*.014);h.consciousness=Math.max(0,Math.min(100,Math.min(h.blood*1.7,h.oxygen*5)-h.pain*.15));
 if(h.radiation>30)h.parts[1].health=Math.max(0,h.parts[1].health-dt*h.radiation*.001);if(h.hunger===0)h.parts[1].health=Math.max(0,h.parts[1].health-dt*.05);
 const toxin=h.parts.reduce((n,p)=>n+(p.wounds.toxin??0),0);if(toxin)h.parts[1].health=Math.max(0,h.parts[1].health-toxin*dt*.002);
 if(h.oxygen<8){h.parts[0].health=Math.max(0,h.parts[0].health-dt*.5);h.parts[0].wounds.suffocation=(h.parts[0].wounds.suffocation??0)+dt*.1;}
 h.oxygen=Math.min(shipStats(s).oxygen,h.oxygen);
}
