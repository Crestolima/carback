# Car Rental Backend

This is the backend server for the Car Rental application built with the MERN stack.

## Tech Stack

- Node.js
- Express.js
- MongoDB
- Mongoose

## Workflow

1. Client sends HTTP request to API endpoints
2. Request passes through authentication middleware
3. Valid requests are routed to appropriate controllers
4. Controllers process the request using models
5. Models interact with MongoDB database
6. Response is sent back to client

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Create a `.env` file with your MongoDB connection string
4. Run the server: `npm start`

## API Endpoints

- `/api/cars` - Car management
- `/api/users` - User management
- `/api/bookings` - Booking management

## Features

- RESTful API design
- MongoDB database integration
- Authentication & Authorization
- Input validation
- Error handling

## Project Structure

```
server/
├── config/
├── controllers/
├── models/
├── routes/
├── middleware/
└── server.js
```

