import coreWebVitals from 'eslint-config-next/core-web-vitals';
import typescriptConfig from 'eslint-config-next/typescript';

// eslint-config-next 16 sudah mengekspor flat config secara langsung, jadi FlatCompat
// dari @eslint/eslintrc tidak diperlukan lagi.
export default [
    ...coreWebVitals,
    ...typescriptConfig,
    { ignores: ['.next/**', 'node_modules/**'] },
];
