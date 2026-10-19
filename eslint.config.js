import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    // Lint all source JS files; ignore build output and node_modules
    files: ['src/**/*.js'],
    rules: {
      // Security / bad-code rules
      'no-eval':              'error',   // no eval() — arbitrary code execution risk
      'no-implied-eval':      'error',   // no setTimeout("string") equivalent
      'no-new-func':          'error',   // no new Function("string")
      'no-script-url':        'error',   // no javascript: URLs
      'no-proto':             'error',   // no __proto__ mutation
      'no-extend-native':     'error',   // don't modify built-in prototypes

      // Common bugs
      'no-undef':             'error',   // catch typos / missing imports
      'no-unused-vars': ['warn', { vars: 'all', args: 'after-used', ignoreRestSiblings: true, argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      'no-constant-condition':'error',
      'no-debugger':          'error',
      'no-duplicate-case':    'error',
      'no-unreachable':       'error',

      // Style / quality
      'eqeqeq':               ['error', 'always'],  // === over ==
      'no-var':               'error',              // let/const only
      'prefer-const':         'warn',
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType:  'module',
      globals: {
        // Browser globals used in the game
        window:      'readonly',
        document:    'readonly',
        performance: 'readonly',
        location:    'readonly',
        URLSearchParams: 'readonly',
        requestAnimationFrame: 'readonly',
        AudioContext: 'readonly',
        webkitAudioContext: 'readonly',
        localStorage: 'readonly',
        DeviceOrientationEvent: 'readonly',
        navigator:   'readonly',
        console:     'readonly',
        setTimeout:  'readonly',
        // cannon-es CANNON is imported at module scope in main.js
        CANNON:      'readonly',
      },
    },
  },
];
