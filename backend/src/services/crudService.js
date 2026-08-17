import { AppError } from '../utils/AppError.js';

export function createCrudService(Model, { searchFields = ['name'] } = {}) {
  return {
    async list(query = {}) {
      const { search, status, page = 1, limit = 50 } = query;
      const filter = {};

      if (status) filter.status = status;
      if (search && searchFields.length) {
        filter.$or = searchFields.map((field) => ({
          [field]: { $regex: search, $options: 'i' },
        }));
      }

      const skip = (Number(page) - 1) * Number(limit);
      const [items, total] = await Promise.all([
        Model.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
        Model.countDocuments(filter),
      ]);

      return { items, total, page: Number(page), limit: Number(limit) };
    },

    async getById(id) {
      const item = await Model.findById(id);
      if (!item) throw new AppError('Record not found', 404);
      return item;
    },

    async create(data) {
      return Model.create(data);
    },

    async update(id, data) {
      const item = await Model.findByIdAndUpdate(id, data, { new: true, runValidators: true });
      if (!item) throw new AppError('Record not found', 404);
      return item;
    },

    async delete(id) {
      const item = await Model.findByIdAndDelete(id);
      if (!item) throw new AppError('Record not found', 404);
      return item;
    },
  };
}
