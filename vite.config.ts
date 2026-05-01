import { defineConfig } from 'vite'
// import { devtools } from '@tanstack/devtools-vite'
import { nitro } from 'nitro/vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const isGitHubActions = process.env.GITHUB_ACTIONS === 'true'
const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1]
const pagesBase = isGitHubActions && repositoryName ? `/${repositoryName}/` : '/'

const config = defineConfig({
  base: pagesBase,
  resolve: { tsconfigPaths: true },
  plugins: [
    // devtools(),
    tailwindcss(),
    // tanstackStart(),
    tanstackStart({
      spa: {
        enabled: true,
        prerender: {
          outputPath: '/index.html',
          enabled: true,
          crawlLinks: true,
        },
      },
    }),
    viteReact(),
    // nitro({ preset: 'github-pages', })
  ],
})

export default config
