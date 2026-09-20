import type { AppData, Company, Demand, HoursEntry, Leave, Offer, RosterEntry, StandingAssignment, Vacancy, VacancyPlace, Worker } from './types'

const names=['Sofia van der Meer','Mohamed El Amrani','Charlotte de Vries','Jeroen Bakker','Aisha Benali','Lars de Jong','Fatima El Idrissi','Noah Smit','Yara van Dijk','Bram Visser','Nora de Boer','Omar Ait Said','Emma Jansen','Rayan Haddad','Lisa van Leeuwen','Daan Meijer','Sara El Khattabi','Milan Bos','Julia Prins','Ibrahim Kaya','Fleur Willems','Bilal Boulahrouz','Anna de Graaf','Sem Hendriks','Maryam Amrani','Thijs van Dam','Aya El Mansouri','Niels Kuiper','Lina Bekkali','Pim Verhoeven','Hanae Chafai','Koen Mulder','Zoë Scholten','Youssef Rahmani','Sanne Kramer','Adam Najib','Maud van Vliet','Ismail Azzouzi','Roos Dekker','Karim Ben Youssef','Evi van Rijn','Hicham Fassi','Tess de Wit','Rik van den Berg','Imane El Ouahabi']
const cities=['Rotterdam','Amsterdam','Den Haag','Tilburg','Utrecht','Zaandam','Nootdorp']
const postcodes=['3024 AB','1012 JS','2511 BV','5038 EA','3511 CE','1506 PT','2631 GK']
const coords:[number,number][]=[[51.92,4.47],[52.37,4.90],[52.08,4.31],[51.56,5.08],[52.09,5.12],[52.44,4.83],[52.04,4.40]]
const companyIds=['c-dhl','c-ah','c-postnl','c-ikea','c-mojo','c-klm']
/* NB: `hasCar` runs on a period of 5 deliberately. Company admission below is
   built on i%6 and the Vebego rule on i%3, so any car rule sharing those
   periods lands whole client pools on one side of it: with i%3!==2 every
   Vebego candidate was a driver and the "with car" filter could never remove
   anybody, and with i%3!==1 nobody in the DHL pool lacked a car, so the
   car-only block had nothing to block. 5 is coprime with both, which mixes
   drivers through every pool the way reality does. */
