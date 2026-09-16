import { Request, Response, NextFunction } from 'express';
import { announcementsService } from './announcements.service';
import { createAnnouncementSchema, updateAnnouncementSchema } from './announcements.schema';

export class AnnouncementsController {
  async getPublic(_req: Request, res: Response, next: NextFunction) {
    try {
      const result = await announcementsService.getPublicAnnouncements();
      res.json({
        success: true,
        ...result,
      });
    } catch (err) {
      next(err);
    }
  }

  async getAdmin(_req: Request, res: Response, next: NextFunction) {
    try {
      const result = await announcementsService.getAdminAnnouncements();
      res.json({
        success: true,
        ...result,
      });
    } catch (err) {
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = createAnnouncementSchema.parse(req.body);
      const created = await announcementsService.createAnnouncement(validated);
      res.status(201).json({
        success: true,
        data: created,
      });
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const validated = updateAnnouncementSchema.parse(req.body);
      const updated = await announcementsService.updateAnnouncement(id, validated);
      res.json({
        success: true,
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await announcementsService.deleteAnnouncement(id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
}

export const announcementsController = new AnnouncementsController();
