import { attendanceScanRateLimiter } from '../../middleware/rateLimit.middleware';
import { Router, Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.middleware';
import { authorizeRoles } from '../../middleware/role.middleware';
import { verifyAccessToken } from '../../lib/jwt';
import { examControlService } from './examControl.service';
export const examControlRouter = Router();
examControlRouter.use(authenticate, authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN));
const superAdmin = authorizeRoles(Role.SUPER_ADMIN);
function credentials(req: Request): [
    string,
    number
] { return [req.user!.id, verifyAccessToken(req.get('Authorization')!.split(' ')[1]).tokenVersion]; }
function respond(work: (req: Request) => Promise<unknown>, status = 200) { return async (req: Request, res: Response, next: NextFunction) => { try {
    res.status(status).json({ success: true, data: await work(req) });
}
catch (error) {
    next(error);
} }; }
examControlRouter.get('/current', respond(req => examControlService.current(z.string().min(1).parse(req.query.testCenterId), z.string().parse(req.query.businessDate))));
examControlRouter.post('/prepare', respond(req => examControlService.prepare(z.string().min(1).parse(req.body.examHallId), ...credentials(req)), 201));
examControlRouter.post('/preview', superAdmin, respond(req => examControlService.preview(req.body, ...credentials(req))));
examControlRouter.post('/confirm', superAdmin, attendanceScanRateLimiter, respond(req => examControlService.confirm(req.body, ...credentials(req), req.get('Idempotency-Key') ?? '')));
examControlRouter.get('/operations/:key', superAdmin, respond(req => examControlService.operation(...credentials(req), z.string().uuid().parse(req.params.key))));
examControlRouter.post('/operations/:key/status', superAdmin, respond(req => {
    const body = z.object({ challenge: z.string().min(1).max(64000) }).strict().parse(req.body);
    return examControlService.operation(...credentials(req), z.string().uuid().parse(req.params.key), body.challenge);
}));
examControlRouter.get('/history', superAdmin, respond(req => examControlService.history(...credentials(req), z.string().min(1).parse(req.query.testCenterId), z.string().parse(req.query.businessDate), z.coerce.number().int().min(1).parse(req.query.page ?? 1))));
