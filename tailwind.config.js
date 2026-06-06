export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        arcade: ['Impact', 'Arial Black', 'system-ui', 'sans-serif'],
        hud: ['Inter', 'system-ui', 'sans-serif']
      },
      textShadow: {
        hard: '3px 4px 0 #000'
      }
    }
  },
  plugins: []
};
