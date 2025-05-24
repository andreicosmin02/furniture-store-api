import { Request, Response } from 'express';
import Product from '../models/Product';
import { uploadToS3, getS3Url, deleteFromS3 } from '../utils/s3Utils';
import { v4 as uuidv4 } from 'uuid';
import { s3Client } from '../config/s3';
import { GetObjectCommand } from '@aws-sdk/client-s3';

// Create Product
export const createProduct = async (req: Request, res: Response) => {
    try {
        const { name, category, short_description, long_description, price, quantity } = req.body;
        const file = req.file;

        if (!file) return res.status(400).json({ error: 'Image is required' });

        // Upload image to S3
        const fileName = `products/${uuidv4()}-${file.originalname}`;
        await uploadToS3(file.buffer, fileName, file.mimetype);

        // Create product
        const product = new Product({
            name,
            category,
            short_description,
            long_description,
            price: parseFloat(price),
            quantity: parseInt(quantity),
            imageKey: fileName
        });

        await product.save();
        res.status(201).json(product);
    } catch (error) {
        res.status(500).json({ error: 'Product creation failed' });
    }
};

// Get All Products
export const getAllProducts = async (req: Request, res: Response) => {
    try {
        // const products = await Product.find().sort({ createdAt: -1 });
        const products = await Product.find().sort({ createdAt: -1 }).select('-imageKey'); // Don't expose the key
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch products' });
    }
};

// Get Single Product
export const getProductById = async (req: Request, res: Response): Promise<any> => {
    try {
        // const product = await Product.findById(req.params.id);
        const product = await Product.findById(req.params.id).select('-imageKey'); // Don't expose the key
        if (!product) return res.status(404).json({ error: 'Product not found' });
        res.json(product);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch product' });
    }
};

export const getProductImage = async (req: Request, res: Response): Promise<any> => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ error: 'Product not found' });

        const params = {
            Bucket: process.env.AWS_S3_BUCKET_NAME!,
            Key: product.imageKey
        };

        const { Body, ContentType } = await s3Client.send(new GetObjectCommand(params));

        // Set proper headers
        res.set({
            'Content-Type': ContentType || 'application/octet-stream',
            'Cache-Control': 'public, max-age=31536000' // 1 year cache
        });

        // Stream the image data directly from S3
        (Body as NodeJS.ReadableStream).pipe(res);
    } catch (error) {
        res.status(404).json({ error: 'Image not found' });
    }
};

// Update Product
export const updateProduct = async (req: Request, res: Response): Promise<any> => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ error: 'Product not found' });

        // const { imageUrl, ...updateData } = req.body;
        const { imageKey, ...updateData } = req.body;
        const file = req.file;

        // Handle image update
        if (file) {
            // Delete old image
            // const oldFileName = product.imageUrl.split('/').pop();
            await deleteFromS3(product.imageKey);
            // await deleteFromS3(`products/${oldFileName}`);
            
            // Upload new image
            const fileName = `products/${uuidv4()}-${file.originalname}`;
            await uploadToS3(file.buffer, fileName, file.mimetype);
            // updateData.imageUrl = await getS3Url(fileName);
            updateData.imageKey = fileName;
        }

        const updatedProduct = await Product.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        );

        res.json(updatedProduct);
    } catch (error) {
        res.status(500).json({ error: 'Product update failed' });
    }
};

// Delete Product
export const deleteProduct = async (req: Request, res: Response): Promise<any> => {
    try {
        const product = await Product.findByIdAndDelete(req.params.id);
        if (!product) return res.status(404).json({ error: 'Product not found' });

        // Delete image from S3
        // const fileName = product.imageUrl.split('/').pop();
        // await deleteFromS3(`products/${fileName}`);
        await deleteFromS3(product.imageKey);

        res.json({ message: 'Product deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Product deletion failed' });
    }
};

// Update Stock Quantity
export const updateStock = async (req: Request, res: Response): Promise<any> => {
    try {
        const { quantity } = req.body;
        const product = await Product.findByIdAndUpdate(
            req.params.id,
            { quantity },
            { new: true, runValidators: true }
        );
        res.json(product);
    } catch (error) {
        res.status(500).json({ error: 'Stock update failed' });
    }
};

