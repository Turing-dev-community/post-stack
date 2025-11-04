import { prisma } from './setup';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

describe('Categories API', () => {
  const baseUrl = `http://localhost:${process.env.PORT}/api`;
  let authToken: string;
  let userId: string;
  let categoryId: string;

  beforeEach(async () => {

    const hashedPassword = await bcrypt.hash('Password123', 12);
    const user = await prisma.user.create({
      data: {
        email: 'test@example.com',
        username: 'testuser',
        password: hashedPassword,
      },
    });
    userId = user.id;
    authToken = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!);

    // Get a category ID for testing
    const categories = await prisma.category.findMany();
    categoryId = categories[0].id;
  });

  describe('GET /api/categories', () => {
    it('should return all categories', async () => {
      const response = await fetch(`${baseUrl}/categories`);
      const data: any = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('categories');
      expect(Array.isArray(data.categories)).toBe(true);
      expect(data.categories.length).toBeGreaterThan(0);

      // Check category structure
      const category = data.categories[0];
      expect(category).toHaveProperty('id');
      expect(category).toHaveProperty('name');
      expect(category).toHaveProperty('slug');
    });

    it('should not require authentication', async () => {
      const response = await fetch(`${baseUrl}/categories`);
      expect(response.status).toBe(200);
    });

    it('should contain exactly the predefined categories', async () => {
      const response = await fetch(`${baseUrl}/categories`);
      const data: any = await response.json();

      expect(response.status).toBe(200);
      
      const expectedCategories = [
        'Technology',
        'Tutorial',
        'Lifestyle',
        'Review',
        'News',
        'Opinion',
        'Tips & Tricks'
      ];

      // Extract category names from response
      const actualCategoryNames = data.categories.map((cat: any) => cat.name).sort();
      const expectedCategoryNames = expectedCategories.sort();

      // Check that we have exactly the right number of categories
      expect(actualCategoryNames).toHaveLength(expectedCategories.length);

      // Check that all expected categories are present
      expect(actualCategoryNames).toEqual(expectedCategoryNames);

      // Verify each category has required fields
      data.categories.forEach((category: any) => {
        expect(category).toHaveProperty('id');
        expect(category).toHaveProperty('name');
        expect(category).toHaveProperty('slug');
        expect(typeof category.id).toBe('string');
        expect(typeof category.name).toBe('string');
        expect(typeof category.slug).toBe('string');
        expect(category.name.length).toBeGreaterThan(0);
        expect(category.slug.length).toBeGreaterThan(0);
      });
    });
  });

  describe('POST /api/posts with category', () => {
    it('should create a post with a category', async () => {
      const response = await fetch(`${baseUrl}/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          title: 'Test Post with Category',
          content: 'This is a test post with a category',
          published: true,
          categoryId: categoryId,
        }),
      });

      const data: any = await response.json();

      expect(response.status).toBe(201);
      expect(data).toHaveProperty('post');
      expect(data.post).toHaveProperty('category');
      expect(data.post.category.id).toBe(categoryId);
      expect(data.post.category).toHaveProperty('name');
      expect(data.post.category).toHaveProperty('slug');
    });

    it('should create a post without a category', async () => {
      const response = await fetch(`${baseUrl}/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          title: 'Test Post without Category',
          content: 'This is a test post without a category',
          published: false,
        }),
      });

      const data: any = await response.json();

      expect(response.status).toBe(201);
      expect(data).toHaveProperty('post');
      expect(data.post.category).toBeNull();
    });
  });

  describe('PUT /api/posts/:id with category', () => {
    let postId: string;

    beforeEach(async () => {
      // Create a test post
      const post = await prisma.post.create({
        data: {
          title: 'Test Post for Update',
          content: 'This is a test post for updating',
          slug: 'test-post-for-update',
          published: false,
          authorId: userId,
        },
      });
      
      postId = post.id;
    });

    it('should update a post with a category', async () => {
      const response = await fetch(`${baseUrl}/posts/${postId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          title: 'Updated Post with Category',
          content: 'This post has been updated with a category',
          published: true,
          categoryId: categoryId,
        }),
      });

      const data: any = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('post');
      expect(data.post).toHaveProperty('category');
      expect(data.post.category.id).toBe(categoryId);
    });

    it('should update a post to remove category', async () => {
      // First add a category
      await fetch(`${baseUrl}/posts/${postId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          title: 'Post with Category',
          content: 'This post has a category',
          published: true,
          categoryId: categoryId,
        }),
      });

      // Then remove the category
      const response = await fetch(`${baseUrl}/posts/${postId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          title: 'Post without Category',
          content: 'This post no longer has a category',
          published: true,
          categoryId: null,
        }),
      });

      const data: any = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('post');
      expect(data.post.category).toBeNull();
    });
  });

  describe('GET /api/posts with category info', () => {
    let postId: string;

    beforeEach(async () => {
      // Create a test post with category using the API endpoint
      const response = await fetch(`${baseUrl}/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          title: 'Test Post for Listing',
          content: 'This is a test post for listing',
          published: true,
          categoryId: categoryId,
        }),
      });

      const data: any = await response.json();
      expect(response.status).toBe(201);
      postId = data.post.id;
    });

    it('should include category info in post listings', async () => {
      const response = await fetch(`${baseUrl}/posts`);
      const data: any = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('posts');
      expect(Array.isArray(data.posts)).toBe(true);

      const postWithCategory = data.posts.find((p: any) => p.id === postId);
      expect(postWithCategory).toBeDefined();
      expect(postWithCategory).toHaveProperty('category');
      expect(postWithCategory.category.id).toBe(categoryId);
    });

    it('should include category info in single post', async () => {
      const response = await fetch(`${baseUrl}/posts/test-post-for-listing`);
      const data: any = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('post');
      expect(data.post).toHaveProperty('category');
      expect(data.post.category.id).toBe(categoryId);
    });
  });
});
