import { prisma } from '../lib/prisma';
import type { ReportStatus } from '@prisma/client';

export async function createPostReport(postId: string, reporterId: string, reason: string) {
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) {
    throw new Error('Post not found');
  }

  const existing = await prisma.postReport.findUnique({
    where: { postId_reporterId: { postId, reporterId } },
  });
  if (existing) {
    throw new Error('You have already reported this post');
  }

  const report = await prisma.postReport.create({
    data: { postId, reporterId, reason },
    include: {
      post: { select: { id: true, title: true, slug: true } },
      reporter: { select: { id: true, username: true } },
    },
  });
  return report;
}

export async function listPostReports(page: number, limit: number) {
  const skip = (page - 1) * limit;
  const [reports, total] = await Promise.all([
    prisma.postReport.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        post: { select: { id: true, title: true, slug: true } },
        reporter: { select: { id: true, username: true } },
      },
    }),
    prisma.postReport.count(),
  ]);
  return { reports, total, page, limit };
}

export async function updatePostReportStatus(reportId: string, status: ReportStatus) {
  const report = await prisma.postReport.findUnique({ where: { id: reportId } });
  if (!report) {
    throw new Error('Report not found');
  }
  const updated = await prisma.postReport.update({
    where: { id: reportId },
    data: { status },
    include: {
      post: { select: { id: true, title: true, slug: true } },
      reporter: { select: { id: true, username: true } },
    },
  });
  return updated;
}