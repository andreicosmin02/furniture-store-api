# Furniture Store API

Backend for managing furniture inventory, orders, user authentication, and AI-powered room design analysis for the [andreicosmin02/furniture-store-app](https://github.com/andreicosmin02/furniture-store-app).

## Features

- JWT-based authentication for admin, employee, and customer roles
- User profile management and admin user management
- Product CRUD with S3 image storage and retrieval
- Order creation, tracking, and management
- AI endpoints for:
  - Analyzing room images and matching products
  - Generating AI-based room visuals with selected furniture
  - Custom furniture placement recommendations
- Health check endpoint for uptime monitoring

## Setup

1. Clone the repo:

```bash
git clone https://github.com/andreicosmin02/furniture-store-api.git
cd furniture-store-api
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file in the root with the following:

```
MONGODB_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret
PORT=3000

AWS_S3_BUCKET_NAME=your_bucket_name
AWS_S3_BUCKET_REGION=your_region
AWS_S3_ACCESS_KEY=your_access_key
AWS_S3_SECRET_ACCESS_KEY=your_secret_access_key

OPENAI_API_KEY=your_openai_key

FIRST_ADMIN_EMAIL=admin@yourstore.com
FIRST_ADMIN_PASSWORD=adminpassword
FIRST_ADMIN_FIRST_NAME=Admin
FIRST_ADMIN_LAST_NAME=User
```

4. Start the server:

```bash
npm run dev
```

The server will run at `http://localhost:3000`.

## API Structure

- **Auth Routes:** `POST /auth/login`, `POST /auth/register/customer`, `POST /auth/register` (admin)
- **User Routes:** `/users/me`, `/users/:id` (admin)
- **Product Routes:** CRUD, image retrieval, category listing, category filtering, and search
- **Order Routes:** Create orders, get user orders, manage orders (admin), update statuses
- **AI Routes:** Analyze rooms, generate AI-designed room images, analyze furniture placement, generate furniture visuals with/without room context

## Tech Stack

- Node.js + Express
- TypeScript
- MongoDB + Mongoose
- AWS S3 for image storage
- OpenAI API for room design analysis and generation
- JWT for authentication
- Multer for image uploads

## Development Notes

- The API automatically creates a first admin user if `FIRST_ADMIN_EMAIL` and `FIRST_ADMIN_PASSWORD` are set.
- Use **Postman or Thunder Client** to test protected routes with JWT tokens.
- Designed for easy integration with [andreicosmin02/furniture-store-app](https://github.com/andreicosmin02/furniture-store-app).

## No License

This project does not use a license. Use, adapt, or extend it freely in your own workflow.

---

Build and refine your furniture management backend confidently with this clean, extendable architecture.
