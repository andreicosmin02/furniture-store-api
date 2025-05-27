import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDB from './config/db';
import authRoutes from './routes/auth.routes';
import User from './models/User';
import userRoutes from './routes/user.routes';
import productRoutes from './routes/product.routes';
import orderRoutes from './routes/order.routes';
import aiRoutes from './routes/ai.routes';

// Load environment variables
dotenv.config();

// Create express app
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json()); // Parse JSON bodies

// Database connection and first admin creation
const createFirstAdmin = async () => {
    const adminEmail = process.env.FIRST_ADMIN_EMAIL;
    const adminPassword = process.env.FIRST_ADMIN_PASSWORD;
    const adminFirstName = process.env.FIRST_ADMIN_FIRST_NAME || 'Admin';
    const adminLastName = process.env.FIRST_ADMIN_LAST_NAME || 'User';

    if (!adminEmail || !adminPassword) {
        console.log('FIRST_ADMIN_EMAIL/PASSWORD not set - skipping admin creation');
        return;
    }

    try {
        // Check if admin already exists
        const existingAdmin = await User.findOne({ email: adminEmail });

        if (!existingAdmin) {
            const admin = new User({
                firstName: adminFirstName,
                lastName: adminLastName,
                email: adminEmail,
                password: adminPassword, // Will be hashed automatically by User model's pre-save hook
                role: 'admin'
            });

            await admin.save();
            console.log('First admin created automatically');
        }
    } catch (error) {
        console.error('Error creating first admin:', error);

    }
};

// Connect to MongoDB and create first admin
connectDB()
    .then(createFirstAdmin)
    .catch(error => {
        console.error('Error connecting to database:', error);
        process.exit(1);
    });

app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/products', productRoutes);
app.use('/orders', orderRoutes);
app.use('/ai', aiRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});


// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});