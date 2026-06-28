const config = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-essentials', '@storybook/addon-a11y'],
  framework: { name: '@storybook/nextjs', options: {} },
  docs: { autodocs: 'tag' },
};

export default config;