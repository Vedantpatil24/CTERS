import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { ClaimController } from '../controllers/claim.controller';
import { authenticateToken } from '../middlewares/auth';

const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit (FR-RCPT-01, FR-RCPT-05)
});

const router = Router();

router.use(authenticateToken);

router.get('/', ClaimController.list);
router.post('/', ClaimController.create);
router.get('/:id', ClaimController.getById);

// Lines
router.post('/:id/lines', ClaimController.addLine);
router.delete('/:id/lines/:lineId', ClaimController.removeLine);

// Receipts
router.post('/:id/lines/:lineId/receipts', upload.single('file'), ClaimController.addReceipt);
router.delete('/:id/lines/:lineId/receipts/:receiptId', ClaimController.removeReceipt);

// Policy validation and submission
router.post('/:id/validate', ClaimController.validate);
router.post('/:id/submit', ClaimController.submit);
router.post('/:id/withdraw', ClaimController.withdraw);

export default router;
