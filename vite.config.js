import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
    base: command === 'build' ? '/chromatic-resonance-3d/' : '/',
    root: '.',
    publicDir: 'assets',
    server: {
        port: 8082,
        open: false
    },
    build: {
        outDir: 'dist',
        assetsDir: 'assets'
    },
    resolve: {
        alias: {
            'three/addons': 'three/examples/jsm'
        }
    }
}));
