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
      /* สีต้องมาจาก token เท่านั้น — ห้ามเขียนค่า oklch ดิบใน .ts/.tsx
       *
       * § ที่มา: PR #55 เปลี่ยน palette แล้วต้องไล่แก้ค่าดิบ 76 จุดด้วยมือ หลังจากนั้น
       * ยังพบตกค้างอีกหลายรอบ (favicon, ปุ่มในอีเมล, พื้นหลัง Storybook) และค่าที่ค้าง
       * จากก่อนแก้ contrast ทำให้ขอบปุ่มตกเกณฑ์ WCAG โดยไม่มีอะไรจับได้
       * check-contrast.ts อ่านเฉพาะ tokens.css จึงมองไม่เห็นค่าที่เขียนใน style={{}}
       *
       * § ใช้ /oklch/ ไม่ใช่ /oklch\(/ — ใน .mjs backslash จะถูกกลืน ทำให้ esquery
       * สร้าง new RegExp('oklch(') แล้ว crash ทั้ง lint run
       *
       * § ต้องมีสอง selector — TemplateLiteral ไม่ใช่ Literal node
       * comment ไม่ใช่ AST node จึงไม่โดนจับ (มี comment ที่มีคำนี้จริงใน schema.ts)
       */
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/oklch/]',
          message:
            'ห้ามเขียนค่าสีดิบ — ใช้ token/utility แทน (bg-accent, text-accent-strong, border-border ฯลฯ ดู DESIGN.md §2) ถ้าจำเป็นต้องใช้ค่าดิบจริง เช่นสีขาวโปร่งที่ token แทนไม่ได้ ให้เขียน comment อธิบายแล้วเพิ่มไฟล์ลง allowlist ใน eslint.config.mjs',
        },
        {
          selector: 'TemplateElement[value.raw=/oklch/]',
          message:
            'ห้ามเขียนค่าสีดิบใน template literal — ใช้ token/utility แทน (ดู DESIGN.md §2)',
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
      /* § allowlist ค่าสีดิบใน scripts/
       * - check-contrast.ts ต้อง parse สตริง oklch เป็นหน้าที่หลักของมัน
       * - seed.ts เขียนสีลงคอลัมน์ departments.color ซึ่งเป็น "data" ไม่ใช่ presentation
       *   การย้ายไป token ต้อง migrate ข้อมูลใน production ด้วย เป็นงานคนละชนิด */
      'no-restricted-syntax': 'off',
    },
  },
  {
    // Storybook config: ต้องใช้ค่าดิบสำหรับ backgrounds ที่ addon อ่านตอน build
    files: ['.storybook/**/*.{ts,tsx,js,mjs}'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
  {
    /* § Hero.tsx — พื้นขาวโปร่ง 2 จุดที่ token แทนไม่ได้
     * --color-surface-raised ไม่ใช่สีขาวในธีมมืด การแทนจะทำให้ป้ายสถานะและประกาย
     * บนแถบ progress กลืนหายบนพื้น gradient (tokens.css ใช้ pattern เดียวกันใน .glass)
     * มี comment อธิบายไว้ที่จุดใช้งานแล้วทั้งสองจุด */
    files: ['src/components/landing/Hero.tsx'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
];

export default config;