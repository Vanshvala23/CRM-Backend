# CRM Backend

A RESTful CRM backend built with **Node.js**, **Express**, and **MySQL**, providing APIs for managing customers, leads, invoices, proposals, tasks, groups, and users.

---

## Table of Contents

* Features
* Technologies
* Getting Started
* Environment Variables
* API Endpoints

  * Customer
  * Leads
  * Invoice
  * Proposal
  * Tasks
  * Groups
  * Users
  * Estimates
* File Uploads
* Error Handling
* License

---

## Features

* Manage **customers**, **leads**, and **contacts**.
* Create and track **invoices**, **proposals**, and **estimates**.
* Assign **tasks**, **followers**, and **groups**.
* Bulk import **leads** via CSV.
* Automatically calculate **invoice totals** and **proposal totals**.
* Convert **leads into customers**.
* RESTful API structure with proper error handling.

---

## Technologies

* **Node.js**
* **Express.js**
* **MySQL**
* **Multer** (for file uploads)
* **CSV Parser** (for bulk imports)
* **dotenv** (for environment variables)
* **CORS**

---

## Getting Started

1. **Clone the repository**:

```bash
git clone https://github.com/yourusername/crm-backend.git
cd crm-backend
```

2. **Install dependencies**:

```bash
npm install
```

3. **Setup environment variables**:

Create a `.env` file in the root directory:

```
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=yourpassword
DB_NAME=crm_database
```

4. **Run the server**:

```bash
npm start
```

Server will run at: `http://localhost:5000`

---

## API Endpoints

### Customer

| Method | Endpoint         | Description         |
| ------ | ---------------- | ------------------- |
| GET    | /api/contact/    | Get all customers   |
| GET    | /api/contact/:id | Get single customer |
| POST   | /api/contact     | Create customer     |

### Leads

| Method | Endpoint              | Description              |
| ------ | --------------------- | ------------------------ |
| GET    | /api/lead/            | Get all leads            |
| GET    | /api/lead/:id         | Get single lead          |
| POST   | /api/lead             | Create lead              |
| PUT    | /api/lead/:id         | Update lead              |
| POST   | /api/lead/:id/convert | Convert lead to customer |
| POST   | /api/lead/import      | Import leads via CSV     |

### Invoice

| Method | Endpoint             | Description        |
| ------ | -------------------- | ------------------ |
| GET    | /api/invoice/        | Get all invoices   |
| GET    | /api/invoice/:inv_no | Get single invoice |
| POST   | /api/invoice         | Create invoice     |
| PUT    | /api/invoice/:inv_no | Update invoice     |
| DELETE | /api/invoice/:inv_no | Delete invoice     |

### Proposal

| Method | Endpoint               | Description         |
| ------ | ---------------------- | ------------------- |
| GET    | /api/proposal/         | Get all proposals   |
| GET    | /api/proposal/:prop_id | Get single proposal |
| POST   | /api/proposal          | Create proposal     |
| DELETE | /api/proposal/:prop_id | Delete proposal     |

### Tasks

| Method | Endpoint          | Description          |
| ------ | ----------------- | -------------------- |
| GET    | /api/tasks/       | Get all tasks        |
| GET    | /api/tasks/:id    | Get single task      |
| POST   | /api/tasks/       | Create task          |
| PUT    | /api/tasks/:id    | Update task          |
| DELETE | /api/tasks/:id    | Delete task          |
| POST   | /api/tasks/import | Import tasks via CSV |

### Groups

| Method | Endpoint          | Description                 |
| ------ | ----------------- | --------------------------- |
| GET    | /api/group/       | Get all groups              |
| POST   | /api/group/       | Create group                |
| POST   | /api/group/assign | Assign group(s) to customer |

### Users

| Method | Endpoint    | Description   |
| ------ | ----------- | ------------- |
| GET    | /api/users/ | Get all users |

### Estimates

| Method | Endpoint          | Description         |
| ------ | ----------------- | ------------------- |
| GET    | /api/estimate/    | Get all estimates   |
| GET    | /api/estimate/:id | Get single estimate |
| POST   | /api/estimate     | Create estimate     |
| PUT    | /api/estimate/:id | Update estimate     |
| DELETE | /api/estimate/:id | Delete estimate     |

---

## File Uploads

All uploaded files are served from `/uploads` folder. Example: `https://crm-backend-ntt0.onrender.com/api/uploads/<filename>`

---

## Error Handling

All errors are returned in JSON format:

```json
{
  "message": "Server Error",
  "error": "Error details here"
}
```

---

## License

MIT License