const makeWorker=(name:string,i:number):Worker=>{const [first,...rest]=name.split(' '); const last=rest.pop()!; const insertion=rest.join(' ')||null; const coord=coords[i%coords.length]; const dismissed=i>=40; return {id:`w-${String(i+1).padStart(2,'0')}`,flexpediaId:1000+i,manatalCandidateId:i===6?null:2000+i,initials:`${first[0]}${last[0]}`,firstName:first,insertion,lastName:last,fullName:name,gender:i%2?'f':'m',birthDate:`${1985+i%12}-0${i%9+1}-1${i%8+1}`,street:['Mathenesserdijk','Wibautstraat','Spui','Besterdring','Oudegracht','Westzijde','Dorpsstraat'][i%7],streetNumber:String(10+i),streetNumberAddition:i%4===0?'A':null,postCode:postcodes[i%postcodes.length],city:cities[i%cities.length],residenceCountry:'NL',nationality:i%7===0?'MA':'NL',phone:'+31 10 123 45 67',phoneCountry:'NL',mobile:`+31 6 ${String(18000000+i*731).slice(0,8)}`,email:`${first.toLowerCase()}.${last.toLowerCase().replace(' ','')}@example.nl`,lat:i%13===0?null:coord[0]+((i*37%29)-14)*.0022,lon:i%13===0?null:coord[1]+((i*53%31)-15)*.0034,geocodedAt:i%13===0?null:'2024-06-01T10:00:00Z',notes:i%6===0?'Prefers morning shifts.':'',hasCar:i%5!==0&&i%5!==3,hasVog:i%4!==1,courseDays:i%7===2?['wed' as const]:i%7===5?['mon' as const,'thu' as const]:[],status:dismissed?'dismissed':'active',dismissedAt:dismissed?`2024-06-${String(3+i%9).padStart(2,'0')}`:null,companyAccess:[companyIds[i%6],companyIds[(i+1)%6],...(i%3===0?[companyIds[(i+2)%6]]:[]),...(i%3!==2?['c-vebego']:[])],manatalLink:i===6?'not_found':i===9?'ambiguous':'linked',cvUrl:i===6||i===9?null:`https://example.com/cv/${i+1}`} }
export const workers=names.map(makeWorker)
export const companies:Company[]=[{id:'c-vebego',name:'Vebego',contactPerson:'Rik de Boer',phone:'+31 20 555 0142',notes:'Sends a weekly hours file per site',logoUrl:null},{id:'c-dhl',name:'DHL Supply Chain',contactPerson:'Eva Jansen',phone:'+31 20 555 0190',notes:'Rotterdam and Tilburg sites',logoUrl:'/logos/dhl.svg'},{id:'c-ah',name:'Albert Heijn',contactPerson:'Mark de Wit',phone:'+31 30 555 0102',notes:null,logoUrl:'/logos/ah.svg'},{id:'c-postnl',name:'PostNL',contactPerson:'Lotte Smit',phone:'+31 88 225 5555',notes:'Night sorting shifts',logoUrl:null},{id:'c-ikea',name:'IKEA',contactPerson:'Tom Bakker',phone:'+31 20 555 0303',notes:null,logoUrl:null},{id:'c-mojo',name:'MOJO',contactPerson:'Nina Vos',phone:'+31 70 555 0404',notes:'Event crew',logoUrl:'/logos/mojo.svg'},{id:'c-klm',name:'KLM Catering',contactPerson:'Said Amrani',phone:'+31 20 555 0505',notes:null,logoUrl:null}]
export const vacancies:Vacancy[]=[{id:'v-dhl-inbound',title:'Inbound warehouse team',companyId:'c-dhl',address:'Achtseweg Noord 15, Tilburg',lat:51.56,lon:5.08,description:'Inbound scanning and unloading team.',startDate:'2024-06-10',endDate:null,trackHoursManually:true,schedule:{weekdays:['mon','tue','wed','thu','fri'],start:{kind:'fixed',time:'08:00'},end:{kind:'fixed',time:'16:30'},headcount:{kind:'fixed',count:1},horizon:'week'},places:[],carOnly:false,defaultHours:8,projectCode:null},{id:'v-ah-evening',title:'Evening replenishment',companyId:'c-ah',address:'Coolsingel 60, Rotterdam',lat:51.92,lon:4.48,description:'Evening store replenishment.',startDate:'2024-06-17',endDate:'2024-06-30',trackHoursManually:false,schedule:{weekdays:['mon','tue','wed','thu','fri'],start:{kind:'fixed',time:'08:00'},end:{kind:'fixed',time:'16:30'},headcount:{kind:'fixed',count:1},horizon:'week'},places:[],carOnly:false,defaultHours:8,projectCode:null},{id:'v-postnl-sort',title:'Parcel sorting crew',companyId:'c-postnl',address:'Surgatstraat 1, Rotterdam',lat:51.90,lon:4.43,description:'Parcel sorting and dispatch.',startDate:'2024-06-01',endDate:'2024-06-16',trackHoursManually:true,schedule:{weekdays:['mon','tue','wed','thu','fri'],start:{kind:'fixed',time:'08:00'},end:{kind:'fixed',time:'16:30'},headcount:{kind:'fixed',count:1},horizon:'week'},places:[],carOnly:false,defaultHours:8,projectCode:null},{id:'v-ikea-logistics',title:'Logistics support',companyId:'c-ikea',address:'Olof Palmeplein 1, Utrecht',lat:52.09,lon:5.04,description:'Back-of-house logistics.',startDate:'2024-06-20',endDate:null,trackHoursManually:true,schedule:{weekdays:['mon','tue','wed','thu','fri'],start:{kind:'fixed',time:'08:00'},end:{kind:'fixed',time:'16:30'},headcount:{kind:'fixed',count:1},horizon:'week'},places:[],carOnly:false,defaultHours:8,projectCode:null},{id:'v-mojo-events',title:'Event operations',companyId:'c-mojo',address:'Piet Heinkade 3, Amsterdam',lat:52.38,lon:4.91,description:'Event setup and guest operations.',startDate:'2024-06-14',endDate:'2024-06-22',trackHoursManually:false,schedule:{weekdays:['mon','tue','wed','thu','fri'],start:{kind:'fixed',time:'08:00'},end:{kind:'fixed',time:'16:30'},headcount:{kind:'fixed',count:1},horizon:'week'},places:[],carOnly:false,defaultHours:8,projectCode:null},{id:'v-klm-open',title:'Catering prep team',companyId:'c-klm',address:'Schiphol Boulevard, Amsterdam',lat:52.31,lon:4.77,description:'Kitchen prep and catering logistics. No clock on this one — the day records who was there.',startDate:'2024-06-24',endDate:null,trackHoursManually:false,schedule:{weekdays:['mon','tue','wed','thu','fri'],start:{kind:'none'},end:{kind:'open'},headcount:{kind:'fixed',count:1},horizon:'week'},places:[],carOnly:false,defaultHours:8,projectCode:null},{id:'v-dhl-open',title:'DHL weekend flex pool',companyId:'c-dhl',address:'Eemhavenweg 1, Rotterdam',lat:51.89,lon:4.43,description:'Flexible weekend pool.',startDate:'2024-07-01',endDate:null,trackHoursManually:false,schedule:{weekdays:['mon','tue','wed','thu','fri'],start:{kind:'fixed',time:'08:00'},end:{kind:'fixed',time:'16:30'},headcount:{kind:'fixed',count:1},horizon:'week'},places:[],carOnly:false,defaultHours:8,projectCode:null},{id:'v-ah-roster',title:'Distribution roster',companyId:'c-ah',address:'Polderweg 1, Zaandam',lat:52.44,lon:4.83,description:'Daily rostered distribution shifts.',startDate:'2024-06-17',endDate:'2024-06-25',trackHoursManually:true,schedule:{weekdays:['mon','tue','wed','thu','fri'],start:{kind:'fixed',time:'08:00'},end:{kind:'fixed',time:'16:30'},headcount:{kind:'fixed',count:1},horizon:'week'},places:[],carOnly:false,defaultHours:8,projectCode:null},
  /* Ziggo Dome, through Vebego. Any weekday and both weekend days can be a
     working day and there is no fixed count of them, so the pattern carries NO
     default weekdays at all — the client's own table decides, and we mirror it.
     Each working day gets its own start from a short list; the end is open
     because people leave when the tasks are finished. Headcount is set per day
     by the site and is usually five. */
  {id:'v-ziggo',title:'Ziggo Dome — event crew',companyId:'c-vebego',address:'De Passage 100, Amsterdam',lat:52.3128,lon:4.9450,description:'Cleaning and turnaround crew around events. The site publishes its own weekly table; we mirror it to know who is where.',startDate:'2024-01-08',endDate:null,trackHoursManually:false,schedule:{weekdays:[],start:{kind:'perDate',options:['05:30','06:30','07:30','08:30']},end:{kind:'open'},headcount:{kind:'perDate',typical:5},horizon:'week'},places:[],carOnly:false,defaultHours:8,projectCode:null},
  /* The warehouse. Monday to Friday, weekends once or twice a year, so they
     are an exception on a date rather than part of the pattern. Hours never
     move (overtime extends the end, and once in a blue moon the start is
     pulled an hour earlier — again a per-date exception). Headcount differs
     every single day and is spread across halls and their departments, which
     is why it is perDate with a typical value rather than a fixed number.
     This is the one client whose hours we count ourselves. */
  {id:'v-warehouse',title:'Warehouse — Slego & Conakry',companyId:'c-dhl',address:'Distributieweg 40, Delfgauw',lat:52.0010,lon:4.3830,description:'Daily picking and sorting across both halls. We plan the people and enter the hours.',startDate:'2024-01-02',endDate:null,trackHoursManually:true,schedule:{weekdays:['mon','tue','wed','thu','fri'],start:{kind:'fixed',time:'07:00'},end:{kind:'fixed',time:'16:00'},headcount:{kind:'perDate',typical:4},horizon:'day'},places:[{id:'p-slego',name:'Slego'},{id:'p-conakry',name:'Conakryweg'}],carOnly:true,defaultHours:8,projectCode:'ALWct'},
  /* A short evening job, to show the same pattern covering two hours a day. */
  /* The case the colours exist for: the client asked for a night crew, the
     job started on Friday and nobody has been put on it. */
  {id:'v-postnl-night',title:'Night sorting — extra crew',companyId:'c-postnl',address:'Siriusdreef 2, Hoofddorp',lat:52.3060,lon:4.6890,description:'Extra hands on the night sort, asked for at short notice.',startDate:'2024-06-14',endDate:null,trackHoursManually:true,schedule:{weekdays:['mon','tue','wed','thu','fri'],start:{kind:'fixed',time:'22:00'},end:{kind:'fixed',time:'06:00'},headcount:{kind:'fixed',count:3},horizon:'week'},places:[],carOnly:true,defaultHours:8,projectCode:null},
  {id:'v-evening-clean',title:'Office evening clean',companyId:'c-vebego',address:'Weena 505, Rotterdam',lat:51.9240,lon:4.4700,description:'Two hours after office close.',startDate:'2024-06-03',endDate:null,trackHoursManually:false,schedule:{weekdays:['mon','wed','fri'],start:{kind:'fixed',time:'18:00'},end:{kind:'fixed',time:'20:00'},headcount:{kind:'fixed',count:2},horizon:'week'},places:[],carOnly:false,defaultHours:8,projectCode:null}
]
/* Standing arrangements: who normally works where. They generate shifts; the
   shifts are what count. A single-person job like the evening clean lives
   entirely here — set it up once and never open the schedule again unless
   something changes. */
