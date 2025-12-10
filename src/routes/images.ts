import { Router, Response, Request } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { authenticateToken } from "../utils/auth";
import { asyncHandler } from "../middleware/validation";
import { requireAuthor } from "../middleware/authorization";
import {
	upload as uploadController,
	get as getController,
	getOrphanedImages as getOrphanedImagesController,
	deleteOrphanedImages as deleteOrphanedImagesController,
} from "../controllers/imageController";

const router = Router();

const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
	fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
	destination: (req, file, cb) => {
		cb(null, uploadsDir);
	},
	filename: (req, file, cb) => {
		const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
		const ext = path.extname(file.originalname);
		const basename = path.basename(file.originalname, ext);
		const sanitizedBasename = basename.replace(/[^a-zA-Z0-9]/g, "_");
		cb(null, `${sanitizedBasename}-${uniqueSuffix}${ext}`);
	},
});

const fileFilter = (
	req: Request,
	file: Express.Multer.File,
	cb: multer.FileFilterCallback
) => {
	const allowedMimes = [
		"image/jpeg",
		"image/jpg",
		"image/png",
		"image/gif",
		"image/webp",
	];
	if (allowedMimes.includes(file.mimetype)) {
		cb(null, true);
	} else {
		cb(
			new Error(
				"Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed."
			)
		);
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
	"/upload",
	authenticateToken,
	requireAuthor,
	upload.single("image"),
	asyncHandler(uploadController)
);

router.use((error: any, req: Request, res: Response, next: any): void => {
	if (error instanceof multer.MulterError) {
		if (error.code === "LIMIT_FILE_SIZE") {
			res.status(400).json({
				error: "File too large",
				message: "Image size must be less than 5MB",
			});
			return;
		}
		res.status(400).json({
			error: "Upload error",
			message: error.message,
		});
		return;
	}
	if (
		error &&
		error.message ===
		"Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed."
	) {
		res.status(400).json({
			error: "Invalid file type",
			message: error.message,
		});
		return;
	}
	next(error);
});

// Orphaned image management routes (admin only)
router.get(
	"/orphaned",
	authenticateToken,
	requireAuthor,
	asyncHandler(getOrphanedImagesController)
);

router.delete(
	"/orphaned",
	authenticateToken,
	requireAuthor,
	asyncHandler(deleteOrphanedImagesController)
);

// This route must come last as it's a catch-all pattern
router.get("/:filename", asyncHandler(getController));

export default router;
