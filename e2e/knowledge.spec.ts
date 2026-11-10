import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 1280, height: 960 }, serviceWorkers: 'block' });
test('questions, answers, reviews, private attachments, search, errors and legacy access', async ({ page, context }, info) => {
  const user = { id: '33333333-3333-4333-8333-333333333333', email: 'staff@example.test', aud: 'authenticated', role: 'authenticated', app_metadata: { provider: 'email' }, user_metadata: { display_name: 'Test Mitarbeiter' } };
  const tenant = { id: '11111111-1111-4111-8111-111111111111', name: 'Testbüro', settings: {}, is_active: true, created_at: '2026-01-01T00:00:00Z' };
  type Question = { id: string; title: string; description: string; tenant_id: string; assigned_to: string | null; created_by: string; updated_by: string; created_at: string; updated_at: string; answer_content: unknown; answer_text: string; answered_by: string | null; answered_at: string | null; answer_updated_at: string | null; revision: number; answer_revision: number; review_status: string; verified_at: string | null; verified_by: string | null; verified_answer_revision: number | null; review_due_at: string | null };
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
    if (path.endsWith('/auth/v1/user')) data = user;
    else if (path.includes('/rpc/')) {
      const name = path.split('/').pop(); const body = request.postDataJSON() ?? {};
      if (name === 'knowledge_qa_list') {
        if (failSearch) return json({ code: 'TEST', message: 'Test query failure' }, 500);
        const filtered = questions.filter(question => body.p_question ? question.id === body.p_question :
          (body.p_view === 'open' ? !question.answered_at : body.p_view === 'mine' || Boolean(question.answered_at)) &&
          `${question.title} ${question.answer_text}`.toLowerCase().includes(String(body.p_query ?? '').toLowerCase()));
        data = [{ items: filtered.slice(0,body.p_limit ?? 20).map(question => {
          const { answer_content, answer_text, ...summary } = question;
          return { ...summary, answer_excerpt: answer_text.slice(0,200), server_now: new Date().toISOString(), effective_review_status: question.review_status };
        }), total_count: filtered.length, next_cursor: null }];
      } else if (name === 'knowledge_qa_counts') {
        data = [{ answers: questions.filter(q=>q.answered_at).length, open: questions.filter(q=>!q.answered_at).length, mine: questions.length, assigned: questions.filter(q=>q.assigned_to===user.id).length, review: questions.filter(q=>q.review_status==='needs_review').length }];
      } else if (name === 'knowledge_qa_create_question') {
        const time = new Date().toISOString();
        const question: Question = { id: '77777777-7777-4777-8777-777777777777', title: body.p_title, description: body.p_description, tenant_id: tenant.id, assigned_to: body.p_assigned_to || null,
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
      const profile = { id: 'profile', user_id: user.id, display_name: 'Test Mitarbeiter', tenant_id: tenant.id, avatar_url: null }; data = single ? profile : [profile];
    } else if (path.endsWith('/tenants')) data = single ? tenant : [tenant];
    else if (path.endsWith('/user_onboarding_state')) data = { completed_at: '2026-01-01T00:00:00Z' };
    else if (path.endsWith('/knowledge_question_attachments')) data = attachments.filter(file => file.state === 'ready');
    else if (path.includes('/storage/v1/object/knowledge-attachments/')) data = { Key: path.split('/object/')[1], Id: 'file' };
    else if (path.endsWith('/knowledge_question_cards')) {
      const rows=questions.filter(q=>!url.searchParams.get('id') || url.searchParams.get('id')===`eq.${q.id}`).map(q=>({ ...q, server_now: new Date().toISOString(), effective_review_status:q.review_status }));
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
  await page.goto('/wissen');
  await expect(page.getByRole('heading', { name: 'Wissen', exact: true })).toBeVisible();
  await expect(page.getByPlaceholder('Was möchtest du wissen?')).toBeVisible();
  await page.getByRole('button', { name: 'Frage stellen', exact: true }).first().click();
  await page.getByRole('textbox', { name: 'Frage', exact: true }).fill('Wie beantrage ich Urlaub?');
  await page.getByRole('dialog').getByRole('button', { name: 'Frage stellen', exact: true }).click();
  await expect(page.getByText('Offene Frage', { exact: true })).toBeVisible();
  expect(questions[0].assigned_to).toBeNull();
  await page.getByRole('button', { name: 'Beantworten', exact: true }).click();
  const editor = page.locator('[contenteditable="true"][aria-label="Antwort"]');
  await editor.fill('Bitte den Antrag an die Büroleitung senden.');
  conflict = true;
  await page.getByRole('button', { name: 'Antwort speichern', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('inzwischen geändert');
  await expect(editor).toContainText('Bitte den Antrag');
  await page.getByRole('button', { name: 'Antwort speichern', exact: true }).click();
  await expect(page.locator('div.rounded-full').getByText('Ungeprüft', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Als aktuell geprüft markieren' }).click();
  await page.getByRole('button', { name: 'Aktualität bestätigen' }).click();
  await expect(page.getByText('Geprüft', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Antwort bearbeiten' }).click();
  await editor.fill('Bitte den Antrag mit Datum an die Büroleitung senden.');
  await page.getByRole('button', { name: 'Antwort speichern', exact: true }).click();
  await expect(page.locator('div.rounded-full').getByText('Ungeprüft', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Überprüfung anfordern', exact: true }).click();
  await expect(page.getByText('Überprüfung erforderlich', { exact: true })).toBeVisible();
  await page.getByLabel('Datei anhängen', { exact: true }).setInputFiles({ name: 'ablauf.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 test') });
  await expect(page.getByText('ablauf.pdf', { exact: true })).toBeVisible();
  await expect(page.locator('div.rounded-full').getByText('Ungeprüft', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '← Zur Übersicht' }).click();
  await page.getByRole('button', { name: /^Antworten/ }).click();
  const search = page.getByRole('textbox', { name: 'Wissen durchsuchen' });
  await search.fill('Urlaub');
  await expect(page.getByText('Bitte den Antrag mit Datum an die Büroleitung senden.', { exact: true })).toBeVisible();
  await expect(page.locator('[contenteditable]')).toHaveCount(0);
  await page.getByRole('button',{name:'Vollständig anzeigen',exact:true}).click();
  await expect(page.getByRole('button',{name:'Antwort bearbeiten'})).toBeVisible();
  await page.screenshot({ path: info.outputPath('wissen-desktop.png'), fullPage: true });
  await search.fill('Unbekannte Richtlinie');
  await page.getByRole('button', { name: 'Diese Frage stellen' }).click();
  await expect(page.getByRole('textbox', { name: 'Frage', exact: true })).toHaveValue('Unbekannte Richtlinie');
  await page.getByRole('button', { name: 'Abbrechen', exact: true }).click();
  failSearch = true; await search.fill('Suchfehler');
  await expect(page.getByRole('alert')).toContainText('Wissen konnte nicht geladen werden');
  await expect(page.getByText('Keine passenden Antworten gefunden')).toHaveCount(0);
  failSearch = false; await search.fill('');
  await expect(page.getByRole('heading', { name: 'Wie beantrage ich Urlaub?' })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: info.outputPath('wissen-mobile.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('link', { name: 'Bisheriger Wissensbereich' }).click();
  await expect(page.getByText('Mein Radar', { exact: true })).toBeVisible();
  await page.goto('/knowledge'); await expect(page.getByRole('heading', { name: 'Wissensdatenbank', exact: true })).toBeVisible();
  expect(requests.some(path => /embedding|openai|summar|ai-client/.test(path))).toBe(false);
  expect(requests.some(path => path.includes('/storage/v1/object/public/knowledge-attachments'))).toBe(false);
  expect(errors).toEqual([]);
});
