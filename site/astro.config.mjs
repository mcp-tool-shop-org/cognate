// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://mcp-tool-shop-org.github.io',
  base: '/cognate',
  integrations: [
    starlight({
      title: 'Cognate',
      description: 'AI governance attestation layer — structural truth for autonomous systems',
      logo: {
        src: './src/assets/logo.png',
        alt: 'Cognate',
        href: '/cognate/',
      },
      disable404Route: true,
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/mcp-tool-shop-org/cognate' },
      ],
      sidebar: [
        {
          label: 'Handbook',
          items: [{ autogenerate: { directory: 'handbook' } }],
        },
      ],
      customCss: ['./src/styles/starlight-custom.css'],
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
