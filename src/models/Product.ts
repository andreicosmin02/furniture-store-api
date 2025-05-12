import { Schema, model, Document } from 'mongoose';

interface IProduct extends Document {
    name: string,
    category: string;
    short_description: string;
    long_description: string;
    price: number;
    imageUrl: string;
    quantity: number;
    createdAt: Date;
    updatedAt: Date;
}

const productSchema = new Schema<IProduct>({
    name: {
        type: String,
        required: true,
        trim: true
    },
    category: {
        type: String,
        required: true
    },
    short_description: {
        type: String,
        required: true,
        maxlength: 160
    },
    long_description: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    imageUrl: {
        type: String,
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 0,
        default: 0
    }
}, {
    timestamps: true
});

export default model <IProduct>('Product', productSchema);