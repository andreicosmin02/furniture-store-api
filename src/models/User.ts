import {Schema, model, Document} from 'mongoose';
import bcrypt from 'bcryptjs';

// Define the user interface for TypeScript
interface IUser extends Document {
    email: string;
    password: string;
    role: 'admin' | 'employee';
    createdAt: Date;
    comparePassword: (password: string) => Promise<boolean>;
};

// Create the schema
const userSchema = new Schema<IUser>({
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true, // Remove whitespace
        lowercase: true, // Convert to lowercase
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    role: {
        type: String,
        enum: ['admin', 'employee'],
        default: 'employee'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Hash the password before saving
userSchema.pre<IUser>('save', async function(next) {
    if (!this.isModified('password')) {
        return next();
    }

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// Compare the password
userSchema.methods.comparePassword = async function (password: string) {
    return await bcrypt.compare(password, this.password);
};

export default model<IUser>('User', userSchema);