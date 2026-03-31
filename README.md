# Hotel Management System

A full-featured hotel management web application built with Firebase and vanilla JavaScript. The system provides separate interfaces for administrators and guests, enabling room bookings, amenity requests, and payment tracking.

## 📋 Overview

This is a two-tier hotel management platform designed to streamline hotel operations and guest interactions:

- **Admin Dashboard**: Manage rooms, bookings, amenities, payments, and guest amenity requests
- **Guest Portal**: Browse rooms, make bookings, request amenities, and manage payments

## ✨ Key Features

### Admin Features
- **Authentication**: Secure admin login
- **Dashboard Analytics**:
  - Total rooms count
  - Active bookings tracking
  - Check-in count monitoring
  - Tabbed interface for different management sections

- **Room Management**: View and manage room inventory
- **Booking Management**: Track and manage guest bookings
- **Amenity Management**: Configure available amenities and pricing
- **Amenity Requests**: Review, approve, or reject guest amenity requests
- **Payment Management**: Track and manage guest payments with booking details

### Guest Features
- **User Authentication**: Register and login with email/password
- **Room Browsing**: View available rooms and details
- **Booking System**: 
  - Select check-in and check-out dates
  - Choose preferred room
  - Manage existing bookings
  
- **Amenity Requests**: Request additional amenities during stay with quantity selection
- **Payment Tracking**: View bills and payment status
- **Notifications**: Real-time notifications for booking updates, payment status, and amenity request responses
- **User Profile**: Display authenticated user information

## 📁 Project Structure

```
Hotel Management/
├── admin/
│   ├── app.js              # Admin application logic & dashboard
│   ├── index.html          # Admin interface layout
│   └── styles.css          # Admin styling
│
├── user/
│   ├── index.html          # Guest portal layout
│   ├── styles.css          # Guest portal styling
│   ├── imgs/               # Guest interface images
│   └── js/
│       ├── main.js         # User application entry point
│       ├── firebase/
│       │   └── config.js   # Firebase configuration
│       ├── services/
│       │   ├── authService.js    # Authentication logic
│       │   └── dataService.js    # Database operations & subscriptions
│       └── ui/
│           └── render.js   # UI rendering functions
│
└── README.md               # This file
```

## 🔧 Core Modules

### Authentication Service (`authService.js`)
- User registration with email and password
- User login/logout
- Auth state observation
- Profile management

### Data Service (`dataService.js`)
- Real-time subscriptions for:
  - Rooms
  - User bookings
  - Amenity requests
  - Payments & invoices
  - Amenities catalog
- Operations:
  - Create bookings
  - Submit amenity requests
  - Process payments

### UI Rendering (`render.js`)
- Dynamic room listing
- Booking options display
- Amenity rendering
- Payment details formatting
- Currency formatting utilities

## 🔐 Technology Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript (ES6+)
- **Backend**: Firebase Realtime Database
- **Authentication**: Firebase Authentication
- **Real-time Updates**: Firebase listeners & subscriptions

## 🎯 User Roles & Permissions

### Admin
- Hardcoded authentication (username: `admin`, password: `admin123`)
- Full system access and management capabilities

### Guest/User
- Email-based registration & authentication
- Limited to personal bookings, amenity requests, and payments
- Read-only access to room availability

## 📦 Database Schema

- **users**: User profiles with role and metadata
- **rooms**: Available rooms and details
- **bookings**: Guest bookings with dates and status
- **amenities**: Available amenities and pricing
- **amenityRequests**: Guest amenity requests with approval workflow
- **payments**: Payment records linked to bookings

## 🚀 Getting Started

1. Open `admin/index.html` in a browser for admin access
2. Open `user/index.html` in a browser for guest access
3. Admin login with credentials (username: `admin`, password: `admin123`)
4. Guests can register new accounts or login with existing credentials

## 📝 Notes

- Firebase configuration is centralized in `user/js/firebase/config.js`
- Real-time data synchronization ensures all clients see the latest information
- Amenity requests follow an approval workflow: pending → approved/rejected
- Payments are associated with bookings and include guest contact information
