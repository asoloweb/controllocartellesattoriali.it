// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

const directusUrl =
  process.env.PUBLIC_DIRECTUS_URL ||
  process.env.DIRECTUS_URL ||
  'https://admin.controllocartellesattoriali.it';
let directusProtocol = 'https';
let directusHostname = 'admin.controllocartellesattoriali.it';

try {
  const parsed = new URL(directusUrl);
  directusProtocol = parsed.protocol.replace(':', '');
  directusHostname = parsed.hostname;
} catch {
  // Fall back to defaults if env is invalid.
}

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: cloudflare(),
  image: {
    domains: [directusHostname],
    remotePatterns: [
      {
        protocol: directusProtocol,
        hostname: directusHostname,
        port: '',
        pathname: '/assets/**'
      }
    ]
  },
  vite: {
    ssr: {
      noExternal: ['astro/jsx-runtime']
    }
  }
});
