import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema(
  {
    storeName: { type: String, default: 'Scent Yours' },
    storeEmail: { type: String, default: 'hello@scentyours.com' },
    storePhone: { type: String, default: '' },
    currency: { type: String, default: 'PKR' },
    taxRate: { type: Number, default: 0 },
    lowStockThreshold: { type: Number, default: 5, min: 0 },
    address: { type: String, default: '' },
    phone: { type: String, default: '' },
    logo: { type: String, default: '' },
    orderPrefix: { type: String, default: 'PFM-' },
    notifyLowStock: { type: Boolean, default: true },
    notifyNewOrder: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model('Settings', settingsSchema);
