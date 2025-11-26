# Blog Backend API

A robust, production-ready blog backend API built with Express.js, TypeScript, and Prisma. Features include user authentication, JWT tokens, blog post management with categories and tags, comments, likes, follows, and comprehensive caching.

## Features

- 🔐 **User Authentication**: Signup, login, and profile management with JWT tokens
- 📝 **Blog Posts**: Full CRUD operations with markdown support, drafts, and featured posts
- 🏷️ **Categories & Tags**: Organize posts with categories and tags
- 💬 **Comments**: Nested comment threads with replies (up to 5 levels deep)
- ❤️ **Interactions**: Like posts/comments, save posts, follow users
- 📊 **Analytics**: View counts and trending posts
- 🚀 **Performance**: In-memory caching with configurable TTL
- 🛡️ **Security**: Password hashing, input validation, rate limiting, CORS protection
- 📸 **File Upload**: Image upload with validation and sanitization
- 🧪 **Testing**: Comprehensive test suite with Jest

## Tech Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT (JSON Web Tokens)
- **Caching**: Node-cache (in-memory)
- **File Upload**: Multer
- **Validation**: Express-validator

## Prerequisites

- Node.js 18+ 
- PostgreSQL 15+ (or use Docker Compose)
- npm or yarn
- Docker & Docker Compose (optional, for local database)

## Quick Start/ Set up instructions

### Option 1: Using Docker Compose (Recommended)

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd blog-backend
   ```

2. **Install dependencies**
   ```bash
   yarn install
   ```

3. **Start Docker services (PostgreSQL & Redis)**
   ```bash
   yarn docker:up
   ```

4. **Set up environment variables**
   ```bash
   cp env.example .env
   ```

5. **Set up environment variables for test**
   ```bash
   cp env.example .env.test
   ```
   
   Update `.env` with your configuration:
   ```env
   DATABASE_URL="postgresql://blog_user:blog_password@localhost:5432/blog_dev?schema=public"
   JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
   PORT=3000
   NODE_ENV="development"
   FRONTEND_URL="http://localhost:4000"
   ```

5. **Generate Prisma client and run migrations**
   ```bash
   yarn db:generate
   yarn db:migrate
   ```

6. **Start the development server**
   ```bash
   yarn dev
   ```

The API will be available at `http://localhost:3000`

### Option 2: Using Local PostgreSQL

1. **Install dependencies**
   ```bash
   yarn install
   ```

2. **Set up environment variables**
   ```bash
   cp env.example .env
   ```
   Update `.env` with your PostgreSQL connection string.

3. **Generate Prisma client and run migrations**
   ```bash
   yarn db:generate
   yarn db:migrate
   ```

4. **Start the development server**
   ```bash
   yarn dev
   ```

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Register a new user account
- `POST /api/auth/login` - Authenticate user and receive JWT token
- `GET /api/auth/profile` - Get current authenticated user's profile
- `PUT /api/auth/profile` - Update user profile (profile picture, about)

### Posts
- `GET /api/posts` - Get paginated list of published posts (supports filtering by title, author, category, sorting)
- `GET /api/posts/trending` - Get trending posts (published in last 30 days, sorted by view count)
- `GET /api/posts/my-posts` - Get authenticated user's posts (including drafts)
- `GET /api/posts/saved` - Get authenticated user's saved posts
- `GET /api/posts/:slug` - Get single published post by slug (increments view count)
- `GET /api/posts/drafts/:slug` - Get single draft post by slug (authenticated, owner only)
- `GET /api/posts/:slug/related` - Get related posts based on shared tags
- `POST /api/posts` - Create a new post (authenticated)
- `PUT /api/posts/:id` - Update post (authenticated, owner only)
- `DELETE /api/posts/:id` - Delete post (authenticated, owner only)
- `POST /api/posts/:id/like` - Like a post (authenticated)
- `DELETE /api/posts/:id/like` - Unlike a post (authenticated)
- `POST /api/posts/:id/save` - Save a post to reading list (authenticated)
- `DELETE /api/posts/:id/save` - Remove post from reading list (authenticated)

### Comments
- `GET /api/posts/:postId/comments` - Get all comments for a post (nested replies)
- `POST /api/posts/:postId/comments` - Create a comment on a post (authenticated)
- `POST /api/posts/:postId/comments/:commentId/reply` - Reply to a comment (authenticated, max 5 levels deep)
- `POST /api/posts/:postId/comments/:commentId/like` - Like a comment (authenticated)
- `DELETE /api/posts/:postId/comments/:commentId/like` - Unlike a comment (authenticated)

