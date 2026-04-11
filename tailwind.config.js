/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy:  { DEFAULT: '#1a1f3d', 50:'#eef0f8', 100:'#d0d4ec', 200:'#a1a9d9', 300:'#727ec6', 400:'#4453b3', 500:'#1a1f3d', 600:'#161a33', 700:'#121629', 800:'#0e111f', 900:'#0a0d15' },
        gold:  { DEFAULT: '#c9a84c', 50:'#fdf8ec', 100:'#f9edcc', 200:'#f3db99', 300:'#edc966', 400:'#e7b733', 500:'#c9a84c', 600:'#a88c3f', 700:'#876f32', 800:'#665325', 900:'#453618' },
        teal:  { DEFAULT: '#2d9f93', 50:'#eaf6f5', 100:'#c0e8e5', 200:'#81d1cb', 300:'#42bab1', 400:'#2d9f93', 500:'#267f75', 600:'#1e5f57', 700:'#174039', 800:'#0f201c', 900:'#08100e' },
        cream: { DEFAULT: '#f7f6f3', 50:'#fdfcfa', 100:'#f7f6f3', 200:'#eeece6', 300:'#e5e2d9', 400:'#dcd8cc', 500:'#d3cebf', 600:'#b8b3a2', 700:'#9c9885', 800:'#807c68', 900:'#64614b' },
      },
      fontFamily: {
        sans: ['"IBM Plex Sans Arabic"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
