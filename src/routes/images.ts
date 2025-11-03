import { Router, Response, Request } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticateToken } from '../utils/auth';
import { AuthRequest } from '../utils/auth';
import { asyncHandler } from '../middleware/validation';

const router = Router();


const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}


const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {

        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
        const ext = path.extname(file.originalname);
        const basename = path.basename(file.originalname, ext);
        const sanitizedBasename = basename.replace(/[^a-zA-Z0-9]/g, '_');
        cb(null, `${sanitizedBasename}-${uniqueSuffix}${ext}`);
    },
});


const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.'));
    }
};

const upload = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024,
    },
    fileFilter,
});


router.post(
    '/upload',
    authenticateToken,
    upload.single('image'),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        if (!req.file) {
            return res.status(400).json({
                error: 'No file uploaded',
                message: 'Please provide an image file with the field name "image"',
            });
        }


        const imagePath = `/api/images/${req.file.filename}`;

        return res.status(201).json({
            message: 'Image uploaded successfully',
            path: imagePath,
            filename: req.file.filename,
        });
    })
);


router.use((error: any, req: Request, res: Response, next: any): void => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            res.status(400).json({
                error: 'File too large',
                message: 'Image size must be less than 5MB',
            });
            return;
        }
        res.status(400).json({
            error: 'Upload error',
            message: error.message,
        });
        return;
    }
    if (error && error.message === 'Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.') {
        res.status(400).json({
            error: 'Invalid file type',
            message: error.message,
        });
        return;
    }
    next(error);
});


router.get('/:filename', asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { filename } = req.params;


    const sanitizedFilename = path.basename(filename);
    const filePath = path.join(uploadsDir, sanitizedFilename);


    if (!fs.existsSync(filePath)) {
        res.status(404).json({
            error: 'Image not found',
            message: `The image "${sanitizedFilename}" does not exist`,
        });
        return;
    }


    const ext = path.extname(filePath).toLowerCase();
    const contentTypes: { [key: string]: string } = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
    };

    const contentType = contentTypes[ext] || 'application/octet-stream';


    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    res.sendFile(filePath);
}));

export default router;

