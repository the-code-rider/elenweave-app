#!/usr/bin/env node

const FLAG_TO_ENV = new Map([
  ['--host', 'HOST'],
  ['--port', 'PORT'],
  ['--data-dir', 'ELENWEAVE_DATA_DIR'],
  ['--seed-dir', 'ELENWEAVE_SEED_DIR'],
  ['--seed-json', 'ELENWEAVE_SEED_JSON'],
  ['--seed-policy', 'ELENWEAVE_SEED_POLICY'],
  ['--seed-version', 'ELENWEAVE_SEED_VERSION'],
  ['--seed-readonly', 'ELENWEAVE_SEED_READONLY'],
  ['--readonly-fork', 'ELENWEAVE_READONLY_FORK'],
  ['--ai-config', 'ELENWEAVE_AI_CONFIG']
]);

function parseArgv(argv) {
  for (let i = 0; i < argv.length; i += 1) {
    const token = String(argv[i] || '');
    if (!token.startsWith('--')) continue;
    if (token === '--help' || token === '-h') {
      printHelp();
      process.exit(0);
    }
    const [flag, inlineValue] = token.split('=', 2);
    const envKey = FLAG_TO_ENV.get(flag);
    if (!envKey) continue;
    const nextValue = inlineValue !== undefined ? inlineValue : argv[i + 1];
    if (inlineValue === undefined) {
      i += 1;
    }
    if (nextValue === undefined || String(nextValue).startsWith('--')) {
      throw new Error(`Missing value for ${flag}`);
    }
    process.env[envKey] = String(nextValue);
  }
}

function printHelp() {
  process.stdout.write(
    [
      'Elenweave server',
      '',
      'Usage:',
      '  elenweave-server [options]',
      '',
      'Options:',
      '  --host <host>',
      '  --port <port>',
      '  --data-dir <path>',
      '  --seed-dir <path>',
      '  --seed-json <path>',
      '  --seed-policy <first-run|always|versioned>',
      '  --seed-version <version>',
      '  --seed-readonly <off|all|projects>',
      '  --readonly-fork <off|local>',
      '  --ai-config <path>',
      '  --help',
      ''
    ].join('\n')
  );
}

try {
  parseArgv(process.argv.slice(2));
  await import('./index.js');
} catch (err) {
  console.error(err?.message || String(err));
  process.exitCode = 1;
}

