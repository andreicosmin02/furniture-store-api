import { Request, Response } from 'express';
import Order from '../models/Order';
import Product from '../models/Product';
import { getS3Url, uploadToS3 } from '../utils/s3Utils';
import { v4 as uuidv4 } from 'uuid';

export const createOrder = async (req: Request, res: Response): Promise<any> => {
    try {
        const { products, deliveryInfo } = req.body;
        const userId = req.user.userId;
    
        if (!products || !Array.isArray(products) || products.length === 0) {
            return res.status(400).json({ error: 'No products provided' });
        }
    
        const processedProducts = [];
    
        for (const item of products) {
            const product = await Product.findById(item.product);
            if (!product) {
                return res.status(400).json({ error: `Product ${item.product} not found` });
            }
            if (product.quantity < item.quantity) {
                return res.status(400).json({
                    error: `Insufficient stock for product ${product.name}`
            });
            }
    
            // Prepare imageKey and analysis if provided
            let furnitureImageKey: string | undefined = undefined;
    
            if (item.furnitureImageBase64) {
                const buffer = Buffer.from(item.furnitureImageBase64, 'base64');
                const fileName = `custom-orders/${uuidv4()}.png`;
                await uploadToS3(buffer, fileName, 'image/png');
                furnitureImageKey = fileName;
            }
    
            processedProducts.push({
                product: item.product,
                quantity: item.quantity,
                delivered: false,
                furnitureImageKey,
                customizationAnalysis: item.customizationAnalysis
                    ? JSON.parse(item.customizationAnalysis)
                    : undefined
            });
        }
    
        // Update product stock
        for (const item of processedProducts) {
            await Product.findByIdAndUpdate(
            item.product,
            { $inc: { quantity: -item.quantity } }
            );
        }
    
        const order = new Order({
            user: userId,
            products: processedProducts,
            deliveryInfo
        });
    
        await order.save();
        res.status(201).json(order);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Order creation failed' });
    }
};

export const getOrderById = async (req: Request, res: Response): Promise<any> => {
    try {
        const order = await Order.findById(req.params.id)
            .populate('user', 'firstName lastName email')
            // .populate('products.product', 'name price imageUrl');
            .populate('products.product', 'name price imageKey');

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        // Check ownership or admin
        if (order.user.toString() !== req.user.userId && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // Add image URLs to products
        const orderWithUrls = {
            ...order.toObject(),
            products: await Promise.all(order.products.map(async (p: any) => {
                const product = p.product;
                if (product?.imageKey) {
                    product.imageUrl = await getS3Url(product.imageKey);
                    delete product.imageKey;
                }
                return p;
            }))
        }

        res.json(orderWithUrls);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch order' });
    }
};

export const getUserOrders = async (req: Request, res: Response): Promise<any> => {
    try {
        const orders = await Order.find({ user: req.user.userId })
            .sort('-createdAt')
            .populate('products.product', 'name price imageUrl');

        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
};

export const updateOrderStatus = async (req: Request, res: Response): Promise<any> => {
    try {
        const { status } = req.body;
        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        // Only admin can update status
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        order.status = status;
        await order.save();

        res.json(order);
    } catch (error) {
        res.status(500).json({ error: 'Order update failed' });
    }
};

export const updateProductDeliveryStatus = async (req: Request, res: Response): Promise<any> => {
    try {
        const { orderId, productId } = req.params;
        const order = await Order.findOne({
            _id: orderId,
            'products._id': productId
        });

        if (!order) {
            return res.status(404).json({ error: 'Order or product not found' });
        }

        // Admin or delivery personnel can update
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const product = order.products.find(p => p._id.toString() === productId);
        if (product) {
            product.delivered = req.body.delivered;
            await order.save();
        }

        res.json(order);
    } catch (error) {
        res.status(500).json({ error: 'Delivery status update failed' });
    }
};

export const getAllOrders = async (req: Request, res: Response): Promise<any> => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const orders = await Order.find()
            .sort('-createdAt')
            .populate('user', 'firstName lastName email')
            // .populate('products.product', 'name price imageUrl');
            .populate('products.product', 'name price imageKey');

        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
};