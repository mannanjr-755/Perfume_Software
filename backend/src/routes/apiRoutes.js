import { Router } from 'express';
import { createCrudService } from '../services/crudService.js';
import { createCrudController } from '../controllers/crudController.js';
import { productService } from '../services/productService.js';
import { orderService } from '../services/orderService.js';
import { customerService } from '../services/customerService.js';
import { categoryService } from '../services/categoryService.js';
import { brandService } from '../services/brandService.js';
import { searchAll } from '../services/searchService.js';
import * as dashboardController from '../controllers/dashboardController.js';
import { success } from '../utils/apiResponse.js';
import { AppError } from '../utils/AppError.js';
import { query } from '../config/database.js';
import { rowToDoc, buildInsert, buildUpdate } from '../db/columns.js';

const router = Router();

const productController = createCrudController(productService, 'products');
const orderController = createCrudController(orderService, 'orders');
const customerController = createCrudController(customerService, 'customers');
const categoryController = createCrudController(categoryService, 'categories');
const brandController = createCrudController(brandService, 'brands');

router.get('/products', productController.list);

router.get('/products/barcode/:barcode', async (req, res, next) => {
  try {
    const product = await productService.findByBarcode(req.params.barcode);
    return success(res, 'Product found by barcode', product);
  } catch (error) {
    next(error);
  }
});

router.post('/products/barcode/generate', async (_req, res, next) => {
  try {
    const barcode = await productService.nextBarcode();
    return success(res, 'Barcode generated', { barcode });
  } catch (error) {
    next(error);
  }
});

router.get('/products/:id', productController.getOne);
router.post('/products', productController.create);
router.put('/products/:id', productController.update);
router.delete('/products/:id', productController.remove);

router.get('/orders', orderController.list);
router.get('/orders/:id', orderController.getOne);
router.post('/orders', orderController.create);
router.put('/orders/:id', orderController.update);
router.delete('/orders/:id', orderController.remove);

router.get('/customers', customerController.list);
router.get('/customers/:id', customerController.getOne);
router.post('/customers', customerController.create);
router.put('/customers/:id', customerController.update);
router.delete('/customers/:id', customerController.remove);

router.get('/categories', categoryController.list);
router.get('/categories/:id', categoryController.getOne);
router.post('/categories', categoryController.create);
router.put('/categories/:id', categoryController.update);
router.delete('/categories/:id', categoryController.remove);

router.get('/brands', brandController.list);
router.get('/brands/:id', brandController.getOne);
router.post('/brands', brandController.create);
router.put('/brands/:id', brandController.update);
router.delete('/brands/:id', brandController.remove);

router.post('/products/:id/generate-barcode', async (req, res, next) => {
  try {
    const product = await productService.assignBarcode(req.params.id);
    return success(res, 'Barcode generated and assigned', product);
  } catch (error) {
    next(error);
  }
});

const notificationService = createCrudService('notifications', { searchFields: ['title', 'message'] });
const notificationController = createCrudController(notificationService, 'notifications');

router.get('/notifications', notificationController.list);
router.get('/notifications/:id', notificationController.getOne);
router.post('/notifications', notificationController.create);
router.put('/notifications/:id', notificationController.update);
router.delete('/notifications/:id', notificationController.remove);

router.put('/notifications/:id/read', async (req, res, next) => {
  try {
    const num = Number(req.params.id);
    if (!Number.isInteger(num) || num <= 0) throw new AppError('Record not found', 404);
    const result = await query(
      'UPDATE notifications SET read = TRUE, updated_at = now() WHERE id = $1 RETURNING *',
      [num]
    );
    if (!result.rows[0]) throw new AppError('Record not found', 404);
    return success(res, 'Notification marked as read', rowToDoc(result.rows[0]));
  } catch (error) {
    next(error);
  }
});

router.post('/notifications/read-all', async (_req, res, next) => {
  try {
    const result = await query('UPDATE notifications SET read = TRUE, updated_at = now()');
    return success(res, 'All notifications marked as read', { modified: result.rowCount });
  } catch (error) {
    next(error);
  }
});

router.delete('/notifications', async (_req, res, next) => {
  try {
    const result = await query('DELETE FROM notifications');
    return success(res, 'All notifications cleared', { deleted: result.rowCount });
  } catch (error) {
    next(error);
  }
});

router.get('/settings', async (_req, res, next) => {
  try {
    let settings = await query('SELECT * FROM settings ORDER BY id LIMIT 1');
    if (!settings.rows[0]) {
      settings = await query(
        `INSERT INTO settings (currency) VALUES ('PKR') RETURNING *`
      );
    }
    let doc = rowToDoc(settings.rows[0]);
    if (doc.currency !== 'PKR') {
      const updated = await query(
        'UPDATE settings SET currency = $1, updated_at = now() WHERE id = $2 RETURNING *',
        ['PKR', Number(doc._id)]
      );
      doc = rowToDoc(updated.rows[0]);
    }
    if (!doc.orderPrefix) {
      const updated = await query(
        'UPDATE settings SET order_prefix = $1, updated_at = now() WHERE id = $2 RETURNING *',
        ['PFM-', Number(doc._id)]
      );
      doc = rowToDoc(updated.rows[0]);
    }
    return success(res, 'Settings fetched', doc);
  } catch (error) {
    next(error);
  }
});

router.put('/settings', async (req, res, next) => {
  try {
    const payload = { ...req.body, currency: 'PKR' };
    let settings = await query('SELECT * FROM settings ORDER BY id LIMIT 1');
    if (!settings.rows[0]) {
      const { columns, values } = buildInsert('settings', payload);
      const inserted = await query(
        `INSERT INTO settings (${columns.join(', ')}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
        values
      );
      return success(res, 'Settings updated', rowToDoc(inserted.rows[0]));
    }
    const { sets, values } = buildUpdate('settings', payload);
    const id = Number(settings.rows[0].id);
    if (!sets.length) {
      return success(res, 'Settings updated', rowToDoc(settings.rows[0]));
    }
    const updated = await query(
      `UPDATE settings SET ${sets.join(', ')}, updated_at = now() WHERE id = $${values.length + 1} RETURNING *`,
      [...values, id]
    );
    return success(res, 'Settings updated', rowToDoc(updated.rows[0]));
  } catch (error) {
    next(error);
  }
});

router.get('/search', async (req, res, next) => {
  try {
    const data = await searchAll(req.query.q);
    return success(res, 'Search results', data);
  } catch (error) {
    next(error);
  }
});

router.get('/dashboard/stats', dashboardController.stats);
router.get('/reports', dashboardController.reports);

export default router;