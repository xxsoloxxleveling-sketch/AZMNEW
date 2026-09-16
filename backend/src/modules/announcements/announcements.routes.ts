import { Router } from 'express';
import { announcementsController } from './announcements.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { authorizeRoles } from '../../middleware/role.middleware';
import { Role } from '@prisma/client';

const router = Router();

// Public endpoint: returns only currently visible announcements
router.get('/', announcementsController.getPublic);

// Protected Super Admin endpoints
router.use('/admin', authenticate, authorizeRoles(Role.SUPER_ADMIN));

router.get('/admin', announcementsController.getAdmin);
router.post('/admin', announcementsController.create);
router.patch('/admin/:id', announcementsController.update);
router.delete('/admin/:id', announcementsController.delete);

export default router;
