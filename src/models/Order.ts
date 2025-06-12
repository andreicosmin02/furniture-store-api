import { Schema, model, Document, Types } from 'mongoose';

interface IOrderProduct {
    _id: Types.ObjectId;
    product: Types.ObjectId;
    furnitureImageKey?: string,
    customizationAnalysis?: any;
    quantity: number;
    delivered: boolean;
}

interface IDeliveryInfo {
    fullName: string;
    phone: string;
    email: string;
    address: string;
    notes?: string;
}

interface IOrder extends Document {
    user: Types.ObjectId;
    products: IOrderProduct[];
    status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
    deliveryInfo: IDeliveryInfo;
    createdAt: Date;
    updatedAt: Date;
}

const orderSchema = new Schema<IOrder>({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    products: [{
        product: {
            type: Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        quantity: {
            type: Number,
            required: true,
            min: 1
        },
        delivered: {
            type: Boolean,
            default: false
        },
        furnitureImageKey: String,
        customizationAnalysis: Schema.Types.Mixed
    }],
    status: {
        type: String,
        enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
        default: 'pending'
    },
    deliveryInfo: {
        fullName: {
            type: String,
            required: true
        },
        phone: {
            type: String,
            required: true
        },
        email: {
            type: String,
            required: true
        },
        address: {
            type: String,
            required: true
        },
        notes: String
    }
}, {
    timestamps: true
});

export default model<IOrder>('Order', orderSchema);