export const standing:StandingAssignment[]=[
  { id:'sa-1', vacancyId:'v-dhl-inbound', workerId:'w-01', placeId:null, section:null, weekdays:['mon','tue','wed','thu','fri'], start:'08:00', end:'16:30', from:'2024-06-10', to:null, note:null },
  { id:'sa-2', vacancyId:'v-dhl-inbound', workerId:'w-08', placeId:null, section:null, weekdays:['mon','tue','wed','thu','fri'], start:'08:00', end:'16:30', from:'2024-06-15', to:null, note:'Took over from Dario Rossi' },
  { id:'sa-3', vacancyId:'v-evening-clean', workerId:'w-02', placeId:null, section:null, weekdays:['mon','wed','fri'], start:'18:00', end:'20:00', from:'2024-06-03', to:null, note:null },
  { id:'sa-4', vacancyId:'v-evening-clean', workerId:'w-13', placeId:null, section:null, weekdays:['mon','wed','fri'], start:'18:00', end:'20:00', from:'2024-06-03', to:null, note:null },
  { id:'sa-5', vacancyId:'v-ah-evening', workerId:'w-05', placeId:null, section:null, weekdays:['tue','thu'], start:'17:00', end:'21:00', from:'2024-06-17', to:'2024-06-30', note:null },
  /* A job that keeps no times at all: the arrangement says which days, and
     the day itself says who was there. Nothing else is written down. */
  { id:'sa-6', vacancyId:'v-klm-open', workerId:'w-06', placeId:null, section:null, weekdays:['mon','tue','wed','thu','fri'], start:null, end:null, from:'2024-06-24', to:null, note:null },
]
export const assignments:StandingAssignment[]=standing
/* Roster rows now carry a time window and an outcome, and a slot may be split
   between two people. The week below deliberately contains the awkward cases
   the office actually meets: a handover at midday, a sickness that leaves a
   two-hour hole, and a day where the client asked for a second person. */
