import { defineEventHandler } from 'h3';
import { useStorage } from '#imports';

export default defineEventHandler(async (event) => {
  const path = event.path || '';
  
  // Exclude API paths and static files with extensions from SPA fallback
  if (
    path.startsWith('/proxy') ||
    path.startsWith('/sources') ||
    path.startsWith('/discover') ||
    path.startsWith('/meta') ||
    path.startsWith('/auth') ||
    path.startsWith('/users') ||
    path.startsWith('/sessions') ||
    path.startsWith('/letterboxd') ||
    path.startsWith('/lists') ||
    path.startsWith('/metrics') ||
    path.startsWith('/healthcheck') ||
    path.includes('.')
  ) {
    return;
  }
  
  // 1. Try reading index.html from Nitro public asset storage
  try {
    const html = await useStorage('assets:public').getItem('index.html');
    if (html) {
      event.node.res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return html;
    }
  } catch (err) {
    console.error('Error reading index.html from asset storage:', err);
  }
  
  // 2. Fallback to reading from local filesystem (development / local build)
  try {
    const fs = await import('node:fs');
    const pathLib = await import('node:path');
    const indexHtmlPath = pathLib.resolve(process.cwd(), 'public/index.html');
    if (fs.existsSync(indexHtmlPath)) {
      const html = fs.readFileSync(indexHtmlPath, 'utf8');
      event.node.res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return html;
    }
  } catch (err) {
    console.error('Error reading index.html from filesystem:', err);
  }
  
  return 'Not Found';
});
