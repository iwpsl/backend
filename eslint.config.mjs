import antfu from '@antfu/eslint-config'

export default antfu({
  rules: {
    'no-console': 'off',
    'node/prefer-global/process': 'off',
    'style/brace-style': ['error', '1tbs'],
    'ts/no-empty-object-type': 'off',
  },
})