const DAY=(n:number)=>`2024-06-${String(18+n).padStart(2,'0')}`
const shift=(id:string,vacancyId:string,date:string,placeId:string|null,section:string|null,workerId:string|null,start:string|null,end:string|null,rest:Partial<RosterEntry>={}):RosterEntry=>({id,vacancyId,date,placeId,section,workerId,extra:false,extraReason:null,standingId:null,start,end,outcome:'planned',actualEnd:null,coversShiftId:null,note:null,...rest})
const baseRoster:RosterEntry[]=[
  ...Array.from({length:7},(_,day)=>['Inbound','Outbound','Cold Storage'].map((sub,slot)=>shift(`r-${day}-${slot}`,'v-mojo-events',DAY(day),null,sub,workers[(day*3+slot+2)%workers.length].id,'08:00','16:30',day===0?{outcome:'worked'}:{}))).flat(),
  ...Array.from({length:7},(_,day)=>day===1?null:shift(`r-ah-${day}`,'v-ah-roster',DAY(day),null,'Inbound',workers[(day+14)%workers.length].id,'06:00','14:30',day===0?{outcome:'worked'}:{})).filter((x):x is RosterEntry=>x!==null),
  /* Two people splitting one slot: morning handed over at 12:00. */
  shift('r-split-am','v-mojo-events',DAY(2),null,'Inbound',workers[5].id,'06:00','12:00'),
  shift('r-split-pm','v-mojo-events',DAY(2),null,'Inbound',workers[9].id,'12:00','18:00'),
  /* Sick at 10:00, cover could only start at 12:00 — the gap is real and has
     to stay visible instead of being papered over. */
  shift('r-sick','v-ah-roster',DAY(1),null,'Inbound',workers[3].id,'06:00','14:30',{outcome:'left_early',actualEnd:'10:00',note:'Went home ill'}),
  shift('r-sick-cover','v-ah-roster',DAY(1),null,'Inbound',workers[7].id,'12:00','14:30',{coversShiftId:'r-sick',note:'Cover for the morning shift'}),
  /* Nobody turned up and it was noticed too late to replace. */
  shift('r-noshow','v-mojo-events',DAY(1),null,'Cold Storage',workers[11].id,'08:00','16:30',{outcome:'no_show'}),
  /* The extra body the client asked for on the Thursday. */
  shift('r-extra','v-mojo-events',DAY(3),null,'Outbound',workers[16].id,'08:00','16:30'),
]

