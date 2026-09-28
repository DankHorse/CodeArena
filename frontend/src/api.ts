import fixture from './fixtures.json';
export type Row = Record<string, any>;
export const DEMO = import.meta.env.VITE_DEMO === 'true';
const KEY='codearena-preview-v3';
const date=()=>new Date().toISOString();
const id=(p:string)=>p+'_'+crypto.randomUUID().slice(0,8);
const isClosed=(d:string)=>new Date(d).getTime()<=Date.now();
function initial():Row {
 const e=fixture.event.id;
 const criteria=['functionality','quality','innovation'];
 const events=[{...fixture.event,description:'The official fixture event: 41 project records, 30 judges, eight tracks, and the real edge cases a judging platform needs to handle.',registration_close:fixture.event.submissions_close,required_judges:3,prizes:'Fixture event — no monetary prizes.',published:false,practice:false},{id:'evt_practice',name:'Open Circuit / Practice Arena',description:'Build something useful. Find your team. Put your idea in front of reviewers. A practice event for exploring the complete CodeArena workflow.',submissions_close:'2099-12-31T18:00:00Z',registration_close:'2099-12-30T18:00:00Z',required_judges:3,prizes:'Practice event — no monetary prizes.',published:false,practice:true}];
 const tracks=[...fixture.tracks.map(t=>({...t,event_id:e})),...['Developer tools','Climate','Open hardware'].map((name,i)=>({id:'demo_trk_'+i,name,event_id:'evt_practice'}))];
 const users=[{id:'organizer',name:'Mrin Patankar',email:'organizer@codearena.local'},{id:'participant',name:'Alex Morgan',email:'participant@codearena.local'},...fixture.judges];
 const memberships=[...[e,'evt_practice'].flatMap(event_id=>[{event_id,user_id:'organizer',role:'organizer'},{event_id,user_id:'participant',role:'participant'}]),...fixture.judges.map(j=>({event_id:e,user_id:j.id,role:'judge'})),...fixture.judges.slice(0,3).map(j=>({event_id:'evt_practice',user_id:j.id,role:'judge'}))];
 const teams=[...fixture.teams.map(t=>({...t,event_id:e,owner_id:'fixture',invite_code:'FIXTURE-'+t.id,member_ids:t.id==='tm_01'?['participant']:[]})),{id:'demo_team',event_id:'evt_practice',name:'Northstar',owner_id:'participant',invite_code:'NORTHSTAR-26',member_ids:['participant'],members:['participant@codearena.local']}];
 const projects=[...fixture.projects.map(p=>({...p,event_id:e,team_id:p.team,track_id:p.track,description:p.summary,technologies:'',demo_url:'',video_url:'',state:'submitted'})),...['SignalStack','Gridwise','OpenCircuit'].map((title,i)=>({id:'demo_prj_'+i,event_id:'evt_practice',team_id:'demo_team',track_id:'demo_trk_'+i,title,summary:['An offline-first incident response workspace for small teams.','Smarter energy decisions for community microgrids.','Collaborative hardware schematics that work offline.'][i],description:['Coordinate incidents, assign responders and keep a complete activity trail. Built to remain useful when the network is unavailable.','Explore community energy use and make solar and battery decisions with clear, actionable data.','A shared workspace for documenting open hardware, component choices and design reviews.'][i],technologies:'Python, React',repo_url:'https://example.org/'+title.toLowerCase(),demo_url:'',video_url:'',state:i?'submitted':'draft',submitted_at:i?date():null}))];
 const rubric=events.flatMap(event=>criteria.map((n,i)=>({id:event.id+':'+n,event_id:event.id,name:n[0].toUpperCase()+n.slice(1),description:['How completely does the project solve its intended problem?','Reliability, maintainability, and attention to detail.','Originality and thoughtful use of technology.'][i],weight:[40,35,25][i],max_score:5,position:i})));
 const assignments:Row[]=fixture.scores.map(s=>({id:s.judge+':'+s.project,judge_id:s.judge,project_id:s.project,status:'submitted',reason:''}));
 const evaluations:Row[]=fixture.scores.map(s=>({assignment_id:s.judge+':'+s.project,scores:Object.fromEntries(Object.entries(s.criteria).map(([k,v])=>[e+':'+k,v])),comment:s.comment,submitted_at:fixture.event.submissions_close}));
 for(const j of fixture.judges.slice(0,3))for(const p of projects.filter(p=>p.event_id==='evt_practice'&&p.state==='submitted'))assignments.push({id:j.id+':'+p.id,judge_id:j.id,project_id:p.id,status:'pending',reason:''});
 return {events,tracks,users,memberships,teams,projects,rubric,assignments,evaluations,audit:[],user:null};
}
let state:Row;
try{state=JSON.parse(localStorage.getItem(KEY)||'null')||initial();}catch{state=initial();}
const persist=()=>{try{localStorage.setItem(KEY,JSON.stringify(state));}catch{/* preview remains usable without storage */}};
const roleFor=(e:string)=>state.memberships.find((m:Row)=>m.event_id===e&&m.user_id===state.user)?.role;
const requireRole=(e:string,roles:string[])=>{if(!roles.includes(roleFor(e)))throw Error('You do not have permission for this event.');};
const myTeam=(t:Row)=>t.member_ids.includes(state.user);
const project=(p:Row)=>({...p,status:p.state==='submitted'&&isClosed(state.events.find((e:Row)=>e.id===p.event_id).submissions_close)?'locked':p.state});
function leaderboard(e:string){
 const criteria=state.rubric.filter((c:Row)=>c.event_id===e),event=state.events.find((x:Row)=>x.id===e),obs:Row[]=[];
 for(const p of state.projects.filter((p:Row)=>p.event_id===e&&p.state==='submitted'))for(const a of state.assignments.filter((a:Row)=>a.project_id===p.id&&a.status==='submitted')){
  const ev=state.evaluations.find((v:Row)=>v.assignment_id===a.id);if(!ev||criteria.some((c:Row)=>ev.scores[c.id]===undefined))continue;
  obs.push({p:p.id,j:a.judge_id,score:criteria.reduce((s:number,c:Row)=>s+ev.scores[c.id]/c.max_score*c.weight,0)});
 }
 const avg=(xs:number[])=>xs.reduce((a,b)=>a+b,0)/xs.length;
 const global=obs.length?avg(obs.map(o=>o.score)):0;
 const rows=state.projects.filter((p:Row)=>p.event_id===e&&p.state==='submitted').map((p:Row)=>{const os=obs.filter(o=>o.p===p.id);const norm=os.map(o=>{const js=obs.filter(x=>x.j===o.j);return Math.max(0,Math.min(100,o.score-(js.length>=3?avg(js.map(x=>x.score))-global:0)));});return {project_id:p.id,title:p.title,team_id:p.team_id,track_id:p.track_id,reviews:os.length,required:event.required_judges,complete:os.length>=event.required_judges,raw_score:os.length?+avg(os.map(o=>o.score)).toFixed(2):null,score:norm.length?+avg(norm).toFixed(2):null,rank:null};});
 rows.sort((a:Row,b:Row)=>Number(!a.complete)-Number(!b.complete)||(b.score??-1)-(a.score??-1)||a.title.localeCompare(b.title));
 let rank=0,last:number|null=null;rows.forEach((r:Row,i:number)=>{if(r.complete){if(r.score!==last)rank=i+1;r.rank=rank;last=r.score;}});return rows;
}
function judgeList(e:string){return state.memberships.filter((m:Row)=>m.event_id===e&&m.role==='judge').map((m:Row)=>{const u=state.users.find((u:Row)=>u.id===m.user_id);const as=state.assignments.filter((a:Row)=>a.judge_id===u.id&&state.projects.some((p:Row)=>p.id===a.project_id&&p.event_id===e)&&a.status!=='recused');return {...u,track_ids:e==='evt_practice'?state.tracks.filter((t:Row)=>t.event_id===e).map((t:Row)=>t.id):(m.track_ids||u.tracks||[]),assigned:as.length,completed:as.filter((a:Row)=>a.status==='submitted').length};});}
function log(e:string,action:string,target:string){state.audit.unshift({id:id('audit'),event_id:e,actor_id:state.user,action,target,created_at:date()});}
async function mock(path:string,method:string,p:Row|Row[]={}):Promise<any>{
 const body=p as Row,parts=path.split('/').filter(Boolean).map(decodeURIComponent);const e=parts[2],action=parts[3];
 if(path==='/api/bootstrap')return {user:state.users.find((u:Row)=>u.id===state.user)||null,memberships:state.memberships.filter((m:Row)=>m.user_id===state.user),events:state.events.map((e:Row)=>({...e,closed:isClosed(e.submissions_close)})),tracks:state.tracks,teams:state.teams.map((t:Row)=>({id:t.id,name:t.name,event_id:t.event_id,mine:myTeam(t)})),projects:state.projects.filter((p:Row)=>p.state==='submitted'||roleFor(p.event_id)==='organizer'||myTeam(state.teams.find((t:Row)=>t.id===p.team_id))).map(project),demo_enabled:true};
 if(path==='/api/judging/me'){const event_ids=state.memberships.filter((m:Row)=>m.user_id===state.user&&m.role==='judge'&&state.assignments.some((a:Row)=>a.judge_id===state.user&&state.projects.some((p:Row)=>p.id===a.project_id&&p.event_id===m.event_id))).map((m:Row)=>m.event_id);return {is_judge:event_ids.length>0,event_ids};}
 if(path==='/api/auth/demo'){state.user={organizer:'organizer',participant:'participant',judge:'jdg_01'}[body.role as string];persist();return {};}
 if(path==='/api/auth/logout'){state.user=null;persist();return {};}
 if(path==='/api/auth/register'){const u={id:id('usr'),name:body.name,email:body.email};state.users.push(u);state.user=u.id;persist();return u;}
 if(path==='/api/events'&&method==='POST'){
  const ev={...body,id:id('evt'),practice:true,published:false};state.events.push(ev);state.memberships.push({event_id:ev.id,user_id:state.user,role:'organizer'});body.tracks.forEach((name:string)=>state.tracks.push({id:id('trk'),event_id:ev.id,name}));['Functionality','Quality','Innovation'].forEach((name,i)=>state.rubric.push({id:id('crit'),event_id:ev.id,name,description:'Score '+name.toLowerCase()+'.',weight:[40,35,25][i],max_score:5,position:i}));persist();return ev;
 }
 if(parts[1]==='events'){
  const event=state.events.find((x:Row)=>x.id===e);if(!event)throw Error('Event not found.');
  if(action==='register'){if(isClosed(event.submissions_close)||isClosed(event.registration_close))throw Error('Event registration is closed.');if(!roleFor(e))state.memberships.push({event_id:e,user_id:state.user,role:'participant'});persist();return {};}
  if(action==='results'&&method==='GET'){if(!event.published)requireRole(e,['organizer']);return {items:leaderboard(e),published:event.published,method:'mean-centered-v1'};}
  requireRole(e,action==='rubric'||action==='assignments'?['judge','organizer']:['organizer']);
  if(!action&&method==='PUT'){
   const trackNames=[...new Set((body.tracks as string[]).map(name=>name.trim()).filter(Boolean))];
   const currentTracks=state.tracks.filter((t:Row)=>t.event_id===e);
   const removed=currentTracks.filter((t:Row)=>!trackNames.includes(t.name));
   const blocked=removed.filter((t:Row)=>state.projects.some((p:Row)=>p.event_id===e&&p.track_id===t.id));

   if(blocked.length){
    throw Error('Cannot remove tracks used by projects: '+blocked.map((t:Row)=>t.name).join(', ')+'.');
   }

   const eventUpdate={...body};
   delete eventUpdate.tracks;
   Object.assign(event,eventUpdate);

   state.tracks=state.tracks.filter((t:Row)=>t.event_id!==e||trackNames.includes(t.name));

   trackNames.forEach((name:string)=>{
    if(!state.tracks.some((t:Row)=>t.event_id===e&&t.name===name)){
     state.tracks.push({id:id('trk'),event_id:e,name});
    }
   });

   log(e,'event.updated',e);
  }
  if(action==='rubric'){
   if(method==='GET')return state.rubric.filter((c:Row)=>c.event_id===e);
   requireRole(e,['organizer']);if(state.evaluations.some((v:Row)=>state.assignments.some((a:Row)=>a.id===v.assignment_id&&state.projects.some((p:Row)=>p.id===a.project_id&&p.event_id===e))))throw Error('The rubric is locked because scoring has started.');
   const cs=p as Row[];if(!cs.length||Math.abs(cs.reduce((s:number,c:Row)=>s+Number(c.weight),0)-100)>.001)throw Error('Criterion weights must total 100%.');state.rubric=state.rubric.filter((c:Row)=>c.event_id!==e);cs.forEach((c,i)=>state.rubric.push({...c,id:id('crit'),event_id:e,position:i}));log(e,'rubric.updated',e);
  }
  if(action==='judges'){
   if(method==='GET')return judgeList(e);
   const u=state.users.find((u:Row)=>u.email===body.email);if(!u)throw Error('The judge must register an account first.');const m=state.memberships.find((m:Row)=>m.event_id===e&&m.user_id===u.id);if(m&&m.role!=='judge')throw Error('This person already has another role in this event.');if(m)m.track_ids=body.track_ids;else state.memberships.push({event_id:e,user_id:u.id,role:'judge',track_ids:body.track_ids});log(e,'judge.added',u.id);
  }
  if(action==='assignments'){
   if(method==='GET')return state.assignments.filter((a:Row)=>state.projects.some((p:Row)=>p.id===a.project_id&&p.event_id===e)&&(roleFor(e)==='organizer'||a.judge_id===state.user));
   requireRole(e,['organizer']);let created=0;const unfilled:string[]=[];
   for(const pr of state.projects.filter((pr:Row)=>pr.event_id===e&&pr.state==='submitted'&&(!body.project_id||pr.id===body.project_id))){
    const existing=state.assignments.filter((a:Row)=>a.project_id===pr.id);const need=event.required_judges-existing.filter((a:Row)=>a.status!=='recused').length;
    const js=judgeList(e).filter((j:Row)=>!existing.some((a:Row)=>a.judge_id===j.id)&&j.track_ids.includes(pr.track_id)&&!state.teams.find((t:Row)=>t.id===pr.team_id).member_ids.includes(j.id)&&(!body.judge_id||j.id===body.judge_id)).sort((a:Row,b:Row)=>a.assigned-b.assigned||a.id.localeCompare(b.id));
    for(const j of js.slice(0,Math.max(0,need))){state.assignments.push({id:id('asn'),project_id:pr.id,judge_id:j.id,status:'pending',reason:''});created++;}
    if(js.length<need)unfilled.push(pr.id);
   }log(e,'judges.assigned',String(created));persist();return {created,unfilled};
  }
  if(action==='publish'){const rows=leaderboard(e);if(body.published&&(!rows.length||rows.some((r:Row)=>!r.complete)))throw Error('All submitted projects need the required number of completed reviews.');event.published=body.published;log(e,'results.'+(body.published?'published':'unpublished'),e);}
  if(action==='audit')return state.audit.filter((a:Row)=>a.event_id===e);
  persist();return {ok:true};
 }
 if(parts[1]==='teams'){
  if(method==='GET'){const t=state.teams.find((t:Row)=>t.id===e);if(!t||(!myTeam(t)&&roleFor(t.event_id)!=='organizer'))throw Error('Team access denied.');return {...t,members:t.members.map((email:string)=>state.users.find((u:Row)=>u.email===email)||{id:email,name:email.split('@')[0],email})};}
  if(e==='join'){const t=state.teams.find((t:Row)=>t.invite_code===body.code);if(!t)throw Error('No team matches this invite code.');requireRole(t.event_id,['participant']);if(isClosed(state.events.find((e:Row)=>e.id===t.event_id).submissions_close))throw Error('Event is closed.');if(!myTeam(t)){t.member_ids.push(state.user);t.members.push(state.users.find((u:Row)=>u.id===state.user).email);}persist();return t;}
  requireRole(body.event_id,['participant']);const t={...body,id:id('team'),owner_id:state.user,invite_code:id('JOIN').toUpperCase(),member_ids:[state.user],members:[state.users.find((u:Row)=>u.id===state.user).email]};state.teams.push(t);persist();return t;
 }
 if(parts[1]==='submissions'){
  requireRole(body.event_id,['participant']);
  const ev=state.events.find((event:Row)=>event.id===body.event_id);
  if(isClosed(ev.submissions_close))throw Error('Submissions are closed. This project is locked.');
  const team=state.teams.find((team:Row)=>team.id===body.team_id&&team.event_id===ev.id);
  if(!team||!myTeam(team))throw Error('Not your team.');
  const existing=e?state.projects.find((pr:Row)=>pr.id===e):undefined;
  if(e&&(!existing||existing.event_id!==ev.id||existing.team_id!==team.id))throw Error('Project access denied.');
  // Validate the merged record before mutating shared or persisted state.
  const submitted=existing?.state==='submitted'||body.submit===true;
  const candidate={...existing,...body,state:submitted?'submitted':'draft'};
  const nonempty=(value:unknown)=>typeof value==='string'&&value.trim().length>0;
  if(!nonempty(candidate.title))throw Error('Enter a project title.');
  if(submitted&&(!nonempty(candidate.summary)||!nonempty(candidate.repo_url)||!nonempty(candidate.track_id)))throw Error('Submitted projects require a summary, track and repository URL.');
  if(candidate.track_id&&!state.tracks.some((track:Row)=>track.id===candidate.track_id&&track.event_id===ev.id))throw Error('Select a track for this event.');
  for(const value of [candidate.repo_url,candidate.demo_url]){
   if(!value)continue;
   let url:URL;
   try{url=new URL(value);}catch{throw Error('Project links must be valid HTTP or HTTPS URLs.');}
   if(!['http:','https:'].includes(url.protocol))throw Error('Project links must use HTTP or HTTPS.');
  }
  const pr=existing||{id:id('prj')};
  Object.assign(pr,candidate,{id:pr.id});
  if(submitted)pr.submitted_at=existing?.submitted_at||date();
  if(!existing)state.projects.push(pr);
  log(ev.id,'project.saved',pr.id);persist();return project(pr);
 }
 if(parts[1]==='evaluations'){
  const a=state.assignments.find((a:Row)=>a.id===e);if(!a||a.judge_id!==state.user)throw Error('Another judge’s evaluation is private.');const pr=state.projects.find((p:Row)=>p.id===a.project_id);let v=state.evaluations.find((v:Row)=>v.assignment_id===e);
  if(method==='GET')return {assignment:a,project:project(pr),evaluation:v||null,scores:v?.scores||{}};
  if(['submitted','recused'].includes(a.status))throw Error('This evaluation is locked or recused.');
  const cs=state.rubric.filter((c:Row)=>c.event_id===pr.event_id);if(body.submit&&cs.some((c:Row)=>body.scores[c.id]===undefined))throw Error('Score every criterion before submitting.');
  if(!v){v={assignment_id:e};state.evaluations.push(v);}Object.assign(v,body);a.status=body.submit?'submitted':'in_progress';if(body.submit)v.submitted_at=date();log(pr.event_id,'evaluation.'+a.status,e);persist();return {ok:true};
 }
 if(parts[1]==='assignments'&&action==='recuse'){
  const a=state.assignments.find((a:Row)=>a.id===e);const pr=state.projects.find((p:Row)=>p.id===a?.project_id);if(!a||!(a.judge_id===state.user||roleFor(pr.event_id)==='organizer'))throw Error('Assignment access denied.');if(a.status==='submitted')throw Error('Submitted evaluations are locked.');a.status='recused';a.reason=body.reason;log(pr.event_id,'judge.recused',e);persist();return {};
 }
 throw Error('This action is unavailable in the preview.');
}
export class ApiError extends Error {
 constructor(message: string, public readonly status: number, public readonly code?: string, public readonly details?: unknown) { super(message); this.name = 'ApiError'; }
}
export const apiPath = (path: string) =>
 path.startsWith('/api/') && !/^\/api\/v1(?:\/|$|\?)/.test(path) ? path.replace('/api/', '/api/v1/') : path;
