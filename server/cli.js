#!/usr/bin/env node

const MODE_VALUES = new Set(['server', 'client']);
const FLAG_TO_ENV = new Map([
  ['--host', 'HOST'],
  ['--port', 'PORT'],
  ['--mode', 'ELENWEAVE_RUNTIME_MODE'],
  ['--data-dir', 'ELENWEAVE_DATA_DIR'],
  ['--seed-dir', 'ELENWEAVE_SEED_DIR'],
  ['--seed-json', 'ELENWEAVE_SEED_JSON'],
  ['--seed-policy', 'ELENWEAVE_SEED_POLICY'],
  ['--seed-version', 'ELENWEAVE_SEED_VERSION'],
  ['--seed-readonly', 'ELENWEAVE_SEED_READONLY'],
  ['--readonly-fork', 'ELENWEAVE_READONLY_FORK'],
  ['--hand-controls', 'ELENWEAVE_EXPERIMENTAL_HAND_CONTROLS'],
  ['--hand-model-base-url', 'ELENWEAVE_HAND_CONTROLS_MODEL_BASE_URL'],
  ['--config', 'ELENWEAVE_CONFIG'],
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
    const value = String(nextValue).trim();
    if (flag === '--mode') {
      const normalized = value.toLowerCase();
      if (!MODE_VALUES.has(normalized)) {
        throw new Error(`Invalid mode: ${value}. Use --mode server or --mode client.`);
      }
      process.env[envKey] = normalized;
      continue;
    }
    process.env[envKey] = value;
    if (flag === '--config') {
      process.env.ELENWEAVE_AI_CONFIG = value;
    }
  }
}

function printHelp() {
  process.stdout.write(
    [
      'Elenweave app',
      '',
      'Usage:',
      '  elenweave-app [options]',
      '',
      'Options:',
      '  --mode <server|client>',
      '  --host <host>',
      '  --port <port>',
      '  --data-dir <path>',
      '  --seed-dir <path>',
      '  --seed-json <path>',
      '  --seed-policy <first-run|always|versioned>',
      '  --seed-version <version>',
      '  --seed-readonly <off|all|projects>',
      '  --readonly-fork <off|local>',
      '  --hand-controls <on|off>',
      '  --hand-model-base-url <url>',
      '  --config <path>',
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
