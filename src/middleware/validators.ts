import { body, query } from "express-validator";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const sanitizeText = (value: any) => {
  if (typeof value !== "string") return value;
  let sanitized = value;
  let previous;
  const scriptBlock = /<\s*script\b[^>]*>([\s\S]*?)<\s*\/\s*script\s*>/gi;
  do {
    previous = sanitized;
    sanitized = sanitized.replace(scriptBlock, "");
  } while (sanitized !== previous);

  return sanitized
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
};

export const validateSignup = [
  body("email")
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email"),
  body("username")
    .trim()
    .customSanitizer(sanitizeText)
    .isLength({ min: 3, max: 30 })
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage(
      "Username must be 3-30 characters and contain only letters, numbers, and underscores"
    ),
  body("password")
    .isLength({ min: 8 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage(
      "Password must be at least 8 characters with uppercase, lowercase, and number"
    ),
];

export const validateLogin = [
  body("email")
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email"),
  body("password").notEmpty().withMessage("Password is required"),
];

export const validatePost = [
  body("title")
    .trim()
    .customSanitizer(sanitizeText)
    .isLength({ min: 1, max: 200 })
    .withMessage("Title must be between 1 and 200 characters"),
  body("content")
    .trim()
    .customSanitizer(sanitizeText)
    .isLength({ min: 1 })
    .withMessage("Content is required"),
  body("published")
    .optional()
    .isBoolean()
    .withMessage("Published must be a boolean"),
  body("featured")
    .optional()
    .isBoolean()
    .withMessage("Featured must be a boolean"),
  body("categoryId")
    .optional()
    .custom(async (value) => {
      if (value !== null && value !== undefined) {
        if (typeof value !== "string") {
          throw new Error("Category ID must be a string");
        }
      }
      return true;
    }),
  body("metaTitle")
    .optional()
    .trim()
    .customSanitizer(sanitizeText)
    .isLength({ max: 60 })
    .withMessage("Meta title must be 60 characters or less"),
  body("metaDescription")
    .optional()
    .trim()
    .customSanitizer(sanitizeText)
    .isLength({ max: 160 })
    .withMessage("Meta description must be 160 characters or less"),
  body("ogImage")
    .optional({ nullable: true })
    .trim()
    .isURL()
    .withMessage("OG image must be a valid URL"),
  body("tags")
    .optional()
    .isArray()
    .withMessage("Tags must be an array")
    .custom((value) => {
      if (value && value.length > 5) {
        throw new Error("Maximum 5 tags allowed");
      }
      return true;
    })
    .custom(async (value) => {
      if (value && Array.isArray(value)) {
        for (const tagId of value) {
          if (typeof tagId !== "string") {
            throw new Error("Each tag ID must be a string");
          }
        }
      }
      return true;
    }),
];

export const validateComment = [
  body("content")
    .trim()
    .customSanitizer(sanitizeText)
    .isLength({ min: 1, max: 5000 })
    .withMessage("Comment content must be between 1 and 5000 characters"),
];

export const validateProfileUpdate = [
  body("profilePicture")
    .optional({ nullable: true })
    .trim()
    .isURL()
    .withMessage("Profile picture must be a valid URL"),
  body("about")
    .optional({ nullable: true })
    .trim()
    .customSanitizer(sanitizeText)
    .isLength({ min: 10, max: 1000 })
    .withMessage("About must be between 10 and 1000 characters"),
];

export const validatePagination = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer greater than 0")
    .toInt(),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100")
    .toInt(),
];
