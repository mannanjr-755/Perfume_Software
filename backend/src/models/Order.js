import mongoose from 'mongoose';
import Counter from './Counter.js';
import Settings from './Settings.js';

const orderItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    productName: { type: String, required: true },
    brand: { type: String, default: '' },
    category: { type: String, default: '' },
    description: { type: String, default: '' },
    image: { type: String, default: '' },
    barcode: { type: String, default: '' },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, unique: true, sparse: true },
    customerName: { type: String, required: true, trim: true },
    customerEmail: { type: String, trim: true, lowercase: true },
    customerPhone: { type: String, trim: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: undefined },
    items: [orderItemSchema],
    subtotal: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    tax: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
      default: 'pending',
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'refunded'],
      default: 'pending',
    },
    shippingMethod: { type: String, default: '' },
    paymentMethod: {
      type: String,
      enum: ['Cash', 'Card', 'Bank Transfer', 'JazzCash', 'EasyPaisa'],
      default: 'Cash',
    },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

orderSchema.pre('save', async function assignOrderNumber(next) {
  if (this.orderNumber) return next();
  try {
    const settings = await Settings.findOne().select('orderPrefix').lean();
    const prefix = settings?.orderPrefix || 'PFM-';
    const counter = await Counter.findOneAndUpdate(
      { name: 'orders' },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    this.orderNumber = `${prefix}${String(counter.seq).padStart(4, '0')}`;
    return next();
  } catch (error) {
    return next(error);
  }
});

export default mongoose.model('Order', orderSchema);
