# any-Klassifizierung

- removable-ui-hooks: 224
- removable-non-adapter: 16

| Klasse | Datei | Zeile | Treffer |
| --- | --- | ---: | --- |
| removable-non-adapter | vite.config.ts | 67 | const proxyRequest = async (req: any, res: any) => { |
| removable-non-adapter | scripts/any-report-flow.mjs | 65 | const pattern = String.raw`\bany\b\|as any\|<any>\|: any`; |
| removable-non-adapter | scripts/report-any-usage.mjs | 199 | console.log('\| Ordner \| `: any` \| `as any` \| `any[]` \| `Map<string, any>` \| Summe \|'); |
| removable-non-adapter | scripts/report-any-usage.mjs | 221 | console.log('\| Datei \| `: any` \| `as any` \| `any[]` \| `Map<string, any>` \| Summe \|'); |
| removable-non-adapter | scripts/report-any-usage.mjs | 240 | console.log('\| Cluster \| `: any` \| `as any` \| `any[]` \| `Map<string, any>` \| Summe \|'); |
| removable-non-adapter | scripts/check-type-safety-delta.mjs | 5 | const ANY_EXCEPTION_PATTERN = /(?:any-exception\|any-allow\|eslint-disable-next-line\s+@typescript-eslint\/no-explicit-any)/i; |
| removable-non-adapter | src/integrations/supabase/client.ts | 4 | const { createClient } = await import('@supabase/supabase-js') as any; |
| removable-non-adapter | src/integrations/supabase/client.ts | 12 | export const supabase: any = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { |
| removable-non-adapter | src/lib/lazyWithRetry.ts | 7 | export function lazyWithRetry<T extends React.ComponentType<any>>( |
| removable-non-adapter | src/lib/__tests__/utils.test.ts | 30 | expect(isValidEmail(null as any)).toBe(false); |
| removable-non-adapter | src/lib/__tests__/utils.test.ts | 31 | expect(isValidEmail(undefined as any)).toBe(false); |
| removable-non-adapter | src/contexts/MatrixClientContext.tsx | 1095 | matrixClient.on(sdk.RoomEvent.Timeline, onTimeline as any); |
| removable-non-adapter | src/contexts/MatrixClientContext.tsx | 1096 | matrixClient.on(sdk.RoomMemberEvent.Typing, onTyping as any); |
| removable-non-adapter | src/contexts/MatrixClientContext.tsx | 1450 | await mc.sendMessage(roomId, content as any); |
| removable-ui-hooks | src/hooks/useAllPersonContacts.tsx | 58 | const pageContacts = (contacts \|\| []).map((c: any) => mapPersonContact(c)); |
| removable-ui-hooks | src/hooks/useAllPersonContacts.tsx | 125 | const changedId = (payload.new as any)?.id \|\| (payload.old as any)?.id; |
| removable-ui-hooks | src/hooks/useMyWorkDecisionsSidebarData.ts | 42 | const profileMap = new Map<string, any>(profiles?.map((p: any) => [p.user_id, p]) \|\| []); |
| removable-ui-hooks | src/hooks/useUserStatus.tsx | 56 | const presenceChannelRef = useRef<any>(null); |
| removable-ui-hooks | src/hooks/useUserStatus.tsx | 199 | Object.entries(presenceState).forEach(([userId, presences]: [string, any[]]) => { |
| removable-ui-hooks | src/hooks/useKarlsruheDistricts.tsx | 9 | boundaries: any; |
| removable-ui-hooks | src/hooks/usePartyAssociations.tsx | 18 | social_media?: any; |
| removable-ui-hooks | src/hooks/usePartyAssociations.tsx | 24 | coverage_areas?: any; |
| removable-ui-hooks | src/hooks/usePartyAssociations.tsx | 25 | administrative_boundaries?: any; |
| removable-ui-hooks | src/hooks/usePartyAssociations.tsx | 26 | contact_info?: any; |
| removable-ui-hooks | src/hooks/useQuickNotes.ts | 836 | } as any, |
| removable-ui-hooks | src/hooks/useQuickNotes.ts | 837 | ], { returning: 'minimal' } as any); |
| removable-ui-hooks | src/components/LetterTemplateSelector.tsx | 359 | onSelect(template as any); |
| removable-ui-hooks | src/components/LeafletBasicKarlsruheMap.tsx | 101 | const polygon = L.polygon(boundaries as any, { |
| removable-ui-hooks | src/hooks/useDecisionComments.ts | 29 | (data \|\| []).forEach((row: any) => { |
| removable-ui-hooks | src/hooks/useMyWorkJourFixeMeetings.ts | 151 | return (participants as any[]).reduce<Record<string, MeetingParticipant[]>>((participantsByMeeting, participant) => { |
| removable-ui-hooks | src/hooks/useDocumentContacts.tsx | 109 | const updateData: any = {}; |
| removable-ui-hooks | src/hooks/useLoginCustomization.tsx | 19 | background_attribution: any; |
| removable-ui-hooks | src/components/contacts/DuplicateContactsSheet.tsx | 70 | const foundDuplicates = await findDuplicatesProgressive((data \|\| []) as any, { |
| removable-ui-hooks | src/components/contacts/DuplicateContactsSheet.tsx | 74 | setDuplicates(foundDuplicates as any); |
| removable-ui-hooks | src/components/contacts/DuplicateContactsSheet.tsx | 226 | contact1={selectedMatch.contact1 as any} |
| removable-ui-hooks | src/components/contacts/DuplicateContactsSheet.tsx | 227 | contact2={selectedMatch.contact2 as any} |
| removable-ui-hooks | src/components/contacts/FundingDialog.tsx | 132 | const updateParticipant = (contactId: string, field: keyof Participant, value: any) => { |
| removable-ui-hooks | src/hooks/__tests__/useTenant.test.ts | 46 | function setupSupabaseMock(data: any[] \| null, error: any = null) { |
| removable-ui-hooks | src/hooks/__tests__/useAuth.test.ts | 128 | let authCallback: (event: string, session: any) => void; |
| removable-ui-hooks | src/hooks/__tests__/useAuth.test.ts | 130 | mockSupabase.auth.onAuthStateChange.mockImplementation((cb: any) => { |
| removable-ui-hooks | src/hooks/useStakeholderPreload.tsx | 88 | const pageStakeholders = (data \|\| []).map((d: any) => mapStakeholder(d)); |
| removable-ui-hooks | src/hooks/useStakeholderPreload.tsx | 160 | const changedId = (payload.new as any)?.id \|\| (payload.old as any)?.id; |
| removable-ui-hooks | src/hooks/useTeamAnnouncements.ts | 275 | const code = error instanceof Error ? (error as any).code : undefined; |
| removable-ui-hooks | src/hooks/useElectionDistricts.tsx | 26 | boundaries?: any; |
| removable-ui-hooks | src/hooks/useElectionDistricts.tsx | 27 | center_coordinates?: any; |
| removable-ui-hooks | src/hooks/useElectionDistricts.tsx | 30 | contact_info?: any; |
| removable-ui-hooks | src/hooks/useElectionDistricts.tsx | 76 | ?.map((rep: any) => ({ |
| removable-ui-hooks | src/hooks/useUserPreference.ts | 82 | } as any, |
| removable-ui-hooks | src/hooks/useUserPreference.ts | 118 | value: newValue as any, |
| removable-ui-hooks | src/hooks/useUserPreference.ts | 120 | } as any, |
| removable-ui-hooks | src/components/EnhancedLexicalEditor.tsx | 228 | const editorRef = useRef<any>(null); |
| removable-ui-hooks | src/components/EnhancedLexicalEditor.tsx | 230 | const handleChange = useCallback((editorState: EditorState, editor: any) => { |
| removable-ui-hooks | src/components/letters/HeaderEditorTest.tsx | 86 | const handleSave = (headerData: any) => { |
| removable-ui-hooks | src/components/letters/LetterAttachmentManager.tsx | 278 | const handleAddDocumentAttachment = async (document: any) => { |
| removable-ui-hooks | src/components/LettersView.tsx | 477 | letter={letter as any} |
| removable-ui-hooks | src/components/LettersView.tsx | 561 | letter={letter as any} |
| removable-ui-hooks | src/components/LettersView.tsx | 593 | letter={selectedLetter as any} |
| removable-ui-hooks | src/components/CombinedMessagesWidget.tsx | 29 | const { data, error } = await (supabase.rpc as any)('get_user_messages', { user_id_param: user.id }) as { data: Array<{ is_for_all_users: boolean; has_read: boolean; author_id: string }> \| null; error: unknown }; |
| removable-ui-hooks | src/components/letters/hooks/useLetterOperations.ts | 19 | latestContentRef: React.MutableRefObject<{ content: string; contentNodes?: any }>; |
| removable-ui-hooks | src/components/letters/hooks/useLetterOperations.ts | 29 | senderInfos: any[]; |
| removable-ui-hooks | src/components/letters/hooks/useLetterOperations.ts | 30 | informationBlocks: any[]; |
| removable-ui-hooks | src/components/TasksView.tsx | 307 | {data.taskDocumentDetails[task.id].map((doc: any) => ( |
| removable-ui-hooks | src/components/CustomizableDashboard.tsx | 173 | updateWidget(widgetId, { widgetSize: newSize } as any); |
| removable-ui-hooks | src/components/letters/types.ts | 39 | // Extended fields used in editor (cast via `as any` in original) |
| removable-ui-hooks | src/components/letters/types.ts | 116 | export const findFontFamilyInLexicalNode = (node: any): string \| null => { |
| removable-ui-hooks | src/components/letters/types.ts | 133 | let parsed: any = contentNodes; |
| removable-ui-hooks | src/components/letters/StructuredFooterEditor.tsx | 52 | [key: string]: any; |
| removable-ui-hooks | src/components/letters/LetterBriefDetails.tsx | 76 | const revisionComment = useRevisionComment((editedLetter as any).id, status); |
| removable-ui-hooks | src/components/letters/DIN5008LayoutChrome.tsx | 46 | footerBlocks?: any; |
| removable-ui-hooks | src/components/letters/DIN5008LayoutChrome.tsx | 69 | {sortedBlocks.map((block: any, index: number) => { |
| removable-ui-hooks | src/components/letters/DIN5008LayoutChrome.tsx | 81 | {(block.lines \|\| []).map((line: any, lineIndex: number) => { |
| removable-ui-hooks | src/components/letters/LetterWizard.tsx | 104 | setOccasions(data.map((o: any) => ({ |
| removable-ui-hooks | src/components/letters/LayoutSettingsEditor.tsx | 75 | let current: any = newSettings; |
| removable-ui-hooks | src/components/ContactEditForm.tsx | 261 | updateData.organization_id = null as any; |
| removable-ui-hooks | src/components/ContactEditForm.tsx | 262 | updateData.organization = null as any; |
| removable-ui-hooks | src/components/ContactEditForm.tsx | 344 | const handleChange = (field: string, value: any) => { |
| removable-ui-hooks | src/components/DistrictDetailDialog.tsx | 264 | <Select value={noteForm.priority} onValueChange={(value: any) => setNoteForm({ ...noteForm, priority: value })}> |
| removable-ui-hooks | src/components/DistrictDetailDialog.tsx | 278 | <Select value={noteForm.category} onValueChange={(value: any) => setNoteForm({ ...noteForm, category: value })}> |
| removable-ui-hooks | src/components/employees/EmployeeAdminTable.tsx | 21 | const [history, setHistory] = useState<any[]>([]); |
| removable-ui-hooks | src/components/employees/EmployeeAdminTable.tsx | 245 | <Badge variant="secondary">{vacApproved} von {e.annual_vacation_days + ((e as any).carry_over_days \|\| 0)} Tagen</Badge> |
| removable-ui-hooks | src/components/employees/EmployeeAdminTable.tsx | 246 | {((e as any).carry_over_days \|\| 0) > 0 && ( |
| removable-ui-hooks | src/components/employees/EmployeeAdminTable.tsx | 248 | <span>+{(e as any).carry_over_days} Resturlaub</span> |
| removable-ui-hooks | src/components/employees/EmployeeAdminTable.tsx | 254 | {remainingVacationDays + ((e as any).carry_over_days \|\| 0) > 0 && ( |
| removable-ui-hooks | src/components/employees/EmployeeAdminTable.tsx | 255 | <div className="text-xs text-muted-foreground">{remainingVacationDays + ((e as any).carry_over_days \|\| 0)} verbleibend</div> |
| removable-ui-hooks | src/components/employees/hooks/useEmployeesData.ts | 248 | (supabase.rpc as any)("get_latest_employee_meetings", { p_employee_ids: [user.id] }).maybeSingle(), |
| removable-ui-hooks | src/components/employees/hooks/useEmployeesData.ts | 264 | (leavesRes.data \|\| []).forEach((lr: any) => { |
| removable-ui-hooks | src/components/employees/hooks/useEmployeesData.ts | 274 | } catch (e: any) { |
| removable-ui-hooks | src/components/administration/UserRolesManager.tsx | 95 | } catch (e: any) { |
| removable-ui-hooks | src/components/administration/UserRolesManager.tsx | 186 | } catch (err: any) { |
| removable-ui-hooks | src/components/administration/InformationBlockManager.tsx | 21 | block_data: any; |
| removable-ui-hooks | src/components/administration/PressTemplateManager.tsx | 43 | blockContent: { ...((layout?.blockContent as Record<string, any[]>) \|\| {}) }, |
| removable-ui-hooks | src/components/administration/AutomationRuleVersions.tsx | 63 | .from("automation_rule_versions" as any) |
| removable-ui-hooks | src/components/administration/AutomationRuleVersions.tsx | 90 | } as any) |
| removable-ui-hooks | src/components/administration/AutomationErrorDashboard.tsx | 54 | const ruleIds = [...new Set((runs \|\| []).map((r: any) => r.rule_id))]; |
| removable-ui-hooks | src/components/administration/AutomationErrorDashboard.tsx | 62 | ruleMap = (rules \|\| []).reduce((acc: Record<string, string>, r: any) => { |
| removable-ui-hooks | src/components/administration/AutomationErrorDashboard.tsx | 69 | (runs \|\| []).map((r: any) => ({ |
| removable-ui-hooks | src/components/administration/AutomationRuleImportExport.tsx | 187 | } catch (err: any) { |
| removable-ui-hooks | src/components/administration/AutomationRuleImportExport.tsx | 209 | const { error } = await supabase.from("automation_rules").insert(rows as any); |
| removable-ui-hooks | src/components/VapidKeyTest.tsx | 12 | data?: any; |
| removable-ui-hooks | src/components/administration/ConfigurableTypeSettings.tsx | 137 | const insertData: any = { |
| removable-ui-hooks | src/components/administration/ConfigurableTypeSettings.tsx | 183 | const updateData: any = { |
| removable-ui-hooks | src/components/administration/AutomationRulesManager.tsx | 35 | function parseConditionGroup(raw: any): ConditionGroup { |
| removable-ui-hooks | src/components/administration/AutomationRulesManager.tsx | 139 | () => Array.from(new Set(runs.map((run: any) => String(run.result_payload?.module ?? run.input_payload?.module ?? "unknown")))) as string[], |
| removable-ui-hooks | src/components/administration/AutomationRulesManager.tsx | 143 | () => Array.from(new Set(runs.map((run: any) => String(run.result_payload?.owner_id ?? run.input_payload?.owner_id ?? "unassigned")))) as string[], |
| removable-ui-hooks | src/components/ContactDetailSheet.tsx | 91 | const [activities, setActivities] = useState<any[]>([]); |
| removable-ui-hooks | src/components/calendar/ProperReactBigCalendar.tsx | 42 | format: (date: Date, formatStr: string, options?: any) => |
| removable-ui-hooks | src/components/calendar/ProperReactBigCalendar.tsx | 363 | view={view as any} |
| removable-ui-hooks | src/components/calendar/ProperReactBigCalendar.tsx | 369 | onEventDrop={(args: any) => handleEventDrop(args)} |
| removable-ui-hooks | src/components/calendar/ProperReactBigCalendar.tsx | 370 | onEventResize={(args: any) => handleEventResize(args)} |
| removable-ui-hooks | src/components/calendar/ProperReactBigCalendar.tsx | 371 | eventPropGetter={eventPropGetter as any} |
| removable-ui-hooks | src/components/calendar/EnhancedCalendar.tsx | 18 | resource?: any; |
| removable-ui-hooks | src/components/MeetingArchiveView.tsx | 81 | let publicMeetings: any[] = []; |
| removable-ui-hooks | src/components/appointment-preparations/AppointmentPreparationDataTab.tsx | 210 | visit_reason: (overrides?.visit_reason ?? visitReason) as any, |
| removable-ui-hooks | src/components/appointment-preparations/AppointmentPreparationDataTab.tsx | 344 | debouncedSave(buildPreparationData(editData, { visit_reason: newReason as any })); |
| removable-ui-hooks | src/components/appointment-preparations/AppointmentPreparationDataTab.tsx | 607 | {(field as any).type === "select" ? ( |
| removable-ui-hooks | src/components/appointment-preparations/AppointmentPreparationDataTab.tsx | 633 | ) : (field as any).type === "date" ? ( |
| removable-ui-hooks | src/components/appointment-preparations/AppointmentPreparationDataTab.tsx | 639 | ) : (field as any).multiline ? ( |
| removable-ui-hooks | src/components/DrucksachenView.tsx | 167 | protocols={protocols as any} |
| removable-ui-hooks | src/components/SimpleLeafletMap.tsx | 154 | const geoLayer = L.geoJSON(geoJsonFeatures as any, { |
| removable-ui-hooks | src/components/karlsruhe/RoutingMachine.tsx | 11 | const LRouting = (L as any).Routing; |
| removable-ui-hooks | src/components/karlsruhe/RoutingMachine.tsx | 20 | const routingControlRef = useRef<any>(null); |
| removable-ui-hooks | src/components/karlsruhe/RoutingMachine.tsx | 62 | routingControl.on('routesfound', (e: any) => { |
| removable-ui-hooks | src/components/karlsruhe/KarlsruheDistrictsMap.tsx | 17 | const LRouting = (L as any).Routing; |
| removable-ui-hooks | src/components/EmployeeMeetingScheduler.tsx | 71 | ((currentTenant.settings as any)?.timezone ?? (currentTenant.settings as any)?.time_zone)) \|\| |
| removable-ui-hooks | src/components/StakeholderView.tsx | 69 | let aValue: any, bValue: any; |
| removable-ui-hooks | src/components/contact-import/ImportSteps.tsx | 24 | setDuplicateStrategy: (v: any) => void; |
| removable-ui-hooks | src/components/shared/NoteCard.tsx | 34 | dragHandleProps?: any; |
| removable-ui-hooks | src/components/shared/NoteDecisionCreator.tsx | 131 | let defaultSettings: any = null; |
| removable-ui-hooks | src/components/task-detail/useTaskDetailData.ts | 296 | }] as any).select("id").single(); |
| removable-ui-hooks | src/components/BlackBoard.tsx | 32 | const { data, error } = await (supabase as any) |
| removable-ui-hooks | src/components/BlackBoard.tsx | 44 | .filter((msg: any) => { |
| removable-ui-hooks | src/components/BlackBoard.tsx | 78 | await (supabase as any) |
| removable-ui-hooks | src/components/ContactDetailPanel.tsx | 53 | const [activities, setActivities] = useState<any[]>([]); |
| removable-ui-hooks | src/components/meetings/hooks/useAgendaOperations.ts | 122 | const updateAgendaItem = async (index: number, field: keyof AgendaItem, value: any) => { |
| removable-ui-hooks | src/components/meetings/hooks/useAgendaOperations.ts | 222 | const existingIds = new Set<string>((existingRows \|\| []).map((row: any) => row.id)); |
| removable-ui-hooks | src/components/meetings/hooks/useAgendaOperations.ts | 302 | const addTaskToAgenda = async (task: any, parentItem: AgendaItem, parentIndex: number) => { |
| removable-ui-hooks | src/components/meetings/hooks/useMeetingArchive.ts | 300 | let followUpTask: any = null; |
| removable-ui-hooks | src/components/meetings/hooks/useMeetingArchive.ts | 318 | const childTasksToCreate: any[] = []; |
| removable-ui-hooks | src/components/meetings/hooks/__tests__/useMeetingsData.test.ts | 5 | type QueryResponse = { data: any; error: any }; |
| removable-ui-hooks | src/components/meetings/hooks/__tests__/useMeetingsData.test.ts | 15 | const chain: any = {}; |
| removable-ui-hooks | src/components/meetings/FocusModeView.tsx | 233 | linkedCaseItems.forEach((ci: any, i: number) => { |
| removable-ui-hooks | src/components/AnnualTasksView.tsx | 196 | const completion = completionMap.get(task.id) as any; |
| removable-ui-hooks | src/components/AnnualTasksView.tsx | 260 | selectedTask.execute_function as any, |
| removable-ui-hooks | src/components/AnnualTasksView.tsx | 361 | 'generate_current_year_stats' as any, |
| removable-ui-hooks | src/components/AnnualTasksView.tsx | 390 | 'generate_yearly_stats_for_year' as any, |
| removable-ui-hooks | src/components/CompactStatusSelector.tsx | 40 | onClick={() => quickSetStatus(option.name as any)} |
| removable-ui-hooks | src/components/knowledge/hooks/useKnowledgeData.ts | 117 | return ((data ?? []) as any[]).reduce<Record<string, string>>((acc, p) => { acc[p.user_id] = p.display_name \|\| 'Unbekannt'; return acc; }, {}); |
| removable-ui-hooks | src/components/knowledge/hooks/useKnowledgeData.ts | 179 | const deletedId = (payload.old as any)?.id; |
| removable-ui-hooks | src/components/knowledge/hooks/useKnowledgeData.ts | 228 | const handleSaveDocument = async (topicIds: string[], setTopicsFn: (ids: string[]) => Promise<any>) => { |
| removable-ui-hooks | src/components/knowledge/hooks/useKnowledgeVersionHistory.ts | 46 | nameMap = ((profiles ?? []) as any[]).reduce<Record<string, string>>((acc, p) => { |
| removable-non-adapter | src/features/redaktion/components/Kalenderansicht.tsx | 260 | const handleEventMove = useCallback(async ({ event, start }: { event: CalendarEvent; start: any }) => { |
| removable-ui-hooks | src/components/emails/hooks/useEmailComposer.ts | 259 | const defaultSender = data?.find((s: any) => s.is_default); |
| removable-ui-hooks | src/components/emails/EmailHistory.tsx | 71 | const [scheduledEmails, setScheduledEmails] = useState<any[]>([]); |
| removable-ui-hooks | src/components/emails/EmailTemplateManager.tsx | 25 | variables?: any; |
| removable-ui-hooks | src/components/emails/EmailTemplateManager.tsx | 79 | category: (t as any).category \|\| 'general', |
| removable-ui-hooks | src/components/TenantCollaboration.tsx | 34 | const [availableTenants, setAvailableTenants] = useState<any[]>([]); |
| removable-non-adapter | src/features/redaktion/hooks/useTopicBacklog.ts | 157 | const channelLinks = ((row as any).social_content_item_channels \|\| []) as Array<{ |
| removable-ui-hooks | src/components/task-decisions/DecisionAttachmentPreviewDialog.tsx | 76 | await page.render({ canvasContext: ctx, viewport, canvas } as any).promise; |
| removable-ui-hooks | src/components/press/FeatureImagePicker.tsx | 30 | const [documents, setDocuments] = useState<any[]>([]); |
| removable-ui-hooks | src/components/press/FeatureImagePicker.tsx | 72 | const handleSelectDocument = (doc: any) => { |
| removable-ui-hooks | src/components/press/hooks/usePressReleaseEditor.ts | 25 | content_nodes: any; |
| removable-ui-hooks | src/components/press/pressTemplateConfig.ts | 15 | layout_settings?: any; |
| removable-ui-hooks | src/components/press/pressTemplateConfig.ts | 16 | header_elements?: any[]; |
| removable-ui-hooks | src/components/press/pressTemplateConfig.ts | 17 | footer_elements?: any[]; |
| removable-ui-hooks | src/components/tasks/AssignedItemsSection.tsx | 87 | onTaskEdit: (task: any) => void; |
| removable-ui-hooks | src/components/UserStatusSelector.tsx | 86 | selectedType as any, |
| removable-ui-hooks | src/components/drucksachen/DrucksachenUpload.tsx | 18 | onUploadSuccess: (protocol: any) => void; |
| removable-ui-hooks | src/components/drucksachen/DrucksachenUpload.tsx | 29 | preview?: any; |
| removable-ui-hooks | src/components/drucksachen/DrucksachenUpload.tsx | 182 | let parsedData: { raw_text: string; agendaItems: any[]; speeches: any[]; sessions: any[] } \| null = null; |
| removable-ui-hooks | src/components/drucksachen/DrucksachenUpload.tsx | 183 | let pdfMetadata: any = null; |
| removable-ui-hooks | src/components/drucksachen/ProtocolRawData.tsx | 10 | structuredData: any; |
| removable-ui-hooks | src/components/drucksachen/ProtocolRawData.tsx | 16 | const formatJSON = (obj: any): string => { |
| removable-ui-hooks | src/components/drucksachen/ProtocolPlenaryView.tsx | 14 | structured_data?: any; |
| removable-ui-hooks | src/components/drucksachen/ProtocolPlenaryView.tsx | 19 | structuredData: any; |
| removable-ui-hooks | src/components/drucksachen/ProtocolPlenaryView.tsx | 82 | const renderSpeechContent = (text: string, events_flat: any[] = []) => { |
| removable-ui-hooks | src/components/drucksachen/ProtocolPlenaryView.tsx | 89 | const eventsByLine = new Map<number, any[]>(); |
| removable-ui-hooks | src/components/drucksachen/ProtocolPlenaryView.tsx | 174 | {tocAgenda.map((item: any, idx: number) => ( |
| removable-ui-hooks | src/components/drucksachen/ProtocolPlenaryView.tsx | 224 | {speeches.map((speech: any, idx: number) => { |
| removable-ui-hooks | src/components/drucksachen/ProtocolPlenaryView.tsx | 226 | const agendaItem = tocAgenda.find((item: any) => |
| removable-ui-hooks | src/components/drucksachen/ProtocolSearch.tsx | 205 | <Select value={searchType} onValueChange={(value: any) => setSearchType(value)}> |
| removable-ui-hooks | src/components/drucksachen/ProtocolPreview.tsx | 58 | const variants: Record<string, { label: string; variant: any }> = { |
| removable-ui-hooks | src/components/drucksachen/ProtocolViewer.tsx | 44 | structured_data?: any; |
| removable-ui-hooks | src/components/dashboard/AppointmentFeedbackWidget.tsx | 601 | <Select value={taskPriority} onValueChange={(v: any) => setTaskPriority(v)}> |
| removable-ui-hooks | src/components/dashboard/DashboardCoverImage.tsx | 106 | dashboard_cover_image_attribution: imageAttribution ? (imageAttribution as any) : null, |
| removable-ui-hooks | src/components/dashboard/UnsplashImagePicker.tsx | 268 | <Select value={position} onValueChange={(val: any) => setPosition(val)}> |
| removable-ui-hooks | src/components/dashboard/TodaySchedule.tsx | 93 | const externalEventsResult = await (supabase as any) |
| removable-ui-hooks | src/components/dashboard/TodaySchedule.tsx | 108 | const externalEventsFormatted: Appointment[] = (externalEventsResult.data \|\| []).map((e: any) => ({ |
| removable-ui-hooks | src/components/dashboard/PerformanceMonitor.tsx | 84 | const memory = (performance as any).memory; |
| removable-ui-hooks | src/components/documents/DocumentDialogs.tsx | 25 | documentCategories: any[]; |
| removable-ui-hooks | src/components/documents/DocumentDialogs.tsx | 26 | tags: any[]; |
| removable-ui-hooks | src/components/documents/DocumentDialogs.tsx | 27 | folders: any[]; |
| removable-ui-hooks | src/components/documents/DocumentDialogs.tsx | 154 | document={props.selectedArchivedDocument as any} |
| removable-ui-hooks | src/components/documents/hooks/useDocumentOperations.ts | 10 | user: any; |
| removable-ui-hooks | src/components/documents/hooks/useDocumentOperations.ts | 11 | currentTenant: any; |
| removable-ui-hooks | src/components/documents/hooks/useDocumentOperations.ts | 150 | const handleDeleteFolder = async (folderId: string, folders: any[]) => { |
| removable-ui-hooks | src/components/documents/hooks/useDocumentOperations.ts | 151 | const folder = folders.find((f: any) => f.id === folderId); |
| removable-ui-hooks | src/components/documents/hooks/useDocumentOperations.ts | 200 | const success = await archiveLetter(letter as any); |
| removable-ui-hooks | src/components/documents/types.ts | 31 | archived_attachments?: any[]; |
| removable-ui-hooks | src/components/event-planning/useEventPlanningData.ts | 67 | const [planningTemplates, setPlanningTemplates] = useState<any[]>([]); |
| removable-ui-hooks | src/components/event-planning/useEventPlanningData.ts | 74 | const [availableContacts, setAvailableContacts] = useState<any[]>([]); |
| removable-ui-hooks | src/components/event-planning/useEventPlanningData.ts | 281 | const sortedData = (data \|\| []).sort((a: any, b: any) => { |
| removable-ui-hooks | src/components/event-planning/useEventPlanningData.ts | 514 | await supabase.rpc("create_default_checklist_items", { planning_id: data.id, template_id_param: templateParam } as any); |
| removable-ui-hooks | src/components/event-planning/ChecklistItemEmailDialog.tsx | 63 | const config = data.action_config as any; |
| removable-ui-hooks | src/components/event-planning/types.ts | 161 | checklist_items?: any; |
| removable-ui-hooks | src/components/event-planning/types.ts | 162 | preparation_data?: any; |
| removable-ui-hooks | src/components/event-planning/EventPlanningTable.tsx | 18 | user: any; |
| removable-ui-hooks | src/components/event-planning/EventPlanningTable.tsx | 68 | <UserBadge userId={planning.user_id} displayName={creatorProfile?.display_name \|\| null} badgeColor={(creatorProfile as any)?.badge_color} size="sm" /> |
| removable-ui-hooks | src/components/event-planning/EventPlanningTable.tsx | 75 | const color = (profile as any)?.badge_color \|\| getHashedColor(collab.user_id); |
| removable-ui-hooks | src/components/AppointmentPreparationTemplateAdmin.tsx | 22 | template_data: any[]; |
| removable-ui-hooks | src/components/AppointmentPreparationTemplateAdmin.tsx | 461 | onValueChange={(value: any) => { |
| removable-ui-hooks | src/components/dayslip/DaySlipLexicalEditor.tsx | 93 | topLevel.replace(hrNode as any); |
| removable-ui-hooks | src/components/dayslip/DaySlipLexicalEditor.tsx | 94 | (hrNode as any).insertAfter(newParagraph); |
| removable-ui-hooks | src/components/widgets/QuickNotesWidget.tsx | 154 | const groupedSubtasks: {[taskId: string]: any[]} = {}; |
| removable-ui-hooks | src/components/widgets/QuickNotesWidget.tsx | 239 | setSelectedTask(task as any); |
| removable-ui-hooks | src/components/widgets/QuickNotesWidget.tsx | 394 | task={selectedTask as any} |
| removable-ui-hooks | src/components/widgets/CallLogWidget.tsx | 600 | <Select value={callType} onValueChange={(value) => setCallType(value as any)}> |
| removable-ui-hooks | src/components/widgets/CallLogWidget.tsx | 639 | <Select value={priority} onValueChange={(value) => setPriority(value as any)}> |
| removable-ui-hooks | src/components/widgets/QuickActionsWidget.tsx | 33 | onConfigurationChange?: (config: any) => void; |
| removable-ui-hooks | src/components/widgets/NewsWidget.tsx | 76 | const { data, error } = await Promise.race([fetchPromise, timeoutPromise]) as any; |
| removable-ui-hooks | src/components/events/EventRSVPManager.tsx | 35 | notes_sent: any[]; |
| removable-ui-hooks | src/components/events/EventRSVPManager.tsx | 119 | const [distributionLists, setDistributionLists] = useState<any[]>([]); |
| removable-ui-hooks | src/components/events/EventRSVPManager.tsx | 173 | notes_sent: (r.notes_sent as any[]) ?? [], |
| removable-ui-hooks | src/components/events/EventRSVPManager.tsx | 219 | const addFromContact = (contact: any) => { |
| removable-ui-hooks | src/components/events/EventRSVPManager.tsx | 900 | <Select value={noteTarget} onValueChange={(v: any) => setNoteTarget(v)}> |
| removable-ui-hooks | src/components/timetracking/LeaveRequestsTab.tsx | 39 | vacationBalance: any; |
| removable-ui-hooks | src/components/CalendarView.tsx | 85 | let data: any = null; |
| removable-ui-hooks | src/components/CalendarView.tsx | 86 | let error: any = null; |
| removable-ui-hooks | src/components/CalendarView.tsx | 100 | const allDay = (data as any).all_day \|\| (data as any).is_all_day \|\| false; |
| removable-ui-hooks | src/components/topics/TopicSelector.tsx | 19 | const Icon = (LucideIcons as any)[iconName]; |
| removable-ui-hooks | src/components/TaskArchiveView.tsx | 146 | const responseCounts = ((responses ?? []) as any[]).reduce<Record<string, DecisionResponseCount>>((acc, response: Pick<TaskDecisionResponseRow, 'decision_id' \| 'response_type'>) => { |
| removable-ui-hooks | src/components/EmployeeMeetingRequestDialog.tsx | 81 | <Select value={urgency} onValueChange={(v: any) => setUrgency(v)}> |
| removable-ui-hooks | src/components/my-work/CaseItemMeetingSelector.tsx | 69 | (p: any) => |
| removable-ui-hooks | src/components/my-work/CaseItemMeetingSelector.tsx | 75 | .map((p: any) => p.meetings as Meeting); |
| removable-ui-hooks | src/components/my-work/MyWorkDecisionsTab.tsx | 177 | tenantUsers={tenantUsers as any} |
| removable-ui-hooks | src/components/my-work/cases/workspace/CaseWorkspaceDialogs.tsx | 18 | createCaseItem: (...args: any[]) => any; |
| removable-ui-hooks | src/components/my-work/cases/workspace/CaseItemList.tsx | 48 | getContactName: (payload: any) => string; |
| removable-ui-hooks | src/components/my-work/cases/workspace/CaseItemList.tsx | 49 | getContactDetail: (payload: any) => string; |
| removable-ui-hooks | src/components/my-work/MyWorkExpenseWidget.tsx | 101 | const catMap = new Map<string, any>(cats.map((c: any) => [c.id, c])); |
| removable-ui-hooks | src/components/my-work/MyWorkExpenseWidget.tsx | 159 | } catch (err: any) { |
| removable-ui-hooks | src/components/my-work/decisions/MyWorkDecisionCard.tsx | 256 | <Card ref={highlightRef as any} className={cn("group border-l-4 hover:bg-muted/40 transition-colors cursor-pointer", getBorderColor(summary, decision.response_options, decision.participants), isHighlighted && "notification-highlight")} onClick={() => onOpenDetails(decision.id)}> |
