import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { success } from '../utils/apiResponse.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.resolve(__dirname, '../../uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const allowedExt = ['.jpeg', '.jpg', '.png', '.webp', '.gif'];
    const mimeOk = String(file.mimetype || '').startsWith('image/');
    if (allowedExt.includes(ext) || mimeOk) {
      cb(null, true);
      return;
    }
    cb(new Error('Only image files are allowed (jpg, png, webp, gif)'));
  },
});

const router = Router();

router.post('/product-image', upload.single('image'), (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image uploaded' });
    }
    const url = `/uploads/${req.file.filename}`;
    return success(res, 'Image uploaded', { url, filename: req.file.filename });
  } catch (error) {
    next(error);
  }
});

export default router;
