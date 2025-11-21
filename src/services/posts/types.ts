export interface PostFilters {
	title?: string;
	authorId?: string;
	categoryId?: string;
	tag?: string;
	fromDate?: string;
	toDate?: string;
}

export interface PaginationParams {
	page: number;
	limit: number;
}

export interface SortParams {
	sortBy?: string;
	sortOrder?: string;
}

export interface CreatePostData {
	title: string;
	content: string;
	published?: boolean;
	featured?: boolean;
	categoryId?: string | null;
	metaTitle?: string | null;
	metaDescription?: string | null;
	ogImage?: string | null;
	tags?: string[];
}

export interface UpdatePostData {
	title?: string;
	content?: string;
	published?: boolean;
	featured?: boolean;
	categoryId?: string | null;
	metaTitle?: string | null;
	metaDescription?: string | null;
	ogImage?: string | null;
	tags?: string[];
}

