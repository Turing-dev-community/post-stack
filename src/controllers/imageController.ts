import { Response, Request } from "express";
import path from "path";
import fs from "fs";
import sizeOf from "image-size";
import { AuthRequest } from "../utils/auth";

const uploadsDir = path.join(process.cwd(), "uploads");

// Maximum allowed image dimensions (in pixels)
const MAX_IMAGE_WIDTH = 4000;
const MAX_IMAGE_HEIGHT = 4000;

// Ensure uploads directory exists
if (!fs.existsSync(uploadsDir)) {
	fs.mkdirSync(uploadsDir, { recursive: true });
}

export const upload = async (
	req: AuthRequest,
	res: Response
): Promise<void> => {
	if (!req.file) {
		res.status(400).json({
			error: "No file uploaded",
			message: 'Please provide an image file with the field name "image"',
		});
		return;
	}

	const filePath = path.join(uploadsDir, req.file.filename);

	// Validate image dimensions
	try {
		const dimensions = sizeOf(filePath);
		const width = dimensions.width || 0;
		const height = dimensions.height || 0;

		if (
			width === 0 ||
			height === 0 ||
			width > MAX_IMAGE_WIDTH ||
			height > MAX_IMAGE_HEIGHT
		) {
			// Remove the uploaded file if it does not meet requirements
			if (fs.existsSync(filePath)) {
				fs.unlinkSync(filePath);
			}

			res.status(400).json({
				error: "Image dimensions too large",
				message: `Image dimensions must be at most ${MAX_IMAGE_WIDTH}x${MAX_IMAGE_HEIGHT} pixels`,
			});
			return;
		}
	} catch (_error) {
		// If we fail to read dimensions, treat as invalid image
		if (fs.existsSync(filePath)) {
			fs.unlinkSync(filePath);
		}

		res.status(400).json({
			error: "Invalid image file",
			message: "Unable to read image dimensions. Please upload a valid image file.",
		});
		return;
	}

	const imagePath = `/api/images/${req.file.filename}`;

	res.status(201).json({
		message: "Image uploaded successfully",
		path: imagePath,
		filename: req.file.filename,
	});
};

export const get = async (req: Request, res: Response): Promise<void> => {
	const { filename } = req.params;

	// Sanitize filename to prevent directory traversal
	const sanitizedFilename = path.basename(filename);
	const filePath = path.join(uploadsDir, sanitizedFilename);

	// Check if file exists
	if (!fs.existsSync(filePath)) {
		res.status(404).json({
			error: "Image not found",
			message: `The image "${sanitizedFilename}" does not exist`,
		});
		return;
	}

	// Determine content type based on file extension
	const ext = path.extname(filePath).toLowerCase();
	const contentTypes: { [key: string]: string } = {
		".jpg": "image/jpeg",
		".jpeg": "image/jpeg",
		".png": "image/png",
		".gif": "image/gif",
		".webp": "image/webp",
	};

	const contentType = contentTypes[ext] || "application/octet-stream";

	// Set headers and send file
	res.setHeader("Content-Type", contentType);
	res.setHeader("Cache-Control", "public, max-age=31536000");
	res.sendFile(filePath);
};
