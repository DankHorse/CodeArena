import { defineConfig } from 'vite';
export default defineConfig({server:{host:'0.0.0.0',port:4173,allowedHosts:['terminal.local'],proxy:{'/api':'http://127.0.0.1:8000'}},build:{outDir:'../dist',emptyOutDir:true}});
