// ESLint (el `next lint` está en desuso). Reglas recomendadas de Next.js y de TypeScript.
import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const reglas = [
  { ignores: ['.next/**', 'node_modules/**', 'public/**', 'test/**', 'docs/**', 'next-env.d.ts'] },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
];

export default reglas;
