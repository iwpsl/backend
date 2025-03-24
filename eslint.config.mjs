import antfu from '@antfu/eslint-config'

export default antfu({
  rules: {
    'no-console': 'off',
    'style/brace-style': ['error', '1tbs'],
    'node/prefer-global/process': 'off',
  },
})
