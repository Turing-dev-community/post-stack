import { Response, Request } from "express";
import path from "path";
import fs from "fs";
import { AuthRequest } from "../utils/auth";

const uploadsDir = path.join(process.cwd(), "uploads");

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