export async function api<T = unknown>(path: string, method = 'GET', data?: unknown): Promise<T> {
 if (DEMO) return mock(path, method, data as Row) as Promise<T>;
 const res = await fetch(apiPath(path), {
  method, credentials: 'include',
  headers: {'Content-Type': 'application/json', 'X-CodeArena-Request': '1'},
  ...(data !== undefined ? {body: JSON.stringify(data)} : {}),
 });
 if (res.status === 204) return undefined as T;
 const body = await res.json().catch(() => ({}));
 if (!res.ok) {
  const detail = typeof body.detail === 'string' ? body.detail
   : Array.isArray(body.detail) ? body.detail.map((item: {msg?: string}) => item.msg).filter(Boolean).join('; ') : '';
  throw new ApiError(body.error?.message || detail || 'The request failed. Please try again.', res.status, body.error?.code, body.error?.details ?? body.detail);
 }
 return body as T;
}
export async function exportCSV(event:string){
 let blob:Blob;
 if(DEMO){const items=leaderboard(event),escape=(v:any)=>'"'+String(v??'').replaceAll('"','""')+'"';blob=new Blob([['Rank','Project','Reviews','Raw score','Normalized score','Complete'].map(escape).join(',')+'\n'+items.map((r:Row)=>[r.rank,r.title,r.reviews,r.raw_score,r.score,r.complete].map(escape).join(',')).join('\n')],{type:'text/csv'});}
 else{const r=await fetch(apiPath(`/api/events/${event}/results/export.csv`),{credentials:'include'});if(!r.ok)throw Error('CSV export failed.');blob=await r.blob();}
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='codearena-results.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
