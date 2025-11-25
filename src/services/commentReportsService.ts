import { prisma } from '../lib/prisma';
import type { ReportStatus } from '@prisma/client';

export async function createCommentReport(commentId: string, reporterId: string, reason: string) {
  const comment = await prisma.comment.findUnique({ where: { id: commentId } });
  if (!comment) {
    throw new Error('Comment not found');
  }

  const existing = await prisma.commentReport.findUnique({
    where: { commentId_reporterId: { commentId, reporterId } },
  });
  if (existing) {
    throw new Error('You have already reported this comment');
  }

  const report = await prisma.commentReport.create({
    data: { commentId, reporterId, reason },
    include: {
      comment: {
        select: {
          id: true,
          content: true,
          postId: true,
          post: { select: { id: true, title: true, slug: true } },
        },
      },
      reporter: { select: { id: true, username: true } },
    },
  });
  return report;
}

export async function listCommentReports(page: number, limit: number) {
  const skip = (page - 1) * limit;
  const [reports, total] = await Promise.all([
    prisma.commentReport.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        comment: {
          select: {
            id: true,
            content: true,
            postId: true,
            post: { select: { id: true, title: true, slug: true } },
            user: { select: { id: true, username: true } },
          },
        },
        reporter: { select: { id: true, username: true } },
      },
    }),
    prisma.commentReport.count(),
  ]);
  return { reports, total, page, limit };
}

export async function updateCommentReportStatus(reportId: string, status: ReportStatus) {
  const report = await prisma.commentReport.findUnique({ where: { id: reportId } });
  if (!report) {
    throw new Error('Report not found');
  }
  const updated = await prisma.commentReport.update({
    where: { id: reportId },
    data: { status },
    include: {
      comment: {
        select: {
          id: true,
          content: true,
          postId: true,
          post: { select: { id: true, title: true, slug: true } },
        },
      },
      reporter: { select: { id: true, username: true } },
    },
  });
  return updated;
}
