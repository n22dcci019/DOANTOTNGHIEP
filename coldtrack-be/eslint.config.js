import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['node_modules/**', 'dist/**', '.test-dist/**', 'coverage/**'] },
  { files: ['apps/**/*.ts', 'libs/**/*.ts', 'test/**/*.ts'], extends: [js.configs.recommended, ...tseslint.configs.recommended] },
);
