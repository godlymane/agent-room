// Point the DB at a throwaway file BEFORE any test imports db.js, so the test suite never touches
// the real agent-room.db. Plain .mjs so it needs no TS loader and runs first via --import.
import os from 'node:os';
import path from 'node:path';

process.env.AGENT_DB_PATH = path.join(os.tmpdir(), `agent-room-test-${process.pid}.db`);
