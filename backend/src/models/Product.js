import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    sku: {
      type: String,
      trim: true,
      uppercase: true,
      default: undefined,
      unique: true,
      sparse: true,
    },
    brand: { type: String, trim: true },
    category: { type: String, trim: true },
    description: { type: String, default: '' },
    purchasePrice: { type: Number, default: 0, min: 0 },
    price: { type: Number, required: true, min: 0 },
    stock: { type: Number, default: 0, min: 0 },
    lowStockThreshold: { type: Number, default: 5, min: 0 },
    image: { type: String, default: '' },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    barcode: {
      type: String,
      trim: true,
      uppercase: true,
      default: undefined,
      unique: true,
      sparse: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model('Product', productSchema);