/* What the client ordered, per day and sub-object. Kept apart from the roster
   above: the order changing from one person to two and back is a fact about
   the client, and the gap against actual coverage is what the office works. */
const baseDemand:Demand[]=[
  ...Array.from({length:7},(_,day)=>['Inbound','Outbound','Cold Storage'].map((sub,slot)=>({id:`d-${day}-${slot}`,vacancyId:'v-mojo-events',date:DAY(day),placeId:null,section:sub,headcount:sub==='Outbound'&&day===3?2:1,start:'08:00',end:'16:30',note:sub==='Outbound'&&day===3?'Extra body requested for the Thursday peak':null}))).flat(),
  ...Array.from({length:7},(_,day)=>({id:`d-ah-${day}`,vacancyId:'v-ah-roster',date:DAY(day),placeId:null,section:'Inbound',headcount:day===4?2:1,start:'06:00',end:'14:30',note:day===4?'Second picker asked for on Friday':null})),
]
export const leaves:Leave[]=[{id:'l-1',workerId:'w-03',date:'2024-06-20',reason:'Holiday',paidLeave:true},{id:'l-2',workerId:'w-03',date:'2024-06-21',reason:'Holiday',paidLeave:true},{id:'l-3',workerId:'w-03',date:'2024-06-22',reason:'Holiday',paidLeave:true},{id:'l-4',workerId:'w-15',date:'2024-06-24',reason:'Personal day',paidLeave:false},{id:'l-5',workerId:'w-20',date:'2024-06-19',reason:'Medical appointment',paidLeave:false},{id:'l-6',workerId:'w-28',date:'2024-06-25',reason:'Holiday',paidLeave:true}]
const baseHours:HoursEntry[]=[...Array.from({length:18},(_,i)=>({id:`h-${i}`,workerId:workers[i%12].id,vacancyId:'v-dhl-inbound',date:`2024-06-${String(10+i%8).padStart(2,'0')}`,hours:7.5})),...Array.from({length:9},(_,i)=>({id:`h-current-${i}`,workerId:workers[(i+3)%12].id,vacancyId:'v-dhl-inbound',date:`2024-06-${String(17+i%3).padStart(2,'0')}`,hours:8}))]
export const sync=[{source:'flexpedia' as const,lastSyncAt:'2024-06-18T08:32:00Z',status:'idle' as const,error:null},{source:'manatal' as const,lastSyncAt:'2024-06-18T08:45:00Z',status:'idle' as const,error:null}]


/* ------------------------------------------------------------------
   The two objects from the brief, ordered the way they really are.
   ------------------------------------------------------------------ */

const dem=(id:string,vacancyId:string,date:string,placeId:string|null,section:string|null,headcount:number,start:string|null,end:string|null,note:string|null=null):Demand=>
  ({id,vacancyId,date,placeId,section,headcount,start,end,note})

/* Warehouse: ordered the evening before, and the shape changes every day.
   Monday is Slego only; Tuesday adds Conakryweg with no section at all,
   which is normal rather than an omission. */
