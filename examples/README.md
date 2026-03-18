Static repo:
- Path: `examples/static-test-repo`
- Framework: `react`
- Build command: `node build.mjs`
- Install command: `npm install --prefer-offline --no-audit --no-fund`
- Expected result: `/artifact/` or production route serves `STATIC TEST OK`

Node repo:
- Path: `examples/node-test-repo`
- Framework: `node-api`
- Build command: leave empty
- Install command: `npm install --prefer-offline --no-audit --no-fund`
- Expected result: `/runtime/` or production route serves `NODE TEST OK`
