import { Request, Response } from 'express';
import Order from '../models/Order';
import Product from '../models/Product';

export const createOrder = async (req: Request, res: Response): Promise<any> => {
    try {
        const { products, deliveryInfo } = req.body;
        const userId = req.user.userId;

        // Validate products
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
        }

        const order = new Order({
            user: userId,
            products,
            deliveryInfo
        });

        // Update product quantities
        for (const item of products) {
            await Product.findByIdAndUpdate(
                item.product,
                { $inc: { quantity: -item.quantity } }
            );
        }

        await order.save();
        res.status(201).json(order);
    } catch (error) {
        res.status(500).json({ error: 'Order creation failed' });
    }
};

export const getOrderById = async (req: Request, res: Response): Promise<any> => {
    try {
        const order = await Order.findById(req.params.id)
            .populate('user', 'firstName lastName email')
            .populate('products.product', 'name price imageUrl');

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        // Check ownership or admin
        if (order.user.toString() !== req.user.userId && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        res.json(order);
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
            .populate('products.product', 'name price imageUrl');

        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
};