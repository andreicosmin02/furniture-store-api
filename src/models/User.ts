import {Schema, model, Document} from 'mongoose';
import bcrypt from 'bcryptjs';

// Define the user interface for TypeScript
interface IUser extends Document {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    role: 'admin' | 'employee' | 'customer';
    createdAt: Date;
    comparePassword: (password: string) => Promise<boolean>;
};

// Create the schema
const userSchema = new Schema<IUser>({
    firstName: {
        type: String,
        required: true,
        trim: true
    },
    lastName: {
        type: String,
        required: true,
        trim: true
    },
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
        enum: ['admin', 'employee', 'customer'],
        default: 'customer'
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

userSchema.set('toJSON', {
    transform: function(doc, ret) {
        delete ret.password;
        delete ret.__v;
        return ret;
    }
});

export default model<IUser>('User', userSchema);