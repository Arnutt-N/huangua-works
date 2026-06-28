import type { Preview, StoryContext } from '@storybook/react';
import '../src/styles/tokens.css';

/**
 * .storybook/preview.tsx
 * - โหลด design tokens ทุก story (Tailwind v4 @theme inline → utilities ใช้ได้)
 * - a11y addon รัน axe ทุก story (gate)
 * - toolbar toggle light/dark ผ่าน [data-theme]
 * - ภาษาไทย + font-sans (Noto Sans Thai)
 */

const preview: Preview = {
  parameters: {
    a11y: {
      // axe default rules + บังคับ button-name, label, color-contrast
      options: {},
    },
    backgrounds: {
      options: {
        light: { name: 'light (default)', value: 'oklch(98% 0.003 245)' },
        dark: { name: 'dark (intentional)', value: 'oklch(15% 0.006 245)' },
      },
    },
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
  },
  globalTypes: {
    theme: {
      name: 'ธีม',
      description: 'light/dark (DESIGN.md: ไม่ default dark)',
      defaultValue: 'light',
      toolbar: {
        icon: 'circlehollow',
        items: ['light', 'dark'],
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (Story, context: StoryContext) => {
      const theme = (context.globals['theme'] as 'light' | 'dark') ?? 'light';
      return (
        <div data-theme={theme} lang="th" className="min-h-dvh bg-surface p-8 font-sans text-ink">
          <Story />
        </div>
      );
    },
  ],
};

export default preview;