# Post-Stack Repository Guide

## 🎯 What is This Repository?

This is a **Blog Backend API** - a server-side application that provides all the functionality needed to run a blog platform. Think of it like the "engine" behind a blog website. It handles:

- User accounts and authentication
- Creating, reading, updating, and deleting blog posts
- Comments on posts
- Likes and saves
- User following system
- Categories and tags
- Image uploads
- And much more!

**Important**: This is a **backend-only** project. It doesn't have a user interface (UI). It's an API that a frontend application (like a React app or mobile app) would call to get data and perform actions.

---

## 🛠️ Technology Stack Explained

Since you know C++ and databases, here's how these web technologies map to what you know:

### **Node.js & TypeScript**
- **Node.js**: Like a runtime environment for JavaScript (similar to how you need a C++ compiler/runtime)
- **TypeScript**: JavaScript with types (like C++ with static typing, but for web)
- **Why**: Allows writing server-side code in JavaScript/TypeScript

### **Express.js**
- **What**: A web framework for Node.js
- **Think of it as**: Like a library that handles HTTP requests/responses (similar to how you might use libraries in C++)
- **Purpose**: Makes it easy to create API endpoints (URLs that accept requests)

### **PostgreSQL**
- **What**: A relational database (you probably know this!)
- **Purpose**: Stores all data (users, posts, comments, etc.)
- **Connection**: Uses connection strings (like `DATABASE_URL`)

### **Prisma**
- **What**: An ORM (Object-Relational Mapping) tool
- **Think of it as**: A layer that lets you interact with the database using TypeScript code instead of raw SQL
- **Purpose**: 
  - Defines database schema (`schema.prisma`)
  - Generates TypeScript types automatically
  - Handles migrations (database changes)

### **JWT (JSON Web Tokens)**
- **What**: A way to authenticate users
- **How it works**: When a user logs in, they get a "token" (like a temporary ID card). They send this token with every request to prove who they are.

### **Other Key Libraries**:
- **bcryptjs**: Hashes passwords (security)
- **express-validator**: Validates incoming data
- **multer**: Handles file uploads
- **node-cache**: In-memory caching (stores frequently accessed data in RAM)
- **helmet**: Security middleware
- **cors**: Allows frontend apps to call this API

---

## 📁 Project Structure

```
post-stack/
├── src/                    # Main source code
│   ├── index.ts           # Entry point (starts the server)
│   ├── routes/            # URL endpoints (like /api/posts)
│   ├── controllers/      # Handle requests (business logic)
│   ├── services/         # Core business logic (database operations)
│   ├── middleware/       # Functions that run before controllers
│   ├── utils/            # Helper functions
│   ├── constants/        # Configuration values
│   └── test/             # Test files
├── prisma/
│   ├── schema.prisma     # Database schema definition
│   └── migrations/       # Database change history
├── docker/               # Docker setup scripts
├── uploads/              # Uploaded images
└── dist/                 # Compiled JavaScript (generated)
```

---

## 🔄 How Requests Flow Through the System

Here's the typical flow when someone makes a request:

```
1. Client (Frontend) makes HTTP request
   ↓
2. Express.js receives request at a route (e.g., /api/posts)
   ↓
3. Middleware runs (authentication, validation, rate limiting, caching)
   ↓
4. Route handler calls Controller
   ↓
5. Controller calls Service
   ↓
6. Service uses Prisma to query PostgreSQL database
   ↓
7. Response flows back: Service → Controller → Route → Client
```

### Example: Getting All Posts

1. **Request**: `GET /api/posts`
2. **Route** (`src/routes/posts.ts`): Matches the URL pattern
3. **Middleware**: 
   - Validates pagination parameters
   - Checks cache (maybe data is already stored in memory)
4. **Controller** (`src/controllers/posts/postsQueryController.ts`): Handles the request
5. **Service** (`src/services/posts/postsQueryService.ts`): Queries database using Prisma
6. **Response**: Returns JSON with posts data

---

## 🗄️ Database Schema Overview

The database has these main tables (models):

