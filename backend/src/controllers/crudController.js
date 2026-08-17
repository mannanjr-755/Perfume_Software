import { success, fail } from '../utils/apiResponse.js';

export function createCrudController(service, resourceName = 'items') {
  return {
    async list(req, res, next) {
      try {
        const data = await service.list(req.query);
        return success(res, `${resourceName} fetched`, data);
      } catch (error) {
        next(error);
      }
    },

    async getOne(req, res, next) {
      try {
        const item = await service.getById(req.params.id);
        return success(res, `${resourceName} fetched`, item);
      } catch (error) {
        next(error);
      }
    },

    async create(req, res, next) {
      try {
        const item = await service.create(req.body);
        return success(res, `${resourceName} created`, item, 201);
      } catch (error) {
        next(error);
      }
    },

    async update(req, res, next) {
      try {
        const item = await service.update(req.params.id, req.body);
        return success(res, `${resourceName} updated`, item);
      } catch (error) {
        next(error);
      }
    },

    async remove(req, res, next) {
      try {
        await service.delete(req.params.id);
        return success(res, `${resourceName} deleted`);
      } catch (error) {
        next(error);
      }
    },
  };
}
