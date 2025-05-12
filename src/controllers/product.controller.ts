import { Request, Response } from 'express';
import Product from '../models/Product';
import { uploadToS3, getS3Url, deleteFromS3 } from '../utils/s3Utils';
import { v4 as uuidv4 } from 'uuid';

// Create Product
export const createProduct = async (req: Request, res: Response) => {
    try {
        const { name, category, short_description, long_description, price, quantity } = req.body;
        const file = req.file;

        if (!file) return res.status(400).json({ error: 'Image is required' });

        // Upload image to S3
        const fileName = `products/${uuidv4()}-${file.originalname}`;
        await uploadToS3(file.buffer, fileName, file.mimetype);
        const imageUrl = await getS3Url(fileName);

        // Create product
        const product = new Product({
            name,
            category,
            short_description,
            long_description,
            price: parseFloat(price),
            quantity: parseInt(quantity),
            imageUrl
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
        const products = await Product.find().sort({ createdAt: -1 });
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch products' });
    }
};

// Get Single Product
export const getProductById = async (req: Request, res: Response): Promise<any> => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ error: 'Product not found' });
        res.json(product);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch product' });
    }
};

// Update Product
export const updateProduct = async (req: Request, res: Response): Promise<any> => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ error: 'Product not found' });

        const { imageUrl, ...updateData } = req.body;
        const file = req.file;

        // Handle image update
        if (file) {
            // Delete old image
            const oldFileName = product.imageUrl.split('/').pop();
            await deleteFromS3(`products/${oldFileName}`);
            
            // Upload new image
            const fileName = `products/${uuidv4()}-${file.originalname}`;
            await uploadToS3(file.buffer, fileName, file.mimetype);
            updateData.imageUrl = await getS3Url(fileName);
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
        const fileName = product.imageUrl.split('/').pop();
        await deleteFromS3(`products/${fileName}`);

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

