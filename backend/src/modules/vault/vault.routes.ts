import express, { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate } from '../../middleware/auth.middleware';
import { authorizeRoles } from '../../middleware/role.middleware';
import { validateBody, validateQuery } from '../../middleware/validate.middleware';
import { documentUploadRateLimiter } from '../../middleware/rateLimit.middleware';
import { vaultController } from './vault.controller';
import { vaultHistorySchema, vaultListSchema, vaultReplaceQuerySchema, vaultReviewSchema } from './vault.schema';

const router = Router();
// Every Vault endpoint is private and restricted to trusted administrative staff.
router.use(authenticate, authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN));
const binaryUpload = express.raw({ type: ['image/jpeg', 'image/png', 'application/pdf', 'application/octet-stream'], limit: '5mb' });

router.get('/documents', validateQuery(vaultListSchema), vaultController.list);
router.post('/documents', documentUploadRateLimiter, binaryUpload, vaultController.upload);
router.get('/documents/:id', vaultController.detail);
router.get('/documents/:id/file', vaultController.file);
router.get('/documents/:id/history', validateQuery(vaultHistorySchema), vaultController.history);
router.get('/documents/:id/history/:eventId/file', vaultController.priorFile);
router.put('/documents/:id/file', documentUploadRateLimiter, validateQuery(vaultReplaceQuerySchema), binaryUpload, vaultController.replace);
router.patch('/documents/:id/review', validateBody(vaultReviewSchema), vaultController.review);

export default router;
