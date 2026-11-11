import { execFileSync } from 'node:child_process'
import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// 5173 = prévia DEV; 15173 = HML privada Codespace (aceite ~100 confirmado pelo owner).
const HML_PREVIEW_PORTS = Object.freeze([5173, 15173]);
const codespaceName = process.env.CODESPACE_NAME;
const privatePreviewHosts = /^[a-z0-9-]+$/.test(codespaceName || '')
  ? HML_PREVIEW_PORTS.map((port) => `${codespaceName}-${port}.app.github.dev`)
  : [];

export default defineConfig({
  server: { allowedHosts: privatePreviewHosts },
  plugins: [
    {
      name:'erp-private-preview-provenance',
      configureServer(server) {
        server.middlewares.use('/__erp_preview',(_req,res) => {
          res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
          try {
            const git = args => execFileSync('git',args,{encoding:'utf8',timeout:2000,stdio:['ignore','pipe','ignore']}).trim();
            res.end(JSON.stringify({
              sha: git(['rev-parse', 'HEAD']),
              branch: git(['branch', '--show-current']),
              dirty: Boolean(git(['status', '--porcelain'])),
              purpose: 'private-hml-preview',
              previewPorts: [...HML_PREVIEW_PORTS],
            }));
          } catch { res.statusCode=503;res.end(JSON.stringify({error:'PREVIEW_PROVENANCE_UNAVAILABLE'})); }
        });
      },
    },
    base44({
      // Support for legacy code that imports the base44 SDK with @/integrations, @/entities, etc.
      // can be removed if the code has been updated to use the new SDK imports from @base44/sdk
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true'
    }),
    react(),
  ]
});