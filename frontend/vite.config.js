import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  optimizeDeps: {
    // Ye line Recharts aur react-is ke conflict ko fix karegi
    include: ['react-is', 'recharts', 'lucide-react', 'react-force-graph-3d']
  },
  server: {
    // Agar port busy ho toh ye help karega
    host: true,
    port: 5173,
  }
})