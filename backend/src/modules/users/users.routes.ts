import { Router } from 'express';
import { usersController } from './users.controller';
import { validateBody } from '../../middleware/validate.middleware';
import { createUserSchema, updateUserSchema } from './users.schema';
import { authenticate } from '../../middleware/auth.middleware';
import { authorizeRoles } from '../../middleware/role.middleware';
import { Role } from '@prisma/client';

const router = Router();

// Protect all user management endpoints with authentication and SUPER_ADMIN restriction
router.use(authenticate);
router.use(authorizeRoles(Role.SUPER_ADMIN));

router.get('/', usersController.getAll);
router.get('/:id', usersController.getById);
router.post('/', validateBody(createUserSchema), usersController.create);
router.patch('/:id', validateBody(updateUserSchema), usersController.update);
router.delete('/:id', usersController.delete);

export default router;
