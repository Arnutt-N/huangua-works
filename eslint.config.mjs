/* eslint.config.mjs — flat config (Next.js 16, ESLint 9)
 *
 * import eslint-config-next/core-web-vitals flat array ตรงๆ (ไม่ใช้ FlatCompat)
 * เพราะ FlatCompat + eslint 9.39 + eslint-config-next 16 = circular JSON bug
 * (ConfigValidator.formatErrors stringify ปิดวง plugin 'react')
 *
 * - core-web-vitals รวม next core + react-hooks + jsx-a11y plugin
 * - C3: บล็อก import lib/supabase/admin.ts (service_role) นอก /api/cron/* หรือ Node runtime
 * - M-A5: jsx-a11y บังคับ control-has-associated-label + interactive
 */
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';

const nextFlat = Array.isArray(nextCoreWebVitals)
  ? nextCoreWebVitals
  : nextCoreWebVitals.default;

const config = [
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'storybook-static/**',
      'dist/**',
      'coverage/**',
      'playwright-report/**',
      'playwright/.cache/**',
      '**/*.stories.tsx',
      '**/*.story.tsx',
      'install.log',
    ],
  },
  ...nextFlat,
  {
    rules: {
      // C3 — service_role ต้องอยู่ใน /api/cron/* หรือ Node runtime routes เท่านั้น
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/lib/supabase/admin'],
              message:
                'C3: SUPABASE_SERVICE_ROLE_KEY ห้าม import ใน client/edge — ใช้ได้ใน /api/cron/* หรือ Node runtime routes เท่านั้น (RLS bypass risk)',
            },
          ],
        },
      ],
      // M-A5 — a11y (jsx-a11y plugin มาจาก core-web-vitals)
      'jsx-a11y/control-has-associated-label': 'error',
      'jsx-a11y/no-autofocus': 'error',
      'jsx-a11y/click-events-have-key-events': 'error',
      'jsx-a11y/no-static-element-interactions': 'error',
      'jsx-a11y/interactive-supports-focus': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    // CLI scripts / config files: console.log + anonymous default export ใช้ได้
    files: ['scripts/**/*.{ts,mts,js,mjs}', '*.config.{js,mjs,ts}', 'postcss.config.js'],
    rules: {
      'no-console': 'off',
      'import/no-anonymous-default-export': 'off',
    },
  },
];

export default config;