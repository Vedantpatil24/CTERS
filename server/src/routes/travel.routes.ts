import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { TravelController } from '../controllers/travel.controller';
import { authenticateToken } from '../middlewares/auth';

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, path.join(__dirname, '../../uploads')),
    filename: (_req, file, cb) => cb(null, `travel-${Date.now()}-${file.originalname}`)
  }),
  limits: { fileSize: 5 * 1024 * 1024 } // 5 MB
});

const router = Router();

router.use(authenticateToken);
router.get('/', TravelController.list);
router.post('/', TravelController.create);
router.get('/:id', TravelController.getById);
router.put('/:id', TravelController.update);
router.post('/:id/cancel', TravelController.cancel);

// Travel Attachments (FR-TRAVEL-09)
router.post('/:id/attachments', upload.single('file'), TravelController.uploadAttachment);
router.delete('/:id/attachments/:attachmentId', TravelController.deleteAttachment);
router.get('/:id/attachments/:attachmentId/download', TravelController.downloadAttachment);

export default router;
