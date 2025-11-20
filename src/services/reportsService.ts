import { prisma } from '../lib/prisma';
// import type { ReportStatus } from '@prisma/client'; // Commented out - not in schema
type ReportStatus = 'PENDING' | 'REVIEWED' | 'REJECTED';

export async function createPostReport(postId: string, reporterId: string, reason: string) {
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) {
    throw new Error('Post not found');
  }

  const existing = await (prisma as any).postReport.findUnique({
    where: { postId_reporterId: { postId, reporterId } },
  });
  if (existing) {
    throw new Error('You have already reported this post');
  }

  const report = await (prisma as any).postReport.create({
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
    (prisma as any).postReport.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        post: { select: { id: true, title: true, slug: true } },
        reporter: { select: { id: true, username: true } },
      },
    }),
    (prisma as any).postReport.count(),
  ]);
  return { reports, total, page, limit };
}

export async function updatePostReportStatus(reportId: string, status: ReportStatus) {
  const report = await (prisma as any).postReport.findUnique({ where: { id: reportId } });
  if (!report) {
    throw new Error('Report not found');
  }
  const updated = await (prisma as any).postReport.update({
    where: { id: reportId },
    data: { status },
    include: {
      post: { select: { id: true, title: true, slug: true } },
      reporter: { select: { id: true, username: true } },
    },
  });
  return updated;
}