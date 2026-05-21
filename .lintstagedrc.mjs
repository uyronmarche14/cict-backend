export default {
  'src/**/*.ts': ['eslint --fix', () => 'tsc --noEmit'],
};
