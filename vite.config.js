import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const path = require('path')

// https://vitejs.dev/config/
export default defineConfig({
  base: '/',
  plugins: [vue()],
  alias: {
    // 键必须以斜线开始和结束
    '/@/': path.resolve(__dirname, './src'),
  },
  // 打包配置
  build: {
    target: 'modules',
    outDir: 'dist', //指定输出路径
    sourcemap: false,
    assetsDir: 'assets', // 指定生成静态资源的存放路径
    minify: 'terser',// 混淆器，terser构建后文件体积更小
    chunkSizeWarningLimit: 1500,
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return id.toString().split('node_modules/')[1].split('/')[0].toString();
          }
        }
      },
      chunkFileNames: (chunkInfo) => {
        const facadeModuleId = chunkInfo.facadeModuleId
          ? chunkInfo.facadeModuleId.split('/')
          : [];
        const fileName =
          facadeModuleId[facadeModuleId.length - 2] || '[name]';
        return `js/${fileName}/[name].[hash].js`;
      }
    }
  }
})