### **User**
- Stores user accounts (email, username, password, profile picture)
- Has security features (failed login attempts, account lockout)

### **Post**
- Blog posts (title, content, slug, published status)
- SEO fields (metaTitle, metaDescription, ogImage)
- View count, featured flag
- Links to: User (author), Category

### **Category**
- Post categories (e.g., "Technology", "Lifestyle")

### **Tag**
- Tags for posts (many-to-many relationship via `PostTag`)

### **Comment**
- Comments on posts
- Supports nested replies (up to 5 levels deep)
- Has `parentId` to create thread structure

### **PostLike, CommentLike**
- Tracks which users liked which posts/comments

### **SavedPost**
- User's reading list (saved posts)

### **Follow**
- User following relationships (who follows whom)

### **PostReport**
- Reports on posts (for moderation)

### **RefreshToken**
- Stores refresh tokens for authentication

---

## 🔐 Authentication Flow

1. **Signup**: User creates account → password is hashed → user saved to database
2. **Login**: User provides email/password → system verifies → returns JWT token
3. **Protected Routes**: User includes token in `Authorization: Bearer <token>` header
4. **Middleware** (`authenticateToken`): Validates token and attaches user info to request

---

## 🎨 Architecture Pattern: MVC-like with Services

This project uses a **layered architecture**:

### **Routes** (`src/routes/`)
- Define URL endpoints
- Apply middleware (auth, validation, caching)
- Call controllers

### **Controllers** (`src/controllers/`)
- Handle HTTP requests/responses
- Extract data from request
- Call services
- Format responses

### **Services** (`src/services/`)
- Core business logic
- Database operations (using Prisma)
- Data transformation
- Reusable across different controllers

### **Middleware** (`src/middleware/`)
- Runs before controllers
- Examples: authentication, validation, rate limiting, caching

### **Utils** (`src/utils/`)
- Helper functions
- Reusable utilities

---

## 🚀 Key Features

### 1. **User Management**
- Signup, login, profile management
- Account lockout after failed login attempts
- Soft delete (users marked as deleted, not removed)

### 2. **Post Management**
- CRUD operations (Create, Read, Update, Delete)
- Drafts vs. published posts
- Featured posts
- Post scheduling (publish at future date)
- SEO metadata
- Reading time calculation
- View counting

### 3. **Interactions**
- Like/unlike posts and comments
- Save posts to reading list
- Follow/unfollow users

### 4. **Comments**
- Nested comment threads (replies to replies)
- Max 5 levels deep
- Like comments
- Can disable comments per post

### 5. **Organization**
- Categories (one per post)
- Tags (many per post)
- Filtering and searching

### 6. **Performance**
- In-memory caching (stores frequently accessed data)
- Cache invalidation on updates
- Database indexes for fast queries

### 7. **Security**
- Password hashing (bcrypt)
- JWT authentication
- Rate limiting (prevents abuse)
- Input validation
- CORS protection
- Helmet (security headers)

### 8. **File Uploads**
- Image uploads (max 5MB)
- Supported formats: JPEG, PNG, GIF, WebP
- Stored in `uploads/` directory

### 9. **Moderation**
- Post reporting system
- Report status tracking (PENDING, REVIEWED, REJECTED)

### 10. **SEO & Discovery**
- Sitemap generation
- Related posts (based on shared tags)
- Trending posts
- Popular posts

---

## 🧪 Testing

- Uses **Jest** testing framework
- Tests are in `src/test/`
- Separate test database (via Docker)
- Tests cover:
  - Authentication flows
  - CRUD operations
  - Comments and interactions
  - Caching
  - Rate limiting
  - And more!

---

## 🔧 Environment Variables

The app uses environment variables (stored in `.env` file):

- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret key for signing tokens
- `JWT_EXPIRES_IN`: Token expiration (default: 7d)
- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment (development/production/test)
- `FRONTEND_URL`: Frontend URL for CORS

---

## 🐳 Docker Setup

The project uses Docker Compose to run:
- **PostgreSQL** (development database on port 5432, test on 5433)
- **Redis** (for caching, on port 6379)

