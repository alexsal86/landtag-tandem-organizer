import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

const strictAuthFlowFiles = [
  'src/hooks/useAuth.tsx',
  'src/hooks/useTenant.tsx',
  'src/components/layout/AppHeader.tsx',
  'src/components/SettingsView.tsx',
  'src/components/account/ActiveSessionsCard.tsx',
  'src/components/administration/SuperadminTenantManagement.tsx',
  'src/pages/Administration.tsx',
  'src/pages/Index.tsx',
];

const strictNotificationsFlowFiles = [
  'src/hooks/useNotifications.tsx',
  'src/hooks/useNavigationNotifications.tsx',
  'src/components/NotificationBell.tsx',
  'src/components/NotificationCenter.tsx',
  'src/components/NotificationSettings.tsx',
  'src/components/Navigation.tsx',
  'src/components/MessageComposer.tsx',
  'src/pages/NotificationsPage.tsx',
  'src/pages/Index.tsx',
];

const strictFlowRules = {
  '@typescript-eslint/no-explicit-any': 'warn',
  '@typescript-eslint/no-unsafe-assignment': 'warn',
  '@typescript-eslint/no-unsafe-member-access': 'warn',
  '@typescript-eslint/no-unsafe-call': 'warn',
};

// Vorbereitung für späteres Hochziehen auf error (Datei-Scopes erst aktivieren,
// sobald Team und CI-Metrik das zulassen).
const preparedExplicitAnyErrorScopes = {
  coreHooks: ['src/hooks/**/*.{ts,tsx}'],
  coreUtils: ['src/utils/**/*.{ts,tsx}'],
  servicesAndFeatures: ['src/services/**/*.{ts,tsx}', 'src/features/**/*.{ts,tsx}'],
};

const enablePreparedExplicitAnyErrorScopes = false;

const hardenedExplicitAnyErrorFiles = [
  'src/services/headerRenderer.ts',
  'src/utils/letterPDFGenerator.ts',
  'src/utils/geoJsonLoader.ts',
  'src/pages/Auth.tsx',
  'src/pages/DecisionResponse.tsx',
  'src/pages/LetterDetail.tsx',
  'src/pages/ContactDetail.tsx',
  'src/pages/CreateContact.tsx',
  'src/pages/EditContact.tsx',
  'src/features/cases/files/components/CaseFileCard.tsx',
  'src/features/cases/files/components/CaseFileDetailHeader.tsx',
  'src/features/cases/files/components/CaseFileRisksOpportunities.tsx',
  'src/features/cases/files/components/CaseFileCreateDialog.tsx',
  'src/features/cases/files/components/CaseFileEditDialog.tsx',
  'src/features/cases/files/components/tabs/CaseFileLettersTab.tsx',
  'src/features/cases/files/components/tabs/CaseFileDocumentsTab.tsx',
  'src/features/cases/files/components/tabs/CaseFileAppointmentsTab.tsx',
  'src/features/cases/files/components/tabs/CaseFileTasksTab.tsx',
];

const explicitAnyErrorPaths = enablePreparedExplicitAnyErrorScopes
  ? [...Object.values(preparedExplicitAnyErrorScopes).flat(), ...hardenedExplicitAnyErrorFiles]
  : hardenedExplicitAnyErrorFiles;

export default [
  { ignores: ['dist'] },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      globals: globals.browser,
      parser: tsParser,
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...tsPlugin.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-undef': 'off',
    },
  },
  {
    files: strictAuthFlowFiles,
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.flow-auth-tenant-strict.json'],
      },
    },
    rules: strictFlowRules,
  },
  {
    files: strictNotificationsFlowFiles,
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.flow-notifications-strict.json'],
      },
    },
    rules: strictFlowRules,
  },
  ...(explicitAnyErrorPaths.length > 0
    ? [
        {
          files: explicitAnyErrorPaths,
          rules: {
            '@typescript-eslint/no-explicit-any': 'error',
          },
        },
      ]
    : []),
];
