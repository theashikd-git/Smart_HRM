import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// Local disk storage -- this is an on-premise, single-server deployment (per
// the rest of Smart HRM), so there's no object-storage service to reach for.
export const UPLOAD_DIR = join(process.cwd(), 'uploads', 'leave-attachments');
if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });
