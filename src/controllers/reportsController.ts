import { Response } from 'express';
import { AuthRequest } from '../utils/auth';
import * as reportsService from '../services/reportsService';
import { ReportStatus } from '@prisma/client';

export async function reportPost(req: AuthRequest, res: Response): Promise<Response> {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const { postId } = req.params;
  const { reason } = req.body;
  try {
    const report = await reportsService.createPostReport(postId, req.user.id, reason);
    return res.status(201).json({ report });
  } catch (e: any) {
    const message = e.message || 'Failed to create report';
    const status = message === 'Post not found' ? 404 : message === 'You have already reported this post' ? 409 : 400;
    return res.status(status).json({ error: message });
  }
}

export async function getReports(req: AuthRequest, res: Response): Promise<Response> {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const data = await reportsService.listPostReports(page, limit);
  return res.json(data);
}

export async function updateReportStatus(req: AuthRequest, res: Response): Promise<Response> {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  const { id } = req.params;
  const { status } = req.body;
  if (!status || !['PENDING', 'REVIEWED', 'REJECTED'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  try {
    const updated = await reportsService.updatePostReportStatus(id, status as ReportStatus);
    return res.json({ report: updated });
  } catch (e: any) {
    const message = e.message || 'Failed to update report';
    const httpStatus = message === 'Report not found' ? 404 : 400;
    return res.status(httpStatus).json({ error: message });
  }
}