import { body, query } from "express-validator";
import { PrismaClient } from "@prisma/client";
import sanitizeHtml from 'sanitize-html';

const prisma = new PrismaClient();

const sanitizeText = (value: any) => {
  if (typeof value !== "string") return value;
    let sanitized = sanitizeHtml(value, {
    allowedTags: [],
    allowedAttributes: {}
  });

  return sanitized.replace(/\s+/g, " ").trim();
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
  body("scheduledAt")
    .optional({ nullable: true })
    .isISO8601()
    .withMessage("scheduledAt must be a valid ISO 8601 date"),
];

export const validateBulkPosts = [
  body("posts")
    .isArray({ min: 1, max: 50 })
    .withMessage("Posts must be an array with between 1 and 50 items")
    .custom((posts) => {
      if (!Array.isArray(posts)) {
        throw new Error("Posts must be an array");
      }
      if (posts.length === 0) {
        throw new Error("At least one post is required");
      }
      if (posts.length > 50) {
        throw new Error("Maximum 50 posts allowed per request");
      }
      return true;
    })
    .custom((posts) => {
      for (let i = 0; i < posts.length; i++) {
        const post = posts[i];
        if (!post.title || typeof post.title !== "string" || post.title.trim().length === 0) {
          throw new Error(`Post at index ${i}: title is required and must be a non-empty string`);
        }
        if (post.title.trim().length > 200) {
          throw new Error(`Post at index ${i}: title must be 200 characters or less`);
        }
        if (!post.content || typeof post.content !== "string" || post.content.trim().length === 0) {
          throw new Error(`Post at index ${i}: content is required and must be a non-empty string`);
        }
        if (post.published !== undefined && typeof post.published !== "boolean") {
          throw new Error(`Post at index ${i}: published must be a boolean`);
        }
        if (post.featured !== undefined && typeof post.featured !== "boolean") {
          throw new Error(`Post at index ${i}: featured must be a boolean`);
        }
        if (post.categoryId !== undefined && post.categoryId !== null && typeof post.categoryId !== "string") {
          throw new Error(`Post at index ${i}: categoryId must be a string or null`);
        }
        if (post.metaTitle !== undefined && post.metaTitle !== null && (typeof post.metaTitle !== "string" || post.metaTitle.trim().length > 60)) {
          throw new Error(`Post at index ${i}: metaTitle must be 60 characters or less`);
        }
        if (post.metaDescription !== undefined && post.metaDescription !== null && (typeof post.metaDescription !== "string" || post.metaDescription.trim().length > 160)) {
          throw new Error(`Post at index ${i}: metaDescription must be 160 characters or less`);
        }
        if (post.ogImage !== undefined && post.ogImage !== null && typeof post.ogImage !== "string") {
          throw new Error(`Post at index ${i}: ogImage must be a string or null`);
        }
        if (post.tags !== undefined) {
          if (!Array.isArray(post.tags)) {
            throw new Error(`Post at index ${i}: tags must be an array`);
          }
          if (post.tags.length > 5) {
            throw new Error(`Post at index ${i}: maximum 5 tags allowed`);
          }
          for (const tagId of post.tags) {
            if (typeof tagId !== "string") {
              throw new Error(`Post at index ${i}: each tag ID must be a string`);
            }
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

export const validateCommentSettings = [
  body("allowComments")
    .isBoolean()
    .withMessage("allowComments must be a boolean"),
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

export const validatePasswordChange = [
  body("currentPassword")
    .notEmpty()
    .withMessage("Current password is required"),
  body("newPassword")
    .isLength({ min: 8 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage(
      "Password must be at least 8 characters with uppercase, lowercase, and number"
    )
    .custom((value, { req }) => {
      if (value === req.body.currentPassword) {
        throw new Error("New password must be different from current password");
      }
      return true;
    }),
];

export const validateReactivate = [
  body("email")
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email"),
  body("password")
    .notEmpty()
    .withMessage("Password is required"),
];

export const validatePostReport = [
  body("reason")
    .trim()
    .customSanitizer(sanitizeText)
    .isLength({ min: 5, max: 500 })
    .withMessage("Reason must be between 5 and 500 characters"),
];

export const validateCommentReport = [
  body("reason")
    .trim()
    .customSanitizer(sanitizeText)
    .isLength({ min: 5, max: 500 })
    .withMessage("Reason must be between 5 and 500 characters"),
];

export const validateTag = [
  body("name")
    .trim()
    .customSanitizer(sanitizeText)
    .isLength({ min: 1, max: 50 })
    .withMessage("Tag name must be between 1 and 50 characters")
    .matches(/^[a-zA-Z0-9\s-]+$/)
    .withMessage("Tag name can only contain letters, numbers, spaces, and hyphens"),
];