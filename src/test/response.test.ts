import { Response } from "express";
import {
	handleResponse,
	formatSuccessResponse,
	responseHelpers,
	ResponseHandler,
} from "../utils/response";
import { createMockResponse } from "./utils/mockErrors";
import {
	createMockBadRequestError,
	createMockNotFoundError,
	createMockGenericError,
} from "./utils/mockErrors";

describe("handleResponse", () => {
	let mockRes: Response;

	beforeEach(() => {
		mockRes = createMockResponse() as any;
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe("Headers already sent", () => {
		it("should return early if headers are already sent", () => {
			mockRes.headersSent = true;

			handleResponse(mockRes, {
				message: "Test message",
				data: { test: "data" },
			});

			expect(mockRes.status).not.toHaveBeenCalled();
			expect(mockRes.json).not.toHaveBeenCalled();
		});
	});

	describe("Basic response handling", () => {
		it("should send response with default status code 200", () => {
			handleResponse(mockRes, {
				message: "Operation successful",
			});

			expect(mockRes.status).toHaveBeenCalledWith(200);
			expect(mockRes.json).toHaveBeenCalledWith({
				message: "Operation successful",
			});
		});

		it("should send response with custom status code", () => {
			handleResponse(mockRes, {
				message: "Resource created",
				statusCode: 201,
			});

			expect(mockRes.status).toHaveBeenCalledWith(201);
			expect(mockRes.json).toHaveBeenCalledWith({
				message: "Resource created",
			});
		});

		it("should send response with data", () => {
			const testData = { id: 1, name: "Test" };
			handleResponse(mockRes, {
				message: "Data retrieved",
				data: testData,
			});

			expect(mockRes.status).toHaveBeenCalledWith(200);
			expect(mockRes.json).toHaveBeenCalledWith({
				message: "Data retrieved",
				data: testData,
			});
		});

		it("should send response without message", () => {
			const testData = { id: 1, name: "Test" };
			handleResponse(mockRes, {
				data: testData,
			});

			expect(mockRes.status).toHaveBeenCalledWith(200);
			expect(mockRes.json).toHaveBeenCalledWith({
				data: testData,
			});
		});

		it("should send response without data", () => {
			handleResponse(mockRes, {
				message: "Operation successful",
			});

			expect(mockRes.status).toHaveBeenCalledWith(200);
			expect(mockRes.json).toHaveBeenCalledWith({
				message: "Operation successful",
			});
		});
	});

	describe("Custom fields", () => {
		it("should include custom fields in response", () => {
			handleResponse(mockRes, {
				message: "Posts retrieved",
				posts: [{ id: 1 }, { id: 2 }],
				count: 2,
				page: 1,
			});

			expect(mockRes.status).toHaveBeenCalledWith(200);
			expect(mockRes.json).toHaveBeenCalledWith({
				message: "Posts retrieved",
				posts: [{ id: 1 }, { id: 2 }],
				count: 2,
				page: 1,
			});
		});

		it("should handle response with nested data structures", () => {
			const complexData = {
				user: {
					id: 1,
					name: "John",
					posts: [
						{ id: 1, title: "Post 1" },
						{ id: 2, title: "Post 2" },
					],
				},
			};

			handleResponse(mockRes, {
				message: "User data retrieved",
				data: complexData,
			});

			expect(mockRes.status).toHaveBeenCalledWith(200);
			expect(mockRes.json).toHaveBeenCalledWith({
				message: "User data retrieved",
				data: complexData,
			});
		});
	});

	describe("Real-world scenarios", () => {
		it("should handle post creation response", () => {
			const post = {
				id: 1,
				title: "Test Post",
				content: "Test content",
				authorId: 1,
			};

			handleResponse(mockRes, {
				message: "Post created successfully",
				post,
				statusCode: 201,
			});

			expect(mockRes.status).toHaveBeenCalledWith(201);
			expect(mockRes.json).toHaveBeenCalledWith({
				message: "Post created successfully",
				post,
			});
		});

		it("should handle paginated response", () => {
			const posts = [{ id: 1 }, { id: 2 }];
			handleResponse(mockRes, {
				message: "Posts retrieved successfully",
				posts,
				count: posts.length,
				page: 1,
				limit: 10,
				totalPages: 1,
			});

			expect(mockRes.status).toHaveBeenCalledWith(200);
			expect(mockRes.json).toHaveBeenCalledWith({
				message: "Posts retrieved successfully",
				posts,
				count: 2,
				page: 1,
				limit: 10,
				totalPages: 1,
			});
		});

		it("should handle update response", () => {
			const updatedPost = {
				id: 1,
				title: "Updated Post",
				content: "Updated content",
			};

			handleResponse(mockRes, {
				message: "Post updated successfully",
				post: updatedPost,
			});

			expect(mockRes.status).toHaveBeenCalledWith(200);
			expect(mockRes.json).toHaveBeenCalledWith({
				message: "Post updated successfully",
				post: updatedPost,
			});
		});

		it("should handle delete response", () => {
			handleResponse(mockRes, {
				message: "Post deleted successfully",
			});

			expect(mockRes.status).toHaveBeenCalledWith(200);
			expect(mockRes.json).toHaveBeenCalledWith({
				message: "Post deleted successfully",
			});
		});
	});
});

describe("formatSuccessResponse", () => {
	it("should format response with message only", () => {
		const response = formatSuccessResponse({
			message: "Operation successful",
		});

		expect(response).toEqual({
			message: "Operation successful",
		});
	});

	it("should format response with data only", () => {
		const testData = { id: 1, name: "Test" };
		const response = formatSuccessResponse({
			data: testData,
		});

		expect(response).toEqual({
			data: testData,
		});
	});

	it("should format response with message and data", () => {
		const testData = { id: 1, name: "Test" };
		const response = formatSuccessResponse({
			message: "Data retrieved",
			data: testData,
		});

		expect(response).toEqual({
			message: "Data retrieved",
			data: testData,
		});
	});

	it("should format response with custom fields", () => {
		const response = formatSuccessResponse({
			message: "Posts retrieved",
			posts: [{ id: 1 }],
			count: 1,
		});

		expect(response).toEqual({
			message: "Posts retrieved",
			posts: [{ id: 1 }],
			count: 1,
		});
	});

	it("should handle undefined data", () => {
		const response = formatSuccessResponse({
			message: "Operation successful",
			data: undefined,
		});

		expect(response).toEqual({
			message: "Operation successful",
		});
	});

	it("should handle null data", () => {
		const response = formatSuccessResponse({
			message: "Operation successful",
			data: null,
		});

		expect(response).toEqual({
			message: "Operation successful",
			data: null,
		});
	});
});

describe("responseHelpers", () => {
	let mockRes: Response;

	beforeEach(() => {
		mockRes = createMockResponse() as any;
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe("ok", () => {
		it("should send 200 OK response", () => {
			responseHelpers.ok(mockRes, {
				message: "Operation successful",
			});

			expect(mockRes.status).toHaveBeenCalledWith(200);
			expect(mockRes.json).toHaveBeenCalledWith({
				message: "Operation successful",
			});
		});

		it("should send 200 OK response with data", () => {
			const testData = { id: 1, name: "Test" };
			responseHelpers.ok(mockRes, {
				message: "Data retrieved",
				data: testData,
			});

			expect(mockRes.status).toHaveBeenCalledWith(200);
			expect(mockRes.json).toHaveBeenCalledWith({
				message: "Data retrieved",
				data: testData,
			});
		});
	});

	describe("created", () => {
		it("should send 201 Created response", () => {
			responseHelpers.created(mockRes, {
				message: "Resource created",
			});

			expect(mockRes.status).toHaveBeenCalledWith(201);
			expect(mockRes.json).toHaveBeenCalledWith({
				message: "Resource created",
			});
		});

		it("should send 201 Created response with data", () => {
			const testData = { id: 1, name: "Test" };
			responseHelpers.created(mockRes, {
				message: "Resource created",
				data: testData,
			});

			expect(mockRes.status).toHaveBeenCalledWith(201);
			expect(mockRes.json).toHaveBeenCalledWith({
				message: "Resource created",
				data: testData,
			});
		});
	});

	describe("noContent", () => {
		it("should send 204 No Content response", () => {
			responseHelpers.noContent(mockRes);

			expect(mockRes.status).toHaveBeenCalledWith(204);
			expect(mockRes.send).toHaveBeenCalled();
			expect(mockRes.json).not.toHaveBeenCalled();
		});

		it("should return early if headers are already sent", () => {
			mockRes.headersSent = true;

			responseHelpers.noContent(mockRes);

			expect(mockRes.status).not.toHaveBeenCalled();
			expect(mockRes.send).not.toHaveBeenCalled();
		});
	});
});

describe("ResponseHandler", () => {
	let mockRes: Response;
	let responseHandler: ResponseHandler;

	beforeEach(() => {
		mockRes = createMockResponse() as any;
		responseHandler = new ResponseHandler(mockRes);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe("success", () => {
		it("should send success response", () => {
			responseHandler.success({
				message: "Operation successful",
				data: { id: 1 },
			});

			expect(mockRes.status).toHaveBeenCalledWith(200);
			expect(mockRes.json).toHaveBeenCalledWith({
				message: "Operation successful",
				data: { id: 1 },
			});
		});

		it("should send success response with custom status code", () => {
			responseHandler.success({
				message: "Resource created",
				data: { id: 1 },
				statusCode: 201,
			});

			expect(mockRes.status).toHaveBeenCalledWith(201);
			expect(mockRes.json).toHaveBeenCalledWith({
				message: "Resource created",
				data: { id: 1 },
			});
		});
	});

	describe("error", () => {
		it("should handle AppError instances", () => {
			const error = createMockBadRequestError("Bad request");
			responseHandler.error(error);

			expect(mockRes.status).toHaveBeenCalled();
			expect(mockRes.json).toHaveBeenCalled();
		});

		it("should handle NotFoundError", () => {
			const error = createMockNotFoundError("Resource not found");
			responseHandler.error(error);

			expect(mockRes.status).toHaveBeenCalled();
			expect(mockRes.json).toHaveBeenCalled();
		});

		it("should handle generic Error instances", () => {
			const error = createMockGenericError("Generic error");
			responseHandler.error(error);

			expect(mockRes.status).toHaveBeenCalled();
			expect(mockRes.json).toHaveBeenCalled();
		});
	});

	describe("ok", () => {
		it("should send 200 OK response", () => {
			responseHandler.ok({
				message: "Operation successful",
			});

			expect(mockRes.status).toHaveBeenCalledWith(200);
			expect(mockRes.json).toHaveBeenCalledWith({
				message: "Operation successful",
			});
		});
	});

	describe("created", () => {
		it("should send 201 Created response", () => {
			responseHandler.created({
				message: "Resource created",
				data: { id: 1 },
			});

			expect(mockRes.status).toHaveBeenCalledWith(201);
			expect(mockRes.json).toHaveBeenCalledWith({
				message: "Resource created",
				data: { id: 1 },
			});
		});
	});

	describe("noContent", () => {
		it("should send 204 No Content response", () => {
			responseHandler.noContent();

			expect(mockRes.status).toHaveBeenCalledWith(204);
			expect(mockRes.send).toHaveBeenCalled();
		});
	});

	describe("Real-world usage example", () => {
		it("should handle a complete controller flow", () => {
			// Simulate successful post creation
			const post = { id: 1, title: "Test Post" };
			responseHandler.created({
				message: "Post created successfully",
				post,
			});

			expect(mockRes.status).toHaveBeenCalledWith(201);
			expect(mockRes.json).toHaveBeenCalledWith({
				message: "Post created successfully",
				post,
			});

			jest.clearAllMocks();

			// Simulate error case
			const error = createMockNotFoundError("Post not found");
			responseHandler.error(error);

			expect(mockRes.status).toHaveBeenCalled();
			expect(mockRes.json).toHaveBeenCalled();
		});
	});
});
