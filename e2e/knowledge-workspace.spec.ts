import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 1280, height: 960 }, serviceWorkers: 'block' });
test('knowledge panel: focus, Escape, share URL, shortcut, compact list and one list request', async ({ page, context }, info) => {
  const user = { id: '33333333-3333-4333-8333-333333333333', email: 'staff@example.test', aud: 'authenticated', role: 'authenticated', app_metadata: { provider: 'email' }, user_metadata: { display_name: 'Test Mitarbeiter' } };
  const tenant = { id: '11111111-1111-4111-8111-111111111111', name: 'Testbüro', settings: {}, is_active: true, created_at: '2026-01-01T00:00:00Z' };
  type Question = { id: string; title: string; description: string; tenant_id: string; assigned_to: string | null; created_by: string; updated_by: string; created_at: string; updated_at: string; answer_content: unknown; answer_text: string; answered_by: string | null; answered_at: string | null; answer_updated_at: string | null; revision: number; answer_revision: number; review_status: string; verified_at: string | null; verified_by: string | null; verified_answer_revision: number | null; review_due_at: string | null; archived_at?: string | null; merged_into?: string | null };
  const avatarUrl='https://wawofclbehbkebjivdte.supabase.co/storage/v1/object/public/avatars/test.png';
  const personFor=(id: string | null) => id ? { user_id: id, display_name: 'Test Mitarbeiter', avatar_url: avatarUrl } : null;
  const peopleFor=(question: Question) => ({ created_by_person: personFor(question.created_by), assigned_to_person: personFor(question.assigned_to), verified_by_person: personFor(question.verified_by) });
  const questions: Question[] = [];
  const attachments: Array<{ id: string; question_id: string; tenant_id: string; state: string; file_name: string; storage_path: string; file_type: string; file_size: number; uploaded_by: string; created_at: string }> = [];
  const requests: string[] = [];
  const errors: string[] = [];
  let failSearch = false, conflict = false;
  page.on('pageerror', error => errors.push(error.message));
  await context.route('https://wawofclbehbkebjivdte.supabase.co/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname;
    requests.push(path);
    const single = request.headers().accept?.includes('object+json');
    let data: unknown = single ? null : [];
    const json = (value: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) });
    if (path.endsWith('/avatars/test.png')) return route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lK0AAAAASUVORK5CYII=','base64')});
    if (path.endsWith('/auth/v1/user')) data = user;
    else if (path.includes('/rpc/')) {
      const name = path.split('/').pop(); const body = request.postDataJSON() ?? {};
      if (name === 'knowledge_qa_list') {
        if (failSearch) return json({ code: 'TEST', message: 'Test query failure' }, 500);
        const filtered = questions.filter(question => !question.archived_at && (body.p_question ? question.id === body.p_question :
          (body.p_view === 'open' ? !question.answered_at : body.p_view === 'mine' || Boolean(question.answered_at)) &&
          `${question.title} ${question.answer_text}`.toLowerCase().includes(String(body.p_query ?? '').toLowerCase())));
        data = [{ items: filtered.slice(0,body.p_limit ?? 20).map(question => {
          const { answer_content, answer_text, ...summary } = question;
          return { ...summary, ...peopleFor(question), tags:[{id:'tag-a',name:'Urlaub'},{id:'tag-b',name:'Büro'},{id:'tag-c',name:'Team'}], answer_excerpt: answer_text.slice(0,200), server_now: new Date().toISOString(), effective_review_status: question.review_status };
        }), total_count: filtered.length, next_cursor: null, counts:{answers:1,open:1,mine:2,assigned:2,review:1}, topics:[] }];
      } else if (name === 'knowledge_qa_counts') {
        data = [{ answers: questions.filter(q=>q.answered_at).length, open: questions.filter(q=>!q.answered_at).length, mine: questions.length, assigned: questions.filter(q=>q.assigned_to===user.id).length, review: questions.filter(q=>q.review_status==='needs_review').length }];
      } else if (name === 'knowledge_qa_create_question') {
        const time = new Date().toISOString();
        const question: Question = { id: `77777777-7777-4777-8777-${777777777777 + questions.length}`, title: body.p_title, description: body.p_description, tenant_id: tenant.id, assigned_to: body.p_assigned_to || null,
          created_by: user.id, updated_by: user.id, created_at: time, updated_at: time, answer_content: null, answer_text: '', answered_at: null, answered_by: null, answer_updated_at: null,
          revision: 1, answer_revision: 0, review_status: 'unverified', verified_at: null, verified_by: null, verified_answer_revision: null, review_due_at: null };
        questions.push(question); data = question;
      } else if (name === 'knowledge_qa_reserve_attachment') {
        const file = { id: '88888888-8888-4888-8888-888888888888', question_id: body.p_question, tenant_id: tenant.id, state: 'pending', file_name: body.p_name,
          storage_path: `${tenant.id}/${body.p_question}/88888888-8888-4888-8888-888888888888`, file_type: body.p_type, file_size: body.p_size, uploaded_by: user.id, created_at: new Date().toISOString() };
        attachments.push(file); data = file;
      } else if (name?.startsWith('knowledge_qa_')) {
        const question = questions.find(item => item.id === (body.p_question ?? attachments.find(file => file.id === body.p_attachment)?.question_id))!;
        if (conflict || body.p_expected_revision !== question.revision) { conflict = false; return json({ code: '40001', message: 'Die Frage wurde inzwischen geändert. Bitte neu laden.' }, 409); }
        if (name === 'knowledge_qa_save_answer') {
          const text = (node: { text?: string; children?: unknown[] }): string => node.text ?? node.children?.map(child => text(child as typeof node)).join('') ?? '';
          question.answer_content = body.p_content; question.answer_text = text(body.p_content.root); question.answered_by = user.id; question.answered_at = new Date().toISOString(); question.answer_updated_at = question.answered_at;
          question.answer_revision++; question.review_status = 'unverified'; question.verified_at = null; question.verified_by = null;
        } else if (name === 'knowledge_qa_review') {
          question.review_status = body.p_verified ? 'verified' : 'needs_review'; question.verified_at = body.p_verified ? new Date().toISOString() : null; question.verified_by = body.p_verified ? user.id : null;
          question.verified_answer_revision = body.p_verified ? question.answer_revision : null; question.review_due_at = body.p_due_at ?? null;
        } else if (name === 'knowledge_qa_manage') {
          if (body.p_action === 'edit') { question.title = body.p_title; question.description = body.p_description; }
          else { question.archived_at = new Date().toISOString(); question.merged_into = body.p_target ?? null; }
        } else if (name === 'knowledge_qa_set_assignee') question.assigned_to = body.p_assigned_to;
        else if (name === 'knowledge_qa_finish_attachment') {
          attachments.find(file => file.id === body.p_attachment)!.state = body.p_remove ? 'removed' : 'ready';
          question.answer_revision++; question.review_status = 'unverified'; question.verified_at = null; question.verified_by = null;
        }
        question.revision++; data = question;
      } else if (['is_admin', 'has_role', 'is_superadmin'].includes(name ?? '')) data = false;
      else if (name === 'is_tenant_action_allowed') data = true;
    } else if (path.endsWith('/user_tenant_memberships')) {
      const membership = { id: 'membership', user_id: user.id, tenant_id: tenant.id, role: 'mitarbeiter', is_active: true, tenant }; data = single ? membership : [membership];
    } else if (path.endsWith('/profiles')) {
      const profile = { id: 'profile', user_id: user.id, display_name: 'Test Mitarbeiter', tenant_id: tenant.id, avatar_url: avatarUrl }; data = single ? profile : [profile];
    } else if (path.endsWith('/tenants')) data = single ? tenant : [tenant];
    else if (path.endsWith('/user_onboarding_state')) data = { completed_at: '2026-01-01T00:00:00Z' };
    else if (path.endsWith('/knowledge_tags') || path.endsWith('/knowledge_question_sources') || path.endsWith('/knowledge_question_comment_cards') || path.endsWith('/knowledge_question_followers')) data = single ? null : [];
    else if (path.endsWith('/knowledge_question_attachments')) data = attachments.filter(file => file.state === 'ready');
    else if (path.includes('/storage/v1/object/knowledge-attachments/')) data = { Key: path.split('/object/')[1], Id: 'file' };
    else if (path.endsWith('/knowledge_question_cards')) {
      const rows=questions.filter(q=>!url.searchParams.get('id') || url.searchParams.get('id')===`eq.${q.id}`).map(q=>({ ...q, ...peopleFor(q), tags:[], server_now: new Date().toISOString(), effective_review_status:q.review_status }));
      data=single ? rows[0] ?? null : rows;
    }
    else if (path.endsWith('/knowledge_questions')) data = single ? questions[0] : questions;
    else if (path.endsWith('/knowledge_documents')) data = [];
    else if (path.includes('/functions/v1/')) data = { success: true, users: [] };
    return json(data);
  });
  await context.route('https://**/*', route => route.request().url().includes('wawofclbehbkebjivdte.supabase.co') ? route.fallback() : route.abort());
  await context.addInitScript(({ user }) => {
    const payload = btoa(JSON.stringify({ sub: user.id, aud: 'authenticated', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 }));
    localStorage.setItem('sb-wawofclbehbkebjivdte-auth-token', JSON.stringify({ access_token: `eyJhbGciOiJIUzI1NiJ9.${payload}.synthetic`, refresh_token: 'synthetic', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user }));
  }, { user });

  const time=new Date().toISOString();
  const person={user_id:user.id,display_name:'Test Mitarbeiter',avatar_url:null};
  const common={description:'Kontext für die Frage',tenant_id:tenant.id,assigned_to:user.id,created_by:user.id,updated_by:user.id,created_at:new Date(Date.now()-9*86400000).toISOString(),updated_at:time,answer_content:null,answer_text:'Bitte den Antrag mit Datum senden.',answered_at:time,answered_by:user.id,answer_updated_at:new Date(Date.now()-3600000).toISOString(),revision:1,answer_revision:1,review_status:'needs_review',verified_at:null,verified_by:null,verified_answer_revision:null,review_due_at:null};
  questions.push({...common,id:'77777777-7777-4777-8777-777777777777',title:'Wie beantrage ich Urlaub?'});
  questions.push({...common,id:'77777777-7777-4777-8777-777777777778',title:'Offene Rückfrage',answered_at:null,answered_by:null,answer_revision:0,answer_text:''});

  await page.goto('/wissen');
  const search=page.getByRole('textbox',{name:'Wissen durchsuchen'});
  await expect(page.getByRole('button',{name:/Wie beantrage ich Urlaub/})).toBeVisible();
  await page.keyboard.press('/'); await expect(search).toBeFocused();
  await search.fill('Urlaub');
  const row=page.getByRole('button',{name:/Wie beantrage ich Urlaub/});
  await expect(row).toBeVisible();
  await expect(row.locator('button')).toHaveCount(0);
  await expect(page.locator('[contenteditable]')).toHaveCount(0);
  await expect(row).toContainText('+1');
  const listRequests=requests.filter(path=>path.endsWith('/rpc/knowledge_qa_list')).length;
  await row.focus(); await row.press('Enter');
  const panel=page.getByRole('dialog',{name:'Wie beantrage ich Urlaub?'});
  await expect(panel).toBeVisible(); await expect(panel).toHaveAttribute('aria-modal','true');
  await expect(page).toHaveURL(/frage=77777777/);
  await expect(panel.getByRole('button',{name:'Als aktuell geprüft markieren',exact:true})).toBeVisible();
  await panel.getByRole('button',{name:'Als aktuell geprüft markieren',exact:true}).click();
  const review=page.getByRole('dialog',{name:'Aktualität bestätigen',exact:true});
  await expect(review).toBeVisible(); await expect(review.getByText('Keine Quelle angegeben')).toBeVisible();
  await expect(review.getByLabel('Erneut prüfen am (optional)')).toBeVisible();
  await expect(review.getByRole('button',{name:'Aktualität bestätigen',exact:true})).toBeEnabled();
  await page.keyboard.press('Escape'); await expect(review).not.toBeVisible(); await expect(panel).toBeVisible();
  await expect(panel.getByLabel('Tag hinzufügen')).toBeVisible();

  for(let i=0;i<25;i++) { await page.keyboard.press('Tab'); expect(await panel.evaluate(node=>node.contains(document.activeElement))).toBe(true); }
  await page.keyboard.press('Shift+Tab'); expect(await panel.evaluate(node=>node.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape'); await expect(panel).not.toBeVisible(); await expect(row).toBeFocused();
  expect(requests.filter(path=>path.endsWith('/rpc/knowledge_qa_list')).length).toBe(listRequests);
  expect(requests.filter(path=>path.endsWith('/rpc/knowledge_qa_counts')).length).toBe(0);
  await page.setViewportSize({width:390,height:844});
  await expect(row.locator('[class*="rowExcerpt"]')).not.toBeVisible();
  await expect(row.locator('[class*="rowTags"]')).not.toBeVisible();
  await row.click(); await expect(panel).toHaveCSS('width','390px');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.keyboard.press('Escape'); await expect(row).toBeFocused();
  await search.fill('Neue konkrete Frage');
  await page.getByRole('button',{name:/Neue konkrete Frage.*als Frage stellen/}).click();
  const input=page.getByRole('dialog').getByRole('textbox',{name:'Frage',exact:true});
  await expect(input).toHaveValue('Neue konkrete Frage'); await input.press('/');
  await expect(input).toHaveValue('Neue konkrete Frage/');
  await page.keyboard.press('Escape');
  await page.goto('/wissen?frage=77777777-7777-4777-8777-777777777777');
  await expect(panel).toBeVisible(); await expect(panel.getByRole('button',{name:'Link kopieren'})).toBeVisible();
  await page.keyboard.press('Escape'); await expect(search).toBeFocused();
  expect(errors).toEqual([]);
});
