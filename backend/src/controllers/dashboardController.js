import * as dashboardService from '../services/dashboardService.js';
import { success } from '../utils/apiResponse.js';

export async function stats(req, res, next) {
  try {
    const data = await dashboardService.getDashboardStats({ range: req.query.range });
    return success(res, 'Dashboard stats fetched', data);
  } catch (error) {
    next(error);
  }
}

export async function reports(req, res, next) {
  try {
    const data = await dashboardService.getReports(req.query);
    return success(res, 'Reports fetched', data);
  } catch (error) {
    next(error);
  }
}
