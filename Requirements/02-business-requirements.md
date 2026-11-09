# FixHome - Business Requirements

## Version

Version: 1.0

Status: Draft

---

# 1. Introduction

This document defines the functional and business requirements for the FixHome platform.

The goal is to provide a clear specification of what the application should do before implementation begins.

---

# 2. User Roles

The platform supports three user roles.

## Customer

A customer requests home services.

Customer capabilities:

- Register
- Login
- Manage profile
- Create service requests
- Upload images
- View offers
- Accept one offer
- Chat with craftsmen
- Track job progress
- Leave reviews

---

## Craftsman

A craftsman provides home services.

Craftsman capabilities:

- Register
- Complete professional profile
- Select service categories
- Receive matching requests
- Submit offers
- Manage accepted jobs
- Chat with customers
- Receive reviews

---

## Administrator

Administrator capabilities:

- Manage users
- Verify craftsmen
- Manage categories
- Moderate platform content

---

# 3. Functional Requirements

## Authentication

The system shall allow:

- User registration
- User login
- User logout
- Password reset (future)
- Role-based authorization

---

## Customer Profile

The system shall allow customers to:

- Edit personal information
- Manage address
- Store location coordinates

---

## Craftsman Profile

The system shall allow craftsmen to:

- Create business profile
- Select one or more categories
- Add years of experience
- Upload profile picture (future)
- Become verified by administrators

---

## Categories

The platform shall provide predefined service categories.

Examples:

- Electrician
- Plumber
- Painter
- Locksmith
- Carpenter
- HVAC
- Appliance Repair

---

## Service Requests

Customers shall be able to:

- Select category
- Describe the problem
- Upload one or more images
- Specify location
- Submit request

Each request has a lifecycle.

Status:

NEW

↓

WAITING_FOR_OFFERS

↓

ACCEPTED

↓

IN_PROGRESS

↓

COMPLETED

↓

CANCELLED

---

## Offers

Craftsmen shall be able to:

- View matching requests
- Submit offers
- Define price
- Add message

Customer can:

- View offers
- Reject offers
- Accept one offer

Once an offer is accepted:

- all remaining offers become rejected

---

## Reviews

Reviews are allowed only after completed jobs.

Customer can:

- Rate craftsman
- Leave written review

Rating scale:

1–5

---

## Chat

Customer and craftsman may communicate only after an offer has been accepted.

---

## Notifications

Future versions shall support:

- Push notifications
- Offer notifications
- Chat notifications
- Status updates

---

# 4. Business Rules

BR-01

Customer can create unlimited requests.

---

BR-02

Craftsman can submit offers only for categories they provide.

---

BR-03

Only verified craftsmen are visible to customers.

---

BR-04

Customer can accept only one offer.

---

BR-05

Review is allowed only after completed service.

---

BR-06

Craftsman cannot review customers.

---

BR-07

Deleted users are never physically removed from the database (soft delete planned).

---

# 5. Non-Functional Requirements

The system shall be:

- Secure
- Responsive
- Scalable
- Maintainable
- Modular

---

# 6. MVP Scope

Included:

- Authentication
- Profiles
- Categories
- Requests
- Offers
- Reviews

Excluded:

- Payments
- Live chat
- Push notifications
- AI features
- Multi-language support

---

# 7. Future Enhancements

- Payment integration
- Google Maps
- AI request classification
- Voice descriptions
- Video upload
- Invoice generation
- Subscription plans