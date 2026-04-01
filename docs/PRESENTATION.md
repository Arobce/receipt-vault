# ReceiptVault - Application Cloud Migration

> Presentation content for Application Cloud Migration course.
> Copy each slide's content into your preferred presentation tool (Google Slides, PowerPoint, etc.)

---

## Slide 1: Title

**ReceiptVault**
*Cloud-Native Receipt Management on AWS*

Application Cloud Migration

Roshan Chapagain
April 2026

---

## Slide 2: What is ReceiptVault?

**Problem:** Managing paper and digital receipts is tedious. Manual data entry is time-consuming and error-prone.

**Solution:** ReceiptVault is a full-stack web application that lets users:

- Upload receipt photos (JPG, PNG, HEIC, PDF)
- Automatically extract merchant, amount, date, and line items using AI-powered OCR
- Browse, search, and filter receipts with a clean dashboard
- View spending analytics by category and time period
- Export spending data as CSV

**Key Differentiator:** Fully automated receipt processing - upload a photo, get structured data in seconds.

---

## Slide 3: Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Next.js 16, React 19, Tailwind CSS 4 | Server-rendered UI with responsive design |
| **Backend API** | Express 5, Node.js 20, TypeScript | RESTful API with JWT authentication |
| **Database** | PostgreSQL 16, Prisma ORM 7 | Relational data with type-safe queries |
| **OCR Processing** | AWS Textract, Lambda | Serverless receipt text extraction |
| **Storage** | Amazon S3 | Receipt image persistence |
| **Containers** | Docker, ECS Fargate | Serverless container orchestration |
| **CI/CD** | CodePipeline, CodeBuild, GitHub | Automated build and deployment |
| **Monitoring** | CloudWatch | Logs, metrics, alarms, dashboards |

---

## Slide 4: Architecture Overview

> *Insert the AWS architecture diagram here (generated from the prompt in ARCHITECTURE.md)*

**Three compute workloads:**
1. **Web Frontend** - Next.js on ECS Fargate (port 3000)
2. **API Backend** - Express on ECS Fargate (port 4000)
3. **Receipt Processor** - Node.js Lambda (event-driven)

**Single entry point:** Application Load Balancer with path-based routing

---

## Slide 5: Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| **ECS Fargate over EC2** | No server management; pay only for running containers; auto-scales |
| **Lambda for OCR** | Event-driven processing; no idle compute cost; 60s max per receipt |
| **ALB over static IPs** | Stable DNS; path-based routing eliminates need for separate domains |
| **Standalone Next.js over Static Export** | Dynamic routes (`/receipts/[id]`) require server-side rendering |
| **RDS over DynamoDB** | Relational queries needed for analytics (JOINs, GROUP BY, aggregations) |
| **S3 + Presigned URLs** | Secure, direct-to-browser image delivery without proxying through API |
| **Prisma ORM** | Type-safe database access; schema migrations; shared across API and Lambda |
| **JWT over Sessions** | Stateless auth; no session store needed; works across services |
| **Monorepo** | Shared Prisma schema between API and Lambda; single CI/CD pipeline |

---

## Slide 6: Cloud Migration Strategy

**Migration Approach: Greenfield Cloud-Native (Lift-and-Shift was not applicable)**

The application was designed for the cloud from the start, using cloud-native patterns:

- **Containerization** - Docker multi-stage builds for consistent, reproducible deployments
- **Serverless compute** - Fargate (containers) + Lambda (functions) = zero server management
- **Managed services** - RDS, S3, Textract, ALB = reduced operational burden
- **Infrastructure as configuration** - ECS task definitions, buildspecs, and Dockerfiles define the entire infrastructure
- **12-Factor App principles** - Config via environment variables, stateless processes, backing services as attached resources

---

## Slide 7: Receipt Processing Pipeline

```
                                         AWS Cloud
User uploads     +-------+    S3 Event    +--------+    OCR     +----------+
receipt photo -> |  API  | -> Trigger  -> | Lambda | -------->  | Textract |
                 +-------+                +--------+            +----------+
                     |                        |                      |
                     v                        v                      v
                 +-------+              +-----------+          Reads image
                 |  S3   |              | PostgreSQL|          from S3
                 +-------+              +-----------+
                 (stores                (stores extracted
                  image)                 data: merchant,
                                         amount, date,
                                         line items,
                                         category)
```

**Processing Steps:**
1. User uploads receipt image via the web UI
2. API validates the file, uploads to S3, creates a PENDING database record
3. S3 event notification triggers the Lambda function
4. Lambda calls Textract AnalyzeExpense to extract receipt fields
5. Lambda parses the response, auto-categorizes the merchant, and updates the database
6. Receipt status changes to PROCESSED (or FAILED if an error occurs)

**Average processing time:** 3-8 seconds per receipt

---

## Slide 8: CI/CD Pipeline

```
GitHub (main branch)
       |
       v
AWS CodePipeline
       |
       +--- CodeBuild: API -----> ECR -----> ECS (rolling update)
       |
       +--- CodeBuild: Web -----> ECR -----> ECS (rolling update)
       |
       +--- CodeBuild: Lambda --->  zip ----> Lambda (code update)
```

**How it works:**
- Push to `main` triggers the pipeline via GitHub CodeStar Connection
- Three CodeBuild projects run in parallel (API, Web, Lambda)
- Docker images are built with `--platform linux/amd64` for Fargate compatibility
- Images tagged with commit hash for traceability + `latest` for convenience
- ECS services perform rolling updates (zero downtime)
- Lambda function code is updated in-place

**Build times:** ~2-4 minutes per project

---

## Slide 9: Networking & Security

