-- Insert three professional parliamentary letter templates

-- Template 1: Official Parliamentary Letter
INSERT INTO letter_templates (
  id,
  tenant_id,
  created_by,
  name,
  letterhead_html,
  letterhead_css,
  response_time_days,
  is_default,
  is_active
) VALUES (
  gen_random_uuid(),
  (SELECT id FROM tenants LIMIT 1), -- Will be updated to use proper tenant in code
  (SELECT id FROM auth.users LIMIT 1), -- Will be updated to use proper user in code
  'Offizieller Parlamentsbrief',
  '<div class="parliamentary-header">
    <div class="logo-section">
      <div class="parliament-logo"></div>
      <div class="member-info">
        <h1>Dr. Max Mustermann</h1>
        <h2>Mitglied des Deutschen Bundestages</h2>
        <p class="constituency">Wahlkreis 001 • Musterstadt</p>
      </div>
    </div>
    <div class="contact-info">
      <div class="address">
        <strong>Berliner Büro:</strong><br>
        Platz der Republik 1<br>
        11011 Berlin
      </div>
      <div class="contact">
        <strong>Kontakt:</strong><br>
        Tel: +49 30 227-12345<br>
        max.mustermann@bundestag.de
      </div>
    </div>
  </div>',
  '.parliamentary-header {
    border-bottom: 3px solid #000080;
    padding: 20px 0;
    margin-bottom: 30px;
  }
  .logo-section {
    display: flex;
    align-items: center;
    margin-bottom: 15px;
  }
  .parliament-logo {
    width: 60px;
    height: 60px;
    background: url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMjgiIGZpbGw9IiMwMDAwODAiLz4KPHN2ZyB4PSIxNSIgeT0iMTUiIHdpZHRoPSIzMCIgaGVpZ2h0PSIzMCIgdmlld0JveD0iMCAwIDMwIDMwIiBmaWxsPSJ3aGl0ZSI+CjxyZWN0IHg9IjIiIHk9IjE1IiB3aWR0aD0iMjYiIGhlaWdodD0iMTAiLz4KPHN2Zz4KPC9zdmc+") no-repeat center;
    background-size: contain;
    margin-right: 20px;
  }
  .member-info h1 {
    margin: 0;
    font-size: 24px;
    font-weight: bold;
    color: #000080;
  }
  .member-info h2 {
    margin: 5px 0;
    font-size: 16px;
    font-weight: normal;
    color: #333;
  }
  .constituency {
    margin: 0;
    font-size: 14px;
    color: #666;
  }
  .contact-info {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    color: #555;
  }
  .contact-info strong {
    color: #000080;
  }',
  21,
  false,
  true
);

-- Template 2: Constituent Response Letter
INSERT INTO letter_templates (
  id,
  tenant_id,
  created_by,
  name,
  letterhead_html,
  letterhead_css,
  response_time_days,
  is_default,
  is_active
) VALUES (
  gen_random_uuid(),
  (SELECT id FROM tenants LIMIT 1),
  (SELECT id FROM auth.users LIMIT 1),
  'Bürgeranfrage Antwort',
  '<div class="citizen-response-header">
    <div class="header-top">
      <div class="parliament-seal">🏛️</div>
      <div class="title-section">
        <h1>Deutscher Bundestag</h1>
        <h2>Dr. Max Mustermann, MdB</h2>
        <p>Ordentliches Mitglied im Ausschuss für [Ausschuss]</p>
      </div>
    </div>
    <div class="reference-line">
      <span>Ihr Schreiben vom: ___________</span>
      <span>Unser Zeichen: MM-2024-___</span>
    </div>
  </div>',
  '.citizen-response-header {
    border: 2px solid #D4AF37;
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 25px;
    background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
  }
  .header-top {
    display: flex;
    align-items: center;
    margin-bottom: 15px;
  }
  .parliament-seal {
    font-size: 48px;
    margin-right: 20px;
  }
  .title-section h1 {
    margin: 0;
    font-size: 20px;
    color: #000080;
    font-weight: bold;
  }
  .title-section h2 {
    margin: 5px 0;
    font-size: 18px;
    color: #333;
    font-weight: normal;
  }
  .title-section p {
    margin: 0;
    font-size: 12px;
    color: #666;
    font-style: italic;
  }
  .reference-line {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: #555;
    border-top: 1px solid #ddd;
    padding-top: 10px;
  }',
  14,
  false,
  true
);

-- Template 3: Press Release / Public Statement
INSERT INTO letter_templates (
  id,
  tenant_id,
  created_by,
  name,
  letterhead_html,
  letterhead_css,
  response_time_days,
  is_default,
  is_active
) VALUES (
  gen_random_uuid(),
  (SELECT id FROM tenants LIMIT 1),
  (SELECT id FROM auth.users LIMIT 1),
  'Pressemitteilung / Stellungnahme',
  '<div class="press-header">
    <div class="press-banner">
      <div class="press-label">PRESSEMITTEILUNG</div>
      <div class="date-section">Berlin, den __________</div>
    </div>
    <div class="member-section">
      <div class="member-details">
        <h1>Dr. Max Mustermann</h1>
        <h2>Mitglied des Deutschen Bundestages</h2>
        <div class="functions">
          <span class="function">Stellv. Vorsitzender im Ausschuss für [Ausschuss]</span>
          <span class="function">Sprecher für [Themenbereich]</span>
        </div>
      </div>
      <div class="press-contact">
        <strong>Pressekontakt:</strong><br>
        Name: ____________<br>
        Tel: +49 30 227-_____<br>
        E-Mail: presse@bundestag.de
      </div>
    </div>
  </div>',
  '.press-header {
    border-left: 5px solid #DC143C;
    padding-left: 20px;
    margin-bottom: 30px;
  }
  .press-banner {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding: 10px 0;
    border-bottom: 2px solid #DC143C;
  }
  .press-label {
    font-size: 20px;
    font-weight: bold;
    color: #DC143C;
    letter-spacing: 2px;
  }
  .date-section {
    font-size: 14px;
    color: #666;
    font-style: italic;
  }
  .member-section {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  .member-details h1 {
    margin: 0;
    font-size: 24px;
    color: #000080;
    font-weight: bold;
  }
  .member-details h2 {
    margin: 5px 0 10px 0;
    font-size: 16px;
    color: #333;
    font-weight: normal;
  }
  .functions {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .function {
    font-size: 12px;
    color: #555;
    padding: 2px 8px;
    background: #f0f0f0;
    border-radius: 12px;
    white-space: nowrap;
  }
  .press-contact {
    font-size: 11px;
    color: #666;
    text-align: right;
    background: #f8f9fa;
    padding: 10px;
    border-radius: 4px;
  }
  .press-contact strong {
    color: #DC143C;
  }'
  7,
  false,
  true
);