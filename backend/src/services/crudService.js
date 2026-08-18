import { AppError } from '../utils/AppError.js';
import { query } from '../config/database.js';
import { camelToSnake, rowToDoc, buildInsert, buildUpdate } from '../db/columns.js';

function validId(id) {
  const num = Number(id);
  return Number.isInteger(num) && num > 0 ? num : null;
}

export function createCrudService(table, { searchFields = ['name'] } = {}) {
  const fields = searchFields.map(camelToSnake);

  return {
    async list(queryParams = {}) {
      const { search, status, page = 1, limit = 50 } = queryParams;
      const where = [];
      const params = [];

      if (status) {
        params.push(status);
        where.push(`status = $${params.length}`);
      }
      if (search && fields.length) {
        const escaped = String(search).replace(/[%_\\]/g, (c) => `\\${c}`);
        const ors = fields.map((field) => {
          params.push(`%${escaped}%`);
          return `${field} ILIKE $${params.length}`;
        });
        where.push(`(${ors.join(' OR ')})`);
      }

      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const offset = (Number(page) - 1) * Number(limit);
      const [itemsRes, totalRes] = await Promise.all([
        query(
          `SELECT * FROM ${table} ${whereSql} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
          [...params, Number(limit), offset]
        ),
        query(`SELECT COUNT(*) AS total FROM ${table} ${whereSql}`, params),
      ]);

      return {
        items: itemsRes.rows.map(rowToDoc),
        total: Number(totalRes.rows[0].total || 0),
        page: Number(page),
        limit: Number(limit),
      };
    },

    async getById(id) {
      const num = validId(id);
      if (!num) throw new AppError('Record not found', 404);
      const res = await query(`SELECT * FROM ${table} WHERE id = $1`, [num]);
      const item = res.rows[0];
      if (!item) throw new AppError('Record not found', 404);
      return rowToDoc(item);
    },

    async create(data) {
      const { columns, values } = buildInsert(table, data);
      const res = await query(
        `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
        values
      );
      return rowToDoc(res.rows[0]);
    },

    async update(id, data) {
      const num = validId(id);
      if (!num) throw new AppError('Record not found', 404);
      const { sets, values } = buildUpdate(table, data);
      if (!sets.length) return this.getById(num);
      const res = await query(
        `UPDATE ${table} SET ${sets.join(', ')}, updated_at = now() WHERE id = $${values.length + 1} RETURNING *`,
        [...values, num]
      );
      const item = res.rows[0];
      if (!item) throw new AppError('Record not found', 404);
      return rowToDoc(item);
    },

    async delete(id) {
      const num = validId(id);
      if (!num) throw new AppError('Record not found', 404);
      const res = await query(`DELETE FROM ${table} WHERE id = $1 RETURNING *`, [num]);
      if (!res.rows[0]) throw new AppError('Record not found', 404);
      return rowToDoc(res.rows[0]);
    },
  };
}