export const warehouseDemand:Demand[]=[
  dem('d-wh-1','v-warehouse','2024-06-17','p-slego','Inbound',2,'07:00','16:00'),
  dem('d-wh-2','v-warehouse','2024-06-17','p-slego','Outbound',3,'07:00','16:00'),
  dem('d-wh-3','v-warehouse','2024-06-18','p-slego','Inbound',4,'07:00','16:00'),
  dem('d-wh-4','v-warehouse','2024-06-18','p-slego','Outbound',5,'07:00','16:00'),
  dem('d-wh-5','v-warehouse','2024-06-18','p-conakry',null,1,'07:00','16:00','No section — general work on site'),
  dem('d-wh-6','v-warehouse','2024-06-19','p-slego','Inbound',3,'06:00','16:00','Asked to start an hour early'),
]

/* Ziggo Dome: whatever days Vebego publishes, each with its own start and an
   open end, five people as a rule. Taken from their weekly sheet. */
export const ziggoDemand:Demand[]=[
  dem('d-zd-1','v-ziggo','2024-06-21',null,null,5,'07:30',null),
  dem('d-zd-2','v-ziggo','2024-06-22',null,null,5,'06:30',null),
  dem('d-zd-3','v-ziggo','2024-06-23',null,null,5,'06:30',null),
  dem('d-zd-4','v-ziggo','2024-06-17',null,null,5,'08:30',null),
]

/* Who has already been asked. Not bookkeeping — it stops the same person
   being rung twice with the same offer. */
export const offers:Offer[]=[
  { id:'o-1', vacancyId:'v-ziggo', workerId:'w-05', date:'2024-06-22', status:'declined', note:'Family weekend', at:'2024-06-16T18:20:00Z' },
  { id:'o-2', vacancyId:'v-ziggo', workerId:'w-11', date:'2024-06-22', status:'offered',  note:null, at:'2024-06-16T18:25:00Z' },
  { id:'o-3', vacancyId:'v-warehouse', workerId:'w-09', date:null, status:'declined', note:'Does not want warehouse work', at:'2024-06-10T09:00:00Z' },
]

/* One shift beyond the order: a crew of newcomers needed two experienced
   hands, and the agency paid for them itself. */
export const extraShifts:RosterEntry[]=[
  { id:'r-extra-1', vacancyId:'v-ziggo', date:'2024-06-21', placeId:null, section:null, workerId:'w-03',
    extra:true, extraReason:'Crew was all newcomers — covered at our own cost', standingId:null,
    start:'07:30', end:null, outcome:'planned', actualEnd:null, coversShiftId:null, note:null },
]

/* The warehouse week the office is really working: two halls, ordered the
   evening before. Almost every day is the vacancy's default 8 h — only the two
   odd ones below were typed by hand, which is exactly the ratio the default
   exists for. */
const warehouseCrew=workers.filter(w=>w.status==='active'&&w.companyAccess.includes('c-dhl')).slice(0,5)
export const warehouseRoster:RosterEntry[]=['2024-06-17','2024-06-18','2024-06-19'].flatMap((date,day)=>
  warehouseCrew.map((w,i)=>shift(`r-wh-${day}-${i}`,'v-warehouse',date,i<3?'p-slego':'p-conakry',i<2?'Inbound':i<3?'Outbound':null,w.id,'07:00','16:00')))
export const warehouseHours:HoursEntry[]=[
  /* Went home early on the Wednesday. */
  {id:'h-wh-1',workerId:warehouseCrew[0].id,vacancyId:'v-warehouse',date:'2024-06-19',hours:5.25},
  /* Stayed to finish a container on the Tuesday. */
  {id:'h-wh-2',workerId:warehouseCrew[1].id,vacancyId:'v-warehouse',date:'2024-06-18',hours:9.5},
]
export const roster:RosterEntry[]=[...baseRoster,...extraShifts,...warehouseRoster]
export const hours:HoursEntry[]=[...baseHours,...warehouseHours]
export const demand:Demand[]=[...baseDemand,...warehouseDemand,...ziggoDemand]

export const mockData:AppData={workers,companies,vacancies,standing,roster,leaves,hours,sync}
export const manatalCandidates=[{id:3001,name:'Fatima El Idrissi',email:'fatima.elidrissi@example.nl'},{id:3002,name:'Fatima El Idrissi',email:'fatima@example.nl'},{id:3003,name:'Omar Ait Said',email:'omar@example.nl'}]