### Users
- `POST /api/users/:userId/follow` - Follow a user (authenticated)
- `DELETE /api/users/:userId/follow` - Unfollow a user (authenticated)
- `GET /api/users/:userId/followers` - Get list of user's followers (paginated)
- `GET /api/users/:userId/following` - Get list of users that a user follows (paginated)

### Categories
- `GET /api/categories` - Get all categories

### Tags
- `GET /api/tags` - Get all tags (supports search query parameter)

### Images
- `POST /api/images/upload` - Upload an image file (authenticated, max 5MB, JPEG/PNG/GIF/WebP)
- `GET /api/images/:filename` - Get uploaded image by filename

### Health
- `GET /health` - Health check endpoint

## Available Scripts

### Development
- `yarn dev` - Start development server with hot reload
- `yarn build` - Build TypeScript for production
- `yarn start` - Start production server

### Database
- `yarn db:generate` - Generate Prisma client
- `yarn db:migrate` - Create and run database migrations
- `yarn db:push` - Push schema changes to database (dev only)
- `yarn db:studio` - Open Prisma Studio (database GUI)

### Docker
- `yarn docker:up` - Start Docker containers (PostgreSQL, Redis)
- `yarn docker:down` - Stop Docker containers
- `yarn docker:logs` - View Docker container logs
- `yarn docker:reset` - Reset Docker volumes and restart containers

### Testing
- `yarn test` - Run test suite
- `yarn test:watch` - Run tests in watch mode
- `yarn test:debug` - Run tests with debug output
- `yarn setup:test` - Setup test environment (start Docker + generate Prisma client)

## Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Yes | - |
| `JWT_SECRET` | Secret key for JWT token signing | Yes | - |
| `JWT_EXPIRES_IN` | JWT token expiration time | No | `7d` |
| `PORT` | Server port number | No | `3000` |
| `NODE_ENV` | Environment mode (development/production/test) | No | `development` |
| `FRONTEND_URL` | Frontend URL for CORS configuration | No | `http://localhost:3000` |

## Database Schema

The application uses PostgreSQL with the following main models:

- **User**: User accounts with authentication
- **Post**: Blog posts with content, metadata, and SEO fields
- **Category**: Post categories
- **Tag**: Post tags (many-to-many with posts)
- **Comment**: Nested comments on posts
- **PostLike**: User likes on posts
- **CommentLike**: User likes on comments
- **SavedPost**: User's saved posts
- **Follow**: User follow relationships

See `prisma/schema.prisma` for complete schema definition.

## Authentication

The API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

Tokens expire after 7 days by default (configurable via `JWT_EXPIRES_IN`).

## Rate Limiting

Global rate limiting is enabled: 5000 requests per 15-minute window per IP address. Rate limit headers are included in responses.

## Caching

In-memory caching is enabled for GET endpoints:
- Post lists: 5 minutes TTL
- Single posts: 10 minutes TTL
- Cache is automatically invalidated on POST/PUT/DELETE operations

## File Upload

Image uploads are limited to:
- **Max file size**: 5MB
- **Allowed formats**: JPEG, PNG, GIF, WebP
- **Max resolution**: 4000x4000 pixels (width and height)
- **Storage**: Local `uploads/` directory
- **Access**: Via `/api/images/:filename`

## Error Handling

The API returns consistent error responses:

```json
{
  "error": "Error type",
  "message": "Detailed error message"
}
```

Common HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Internal Server Error

## Testing

Tests use a separate test database and include:
- Authentication flows
- Post CRUD operations
- Comments and interactions
- User follows
- Cache functionality
- Rate limiting

Run tests with:
```bash
yarn setup:test  # First time setup
yarn test
```

### Test Coverage

To get the coverage of the tests, run:
```bash
yarn test --coverage
```

This runs all test in the repository and gives you a breakdown of the coverage in a table-like format in 4 main categories:
- Stmts
- Branch
- Funcs
- Lines

The average test coverage of the repository can be calculated by taking an average of the percentages of the 4 categories outlined above

#### Test Coverage Sample
[!Test Coverage Snapshot](./test_coverage.png)

## Project Structure

```
blog-backend/
├── src/
│   ├── routes/          # API route handlers
│   ├── middleware/      # Express middleware (validation, cache, rate limit)
│   ├── utils/           # Utility functions (auth, helpers)
│   ├── constants/      # Configuration constants
│   └── test/            # Test files
├── prisma/
│   ├── schema.prisma    # Database schema
│   └── migrations/      # Database migrations
├── docker/              # Docker initialization scripts
├── uploads/             # Uploaded image files
└── dist/                # Compiled JavaScript (generated)
```
