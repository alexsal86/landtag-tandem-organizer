import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProtocolAgendaEntry } from './ProtocolAgendaItem';
import { ProtocolHeader } from './ProtocolHeader';
import { ProtocolSummary } from './ProtocolSummary';
import { ProtocolToc } from './ProtocolToc';
import { ProtocolDecisions } from './ProtocolDecisions';
import { ProtocolNotes } from './ProtocolNotes';
import { ProtocolAppointments } from './ProtocolAppointments';
import { ProtocolTasks } from './ProtocolTasks';
import { agenda,meeting,decisions,notes,tasks,appointments } from './__fixtures__/protocol';
const getChildren=(id:string)=>agenda.filter(item=>item.parent_id===id);
const names=()=> 'Franziska';
function Agenda({only=false}:{only?:boolean}) { return <>{agenda.filter(item=>!item.parent_id).map((item,index)=><ProtocolAgendaEntry key={item.id} item={item} number={`${index+1}.`} onlyResults={only} getChildren={getChildren} getAssignedUserNames={names} getSystemIcon={()=>null}/>)}</>; }
describe('protocol presentation',()=>{
 it('keeps hierarchy and parsed follow-up results, while suppressing birthday results',()=>{
  render(<Agenda/>);
  expect(screen.getByText('2.1')).toBeTruthy();
  expect(screen.getByText('Cathy übernimmt die Vertretung.')).toBeTruthy();
  expect(screen.getByText('Folgeaufgabe')).toBeTruthy();
  expect(screen.getByText('Erledigt')).toBeTruthy();
  expect(screen.queryByText('GEBURTSTAGSERGEBNIS')).toBeNull();
  expect(screen.getByText('leer')).toBeTruthy();
 });
 it('filters empty items but retains a parent with child content',()=>{
  render(<Agenda only/>);
  expect(screen.queryByText('Begrüßung')).toBeNull();
  expect(screen.queryByText('Geburtstage')).toBeNull();
  expect(screen.getByText('Aktuelles aus dem Landtag')).toBeTruthy();
  expect(screen.getByText('Cathy übernimmt die Vertretung.')).toBeTruthy();
 });
 it('shows header metadata, role chips and working summary anchors',()=>{
  render(<><ProtocolHeader meeting={meeting} participants={[{user_id:'u',display_name:'Franziska',role:'organizer'}]} roleLabelMap={{organizer:'Organisator'}}/><ProtocolSummary points={3} decisions={1} openDecisions={0} tasks={2}/><ProtocolToc sections={[{id:'protocol-agenda',label:'Tagesordnung'}]} activeSection="protocol-agenda"/></>);
  expect(screen.getByText('Stuttgart')).toBeTruthy();
  expect(screen.getByText('Organisator')).toBeTruthy();
  expect(screen.getByRole('link',{name:'3 Hauptpunkte besprochen'}).getAttribute('href')).toBe('#protocol-agenda');
  expect(screen.getByRole('link',{name:'Tagesordnung'}).getAttribute('aria-current')).toBe('location');
 });
 it('retains decision status, deadlines, notes, appointments and task hierarchy',()=>{
  render(<><ProtocolDecisions decisions={decisions}/><ProtocolNotes notesWithResults={notes}/><ProtocolAppointments starredAppointments={appointments}/><ProtocolTasks parentTasks={tasks.filter(t=>!t.parent_task_id)} createdTasks={tasks} getAssignedUserNames={names}/></>);
  for(const value of ['Entschieden','Frist: 20.11.2026','Vertretung bestätigt','Wird im Dezember getestet.','Ausschusssitzung','Antwort schreiben','Entwurf abstimmen','Franziska']) expect(screen.getByText(value)).toBeTruthy();
 });
 it('omits all optional sections when their data is empty',()=>{
  const {container}=render(<><ProtocolDecisions decisions={[]}/><ProtocolNotes notesWithResults={[]}/><ProtocolAppointments starredAppointments={[]}/><ProtocolTasks parentTasks={[]} createdTasks={[]} getAssignedUserNames={names}/></>);
  expect(container.querySelector('section')).toBeNull();
 });
});
