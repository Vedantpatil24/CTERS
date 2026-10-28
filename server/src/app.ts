import express from 'express';
import cors from 'cors';
import path from 'path';
import apiRoutes from './routes';
import { errorHandler } from './middlewares/errorHandler';

export const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../uploads');
app.use('/uploads', express.static(uploadDir));

// API router
app.use('/api', apiRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', system: 'CTERS', timestamp: new Date() });
});

// Central error handler
app.use(errorHandler);
