#!/usr/bin/env node
import { execSync } from 'node:child_process';

const FLOW_SCOPES = {
  'auth-tenant': [
    'src/hooks/useAuth.tsx',
    'src/hooks/useTenant.tsx',
    'src/pages/Administration.tsx',
    'src/pages/Index.tsx',
    'src/components/layout/AppHeader.tsx',
    'src/components/SettingsView.tsx',
    'src/components/account/ActiveSessionsCard.tsx',
    'src/components/administration/SuperadminTenantManagement.tsx',
  ],
  'calendar-sync': [
    'src/components/calendar/hooks/useCalendarData.ts',
    'src/components/ExternalCalendarSettings.tsx',
    'src/components/CalendarSyncDebug.tsx',
    'src/components/SettingsView.tsx',
    'src/components/administration/CalendarSyncSettings.tsx',
  ],
  'letter-workflow': [
    'src/hooks/useLetterArchiving.tsx',
    'src/features/cases/files/hooks/useCaseFileDetails.tsx',
    'src/features/cases/files/components/tabs/CaseFileLettersTab.tsx',
    'src/components/LettersView.tsx',
    'src/components/LetterEditor.tsx',
    'src/components/LetterTemplateSelector.tsx',
    'src/components/letters/LetterWizard.tsx',
    'src/components/letters/LetterAttachmentManager.tsx',
  ],
  notifications: [
    'src/hooks/useNotifications.tsx',
    'src/hooks/useNavigationNotifications.tsx',
    'src/pages/NotificationsPage.tsx',
    'src/pages/Index.tsx',
    'src/components/NotificationBell.tsx',
    'src/components/NotificationCenter.tsx',
    'src/components/NotificationSettings.tsx',
    'src/components/Navigation.tsx',
    'src/components/MessageComposer.tsx',
  ],
  'edge-auth-role-tenant': [
    'src/hooks/useAuth.tsx',
    'src/hooks/useTenant.tsx',
    'src/features/matrix-widget/api.ts',
    'src/features/matrix-widget/MatrixWebsiteWidget.tsx',
    'src/features/matrix-widget/types.ts',
    'src/pages/Administration.tsx',
    'src/components/layout/AppHeader.tsx',
    'src/components/Navigation.tsx',
    'src/components/administration/SuperadminTenantManagement.tsx',
    'src/components/administration/UserRolesManager.tsx',
  ],
};

const flow = process.argv[2];
if (!flow || !FLOW_SCOPES[flow]) {
  console.error('Usage: node scripts/any-report-flow.mjs <flow>');
  console.error(`Available flows: ${Object.keys(FLOW_SCOPES).join(', ')}`);
  process.exit(1);
}

const files = FLOW_SCOPES[flow];
const pattern = String.raw`\bany\b|as any|<any>|: any`;
const quotedFiles = files.map((file) => `'${file}'`).join(' ');

let output = '';
try {
  output = execSync(
    `rg -n --no-heading --pcre2 "${pattern}" ${quotedFiles}`,
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
} catch (error) {
  output = error.stdout?.toString() ?? '';
}

const lines = output
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean);

console.log(`Flow: ${flow}`);
console.log(`Scope files: ${files.length}`);
console.log(`Any matches: ${lines.length}`);

if (lines.length > 0) {
  console.log('\nMatches:');
  for (const line of lines) {
    console.log(`- ${line}`);
  }
}