**Networking:**
- ALB serves as the single entry point on port 80
- Path-based routing: `/api/*` to API containers, `/*` to Web containers
- ECS tasks run in public subnets with security groups
- RDS accessible only from ECS and Lambda security contexts

**Security Measures:**
| Layer | Implementation |
|-------|---------------|
| **Authentication** | JWT with 15-min access + 7-day refresh tokens |
| **Password Storage** | bcrypt with 12 salt rounds |
| **Secrets** | SSM Parameter Store (SecureString, KMS encrypted) |
| **Input Validation** | Zod schemas on all API endpoints |
| **Rate Limiting** | 20 req/15 min on auth routes |
| **Access Control** | All queries scoped to authenticated userId |
| **File Validation** | MIME type + 10 MB size limit on uploads |
| **IAM** | Least-privilege roles for each service |

---

## Slide 10: Monitoring & Observability

**CloudWatch Integration:**

- **Log Groups** - 14-day retention for API, Web, and Lambda logs
- **Metric Filters** - Counts API errors and Lambda failures from log patterns
- **Alarms** - Triggers on high error rates, Lambda failures, RDS CPU > 80%, ALB 5xx errors
- **Dashboard** - Single pane of glass: ECS CPU/memory, request counts, Lambda invocations, RDS metrics

**Alarm Notifications:**
- SNS topic delivers alerts for any infrastructure anomaly

---

## Slide 11: Database Design

```
+----------+       +----------+       +----------+
|   User   | 1---* | Receipt  | *---1 | Category |
+----------+       +----------+       +----------+
| id (PK)  |       | id (PK)  |       | id (PK)  |
| email    |       | userId   |       | name     |
| password |       | s3Key    |       | icon     |
| name     |       | status   |       +----------+
| created  |       | merchant |
+----------+       | amount   |       Status Enum:
                   | date     |       - PENDING
                   | category |       - PROCESSING
                   | lineItems|       - PROCESSED
                   | rawJSON  |       - FAILED
                   | isEdited |
                   | deleted  |
                   +----------+
```

**Key Design Choices:**
- Soft deletes (`deletedAt`) for data recovery
- `rawTextract` JSON field preserves full OCR response for debugging
- `isEdited` boolean tracks manual user corrections vs. automated extraction
- Composite indexes on `[userId, receiptDate]` and `[userId, categoryId]` for query performance

---

## Slide 12: AWS Services Summary

| Service | Usage | Tier |
|---------|-------|------|
| **ECS Fargate** | Run API + Web containers | Free Tier eligible |
| **ECR** | Docker image registry (2 repos) | Free Tier (500 MB) |
| **RDS PostgreSQL** | Primary database | Free Tier (db.t3.micro) |
| **S3** | Receipt image storage | Free Tier (5 GB) |
| **Lambda** | Receipt OCR processing | Free Tier (1M requests) |
| **Textract** | AI receipt data extraction | Free Tier (1K pages/mo) |
| **ALB** | Load balancing + routing | ~$16/mo |
| **CodePipeline** | CI/CD orchestration | Free Tier (1 pipeline) |
| **CodeBuild** | Docker builds | Free Tier (100 min/mo) |
| **CloudWatch** | Monitoring + logging | Free Tier (basic) |
| **SSM Parameter Store** | Secrets management | Free (standard params) |

---

## Slide 13: Demo

**Live Application:**
`http://receiptvault-alb-1281619146.us-east-1.elb.amazonaws.com`

**Demo Flow:**
1. Register a new account
2. Upload a receipt photo
3. Watch it process (PENDING -> PROCESSING -> PROCESSED)
4. View extracted data (merchant, amount, date, line items)
5. Check the dashboard for spending analytics
6. Export receipts as CSV

---

## Slide 14: Challenges & Lessons Learned

| Challenge | Solution |
|-----------|----------|
| Next.js dynamic routes can't use static export | Switched to `output: "standalone"` with ECS Docker deployment |
| Docker images built on Apple Silicon fail on Fargate | Added `--platform linux/amd64` to all Docker builds |
| RDS SSL connection failures | Used `sslmode=no-verify` (RDS uses self-signed certificates) |
| Prisma requires DATABASE_URL at build time | Used dummy URL during Docker build, real URL at runtime |
| Lambda deployment package > 250 MB | Stripped unused Prisma database engine binaries (MySQL, SQLite, etc.) |
| ECS tasks couldn't read SSM secrets | Added `kms:Decrypt` permission for SecureString parameters |
| Changing ECS task IPs broke frontend API calls | Added ALB for stable DNS endpoint |
| S3 event notification misconfigured | Corrected prefix from `receipts/` to `uploads/` |

---

## Slide 15: Future Improvements

- **HTTPS** - Add SSL/TLS certificate via AWS Certificate Manager + ALB HTTPS listener
- **Custom Domain** - Route 53 alias record pointing to ALB
- **Auto-Scaling** - ECS service auto-scaling based on CPU/request count
- **VPC Private Subnets** - Move RDS and ECS tasks to private subnets with NAT Gateway
- **CloudFront CDN** - Cache static assets and reduce latency
- **Multi-region** - RDS read replicas for disaster recovery
- **Thumbnail Generation** - Lambda generates receipt thumbnails for faster list loading
- **Search** - Full-text search on merchant names and line item descriptions

---

## Slide 16: Thank You

**ReceiptVault**
*Cloud-Native Receipt Management on AWS*

**Repository:** github.com/roshanchapagain/receipt-vault
**Live Demo:** `http://receiptvault-alb-1281619146.us-east-1.elb.amazonaws.com`

Questions?
