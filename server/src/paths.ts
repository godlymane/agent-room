import path from 'path';

const projectRoot = path.resolve(process.cwd(), '..');
export const workspaceDir = process.env.AGENT_WORKSPACE_DIR || path.join(projectRoot, 'workspace');
export const outputDir = process.env.AGENT_OUTPUT_DIR || path.join(projectRoot, 'output');