This makes it easy to set up the database without installing PostgreSQL locally.

---

## 📝 How to Identify Issues & Feature Requests

Now that you understand the structure, here's how to find areas for improvement:

### **1. Look at the Code Structure**
- Check `src/routes/` - Are there missing endpoints?
- Check `src/controllers/` - Is error handling complete?
- Check `src/services/` - Are there edge cases not handled?

### **2. Check the Database Schema**
- Look at `prisma/schema.prisma`
- Are there missing relationships?
- Are there fields that should be indexed?
- Are there missing models?

### **3. Review Test Coverage**
- Run `yarn test --coverage`
- Look for areas with low coverage
- Missing test cases = potential issues

### **4. Check Documentation**
- Compare README.md with actual implementation
- Are all endpoints documented?
- Are examples correct?

### **5. Security Review**
- Password policies?
- Input validation completeness?
- Rate limiting sufficient?
- Error messages (don't leak sensitive info)?

### **6. Performance**
- Are there N+1 query problems?
- Missing database indexes?
- Cache strategies optimal?
- Large data handling (pagination)?

### **7. Feature Gaps**
- Compare with similar blog platforms
- Missing common features?
- User experience improvements?

### **8. Code Quality**
- Error handling consistency?
- Code duplication?
- Type safety (TypeScript)?
- Code organization?

---

## 🎯 Common Areas for Issues/Features

Based on the codebase, here are some areas you might find:

### **Potential Issues:**
1. **Error Handling**: Missing try-catch blocks, unclear error messages
2. **Validation**: Missing input validation on some endpoints
3. **Edge Cases**: What happens if a user deletes a post with comments?
4. **Performance**: Missing indexes, inefficient queries
5. **Security**: Token refresh logic, password reset functionality
6. **Testing**: Missing test cases, edge cases not covered

### **Potential Features:**
1. **Search**: Full-text search for posts
2. **Notifications**: User notifications system
3. **Email**: Email verification, password reset emails
4. **Admin**: Admin panel, moderation tools
5. **Analytics**: More detailed analytics
6. **Media**: Video uploads, image optimization
7. **Social**: Share buttons, social login (Google, GitHub)
8. **Content**: Rich text editor, markdown preview
9. **Performance**: Redis caching (currently node-cache)
10. **API**: GraphQL API, API versioning

---

## 📚 Key Files to Understand

1. **`src/index.ts`**: Entry point - see how the app starts
2. **`prisma/schema.prisma`**: Database structure
3. **`src/routes/posts.ts`**: Example of route definitions
4. **`src/controllers/posts/postsCrudController.ts`**: Example controller
5. **`src/services/posts/postsCrudService.ts`**: Example service
6. **`src/middleware/validation.ts`**: How validation works
7. **`src/utils/auth.ts`**: Authentication logic

---

## 🚦 Next Steps

1. **Explore the codebase**: Read through different routes and controllers
2. **Run the app**: Follow README setup instructions
3. **Test endpoints**: Use Postman or similar tool to test API
4. **Read tests**: Tests show expected behavior
5. **Check issues**: Look for patterns, missing features, bugs
6. **Create issues**: Document problems you find
7. **Plan features**: Think about improvements
8. **Create PRs**: Implement fixes/features

---

## 💡 Tips for Creating Issues

When creating issues, include:
- **Clear title**: What's the problem/feature?
- **Description**: Detailed explanation
- **Steps to reproduce**: For bugs
- **Expected vs. Actual**: What should happen vs. what happens
- **Code references**: Point to relevant files
- **Screenshots/Logs**: If applicable
- **Labels**: Bug, Feature, Enhancement, etc.

---

## 🎓 Learning Resources

If you want to understand web development better:
- **Express.js**: Official docs
- **Prisma**: Prisma docs (great for database work)
- **TypeScript**: TypeScript handbook
- **REST APIs**: REST API concepts
- **JWT**: JWT.io

---

Good luck with your work at Turing! This is a well-structured codebase, so you should be able to navigate it effectively. Remember: understanding the architecture is key to finding good issues and features to work on.

