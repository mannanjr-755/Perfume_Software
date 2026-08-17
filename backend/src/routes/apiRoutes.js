import { Router } from 'express';
import Customer from '../models/Customer.js';
import Notification from '../models/Notification.js';
import Settings from '../models/Settings.js';
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

const router = Router();

const productController = createCrudController(productService, 'products');
const orderController = createCrudController(orderService, 'orders');
const customerController = createCrudController(customerService, 'customers');
const categoryController = createCrudController(categoryService, 'categories');
const brandController = createCrudController(brandService, 'brands');

router.get('/products', productController.list);
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

router.post('/products/:id/generate-barcode', async (req, res, next) => {
  try {
    const product = await productService.assignBarcode(req.params.id);
    return success(res, 'Barcode generated and assigned', product);
  } catch (error) {
    next(error);
  }
});

const notificationService = createCrudService(Notification, { searchFields: ['title', 'message'] });
const notificationController = createCrudController(notificationService, 'notifications');

router.get('/notifications', notificationController.list);
router.get('/notifications/:id', notificationController.getOne);
router.post('/notifications', notificationController.create);
router.put('/notifications/:id', notificationController.update);
router.delete('/notifications/:id', notificationController.remove);

router.put('/notifications/:id/read', async (req, res, next) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { read: true },
      { new: true, runValidators: true }
    );
    if (!notification) throw new AppError('Record not found', 404);
    return success(res, 'Notification marked as read', notification);
  } catch (error) {
    next(error);
  }
});

router.post('/notifications/read-all', async (_req, res, next) => {
  try {
    const result = await Notification.updateMany({}, { read: true });
    return success(res, 'All notifications marked as read', { modified: result.modifiedCount });
  } catch (error) {
    next(error);
  }
});

router.delete('/notifications', async (_req, res, next) => {
  try {
    const result = await Notification.deleteMany({});
    return success(res, 'All notifications cleared', { deleted: result.deletedCount });
  } catch (error) {
    next(error);
  }
});

router.get('/settings', async (_req, res, next) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) settings = await Settings.create({ currency: 'PKR' });
    if (settings.currency !== 'PKR') {
      settings.currency = 'PKR';
      await settings.save();
    }
    if (!settings.orderPrefix) {
      settings.orderPrefix = 'PFM-';
      await settings.save();
    }
    return success(res, 'Settings fetched', settings);
  } catch (error) {
    next(error);
  }
});

router.put('/settings', async (req, res, next) => {
  try {
    const payload = { ...req.body, currency: 'PKR' };
    let settings = await Settings.findOne();
    if (!settings) settings = await Settings.create(payload);
    else {
      Object.assign(settings, payload);
      await settings.save();
    }
    return success(res, 'Settings updated', settings);
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
