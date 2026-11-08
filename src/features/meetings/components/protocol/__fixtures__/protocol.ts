import type { ProtocolAgendaItem, ProtocolMeeting } from '../types';
export const meeting: ProtocolMeeting = {id:'meeting',title:'Nettes Meeting',description:'Wöchentliche Abstimmung',meeting_date:'2026-11-12',meeting_time:'10:00:00',location:'Stuttgart',status:'archived',user_id:'u'};
export const decisionId='12345678-1234-1234-1234-123456789012';
export const agenda:ProtocolAgendaItem[]=[
 {id:'empty',title:'Begrüßung',order_index:0},
 {id:'main',title:'Aktuelles aus dem Landtag',order_index:1},
 {id:'sys',parent_id:'main',title:'Entscheidungen',system_type:'decisions',order_index:2,result_text:JSON.stringify({[decisionId]:{result:'Cathy übernimmt die Vertretung.',follow_up:true}})},
 {id:'details',title:'Wahlkreisarbeit',description:'Termine abstimmen',notes:'Finanzierung klären',assigned_to:['u'],order_index:3,is_completed:true,result_text:'Bürgerdialog im Dezember.'},
 {id:'birthdays',parent_id:'main',title:'Geburtstage',system_type:'birthdays',order_index:4,result_text:'GEBURTSTAGSERGEBNIS'},
];
export const profiles=[{user_id:'u',display_name:'Franziska',avatar_url:null}];
export const decisions=[{id:decisionId,title:'Ausschussvertretung',status:'decided',response_deadline:'2026-11-20',meeting_result:'Vertretung bestätigt',result_text:'Vertretung bestätigt'}];
export const notes=[{id:'note',title:'Ideen für den Bürgerdialog',content:'Idee',meeting_result:'Wird im Dezember getestet.'}];
export const tasks=[{id:'task',title:'Antwort schreiben',assigned_to:'{u}',parent_task_id:null},{id:'child',title:'Entwurf abstimmen',assigned_to:'{u}',parent_task_id:'task'}];
export const appointments=[{id:'appointment',title:'Ausschusssitzung',start_time:'2026-11-20T10:00:00'}];
