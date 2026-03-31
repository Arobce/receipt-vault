# ReceiptVault AWS Deployment Guide

Complete guide to deploying ReceiptVault on AWS with CI/CD using CodeBuild.

---

## Architecture Overview

```
GitHub Repo
    |
    ├── CodeBuild (buildspec-web.yml)    → S3 + CloudFront (Next.js frontend)
    ├── CodeBuild (buildspec-api.yml)    → ECR + ECS Fargate (Express API)
    └── CodeBuild (buildspec-lambda.yml) → Lambda (Receipt processor)

Express API → RDS PostgreSQL (db.t3.micro)
Express API → S3 (receipt image uploads via presigned URLs)
S3 Event    → Lambda → Textract → RDS (OCR processing pipeline)
```

### AWS Services Used

| Service       | Purpose                              | Tier/Config              |
|---------------|--------------------------------------|--------------------------|
| S3            | Receipt image storage + frontend hosting | Standard              |
| CloudFront    | CDN for frontend                     | Default distribution     |
| ECR           | Docker image registry for API        | Private repository       |
| ECS Fargate   | Container orchestration for API      | 0.25 vCPU / 0.5 GB      |
| RDS           | PostgreSQL database                  | db.t3.micro (free tier)  |
| Lambda        | Async receipt OCR processing         | Node.js 20, 512MB, 60s  |
| Textract      | Receipt OCR (AnalyzeExpense API)     | Pay per use              |
| CodeBuild     | CI/CD pipelines (3 projects)         | build.general1.small     |
| CloudWatch    | Logs and monitoring                  | Default                  |
| IAM           | Roles and permissions                | Least-privilege          |

---

## Phase 1: AWS Account Setup

### 1.1 Create IAM Deploy User

Create a dedicated IAM user for deploying and managing ReceiptVault. Do NOT use your root account.

```bash
# Create the user (no console access, CLI only)
aws iam create-user --user-name receiptvault-deployer

# Create access keys
aws iam create-access-key --user-name receiptvault-deployer
# Save the AccessKeyId and SecretAccessKey from the output
```

Attach a single custom policy that covers everything needed to set up and manage the project:

```bash
aws iam put-user-policy \
  --user-name receiptvault-deployer \
  --policy-name receiptvault-deploy-policy \
  --policy-document file://iam-deploy-policy.json
```

Create `iam-deploy-policy.json` in the project root:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ECRAccess",
      "Effect": "Allow",
      "Action": [
        "ecr:CreateRepository",
        "ecr:DescribeRepositories",
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "ecr:PutImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload",
        "ecr:ListImages",
        "ecr:DeleteRepository"
      ],
      "Resource": "*"
    },
    {
      "Sid": "ECSAccess",
      "Effect": "Allow",
      "Action": [
        "ecs:CreateCluster",
        "ecs:DeleteCluster",
        "ecs:DescribeClusters",
        "ecs:CreateService",
        "ecs:UpdateService",
        "ecs:DeleteService",
        "ecs:DescribeServices",
        "ecs:RegisterTaskDefinition",
        "ecs:DeregisterTaskDefinition",
        "ecs:DescribeTaskDefinition",
        "ecs:ListTasks",
        "ecs:DescribeTasks",
        "ecs:RunTask",
        "ecs:StopTask"
      ],
      "Resource": "*"
    },
    {
      "Sid": "RDSAccess",
      "Effect": "Allow",
      "Action": [
        "rds:CreateDBInstance",
        "rds:DeleteDBInstance",
        "rds:DescribeDBInstances",
        "rds:ModifyDBInstance",
        "rds:CreateDBSnapshot",
        "rds:DescribeDBSnapshots",
        "rds:RestoreDBInstanceFromDBSnapshot"
      ],
      "Resource": "*"
    },
    {
      "Sid": "S3Access",
      "Effect": "Allow",
      "Action": [
        "s3:CreateBucket",
        "s3:DeleteBucket",
        "s3:ListBucket",
        "s3:GetBucketLocation",
        "s3:PutBucketPolicy",
        "s3:GetBucketPolicy",
        "s3:PutBucketWebsite",
        "s3:GetBucketWebsite",
        "s3:PutBucketNotification",
        "s3:GetBucketNotification",
        "s3:PutEncryptionConfiguration",
        "s3:GetEncryptionConfiguration",
        "s3:PutBucketPublicAccessBlock",
        "s3:GetBucketPublicAccessBlock",
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": [
        "arn:aws:s3:::receiptvault-*",
        "arn:aws:s3:::receiptvault-*/*"
      ]
    },
    {
      "Sid": "LambdaAccess",
      "Effect": "Allow",
      "Action": [
        "lambda:CreateFunction",
        "lambda:UpdateFunctionCode",
        "lambda:UpdateFunctionConfiguration",
        "lambda:DeleteFunction",
        "lambda:GetFunction",
        "lambda:ListFunctions",
        "lambda:AddPermission",
        "lambda:RemovePermission",
        "lambda:InvokeFunction"
      ],
      "Resource": "arn:aws:lambda:*:*:function:receiptvault-*"
    },
    {
      "Sid": "CloudFrontAccess",
      "Effect": "Allow",
      "Action": [
        "cloudfront:CreateDistribution",
        "cloudfront:UpdateDistribution",
        "cloudfront:DeleteDistribution",
        "cloudfront:GetDistribution",
        "cloudfront:ListDistributions",
        "cloudfront:CreateInvalidation"
      ],
      "Resource": "*"
    },
    {
      "Sid": "CodeBuildAccess",
      "Effect": "Allow",
      "Action": [
        "codebuild:CreateProject",
        "codebuild:UpdateProject",
        "codebuild:DeleteProject",
        "codebuild:BatchGetProjects",
        "codebuild:ListProjects",
        "codebuild:StartBuild",
        "codebuild:BatchGetBuilds",
        "codebuild:ListBuildsForProject",
        "codebuild:CreateWebhook",
        "codebuild:DeleteWebhook",
        "codebuild:ImportSourceCredentials"
      ],
      "Resource": "*"
    },
    {
      "Sid": "IAMRoleManagement",
      "Effect": "Allow",
      "Action": [
        "iam:CreateRole",
        "iam:DeleteRole",
        "iam:GetRole",
        "iam:PutRolePolicy",
        "iam:DeleteRolePolicy",
        "iam:AttachRolePolicy",
        "iam:DetachRolePolicy",
        "iam:PassRole",
        "iam:ListRolePolicies",
        "iam:ListAttachedRolePolicies"
      ],
      "Resource": "arn:aws:iam::*:role/receiptvault-*"
    },
    {
      "Sid": "SSMParameterStore",
      "Effect": "Allow",
      "Action": [
        "ssm:PutParameter",
        "ssm:GetParameter",
        "ssm:GetParameters",
        "ssm:DeleteParameter",
        "ssm:DescribeParameters"
      ],
      "Resource": "arn:aws:ssm:*:*:parameter/receiptvault/*"
    },
    {
      "Sid": "CloudWatchLogs",
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:DeleteLogGroup",
        "logs:DescribeLogGroups",
        "logs:DescribeLogStreams",
        "logs:GetLogEvents",
        "logs:PutLogEvents",
        "logs:CreateLogStream"
      ],
      "Resource": "arn:aws:logs:*:*:log-group:*receiptvault*"
    },
    {
      "Sid": "VPCNetworking",
      "Effect": "Allow",
      "Action": [
        "ec2:DescribeVpcs",
        "ec2:DescribeSubnets",
        "ec2:DescribeSecurityGroups",
        "ec2:CreateSecurityGroup",
        "ec2:DeleteSecurityGroup",
        "ec2:AuthorizeSecurityGroupIngress",
        "ec2:RevokeSecurityGroupIngress",
        "ec2:AuthorizeSecurityGroupEgress",
        "ec2:RevokeSecurityGroupEgress",
        "ec2:DescribeNetworkInterfaces",
        "ec2:CreateNetworkInterface",
        "ec2:DeleteNetworkInterface"
      ],
      "Resource": "*"
    }
  ]
}
```

**What each permission block covers:**

| Sid                  | Why it's needed                                                  |
|----------------------|------------------------------------------------------------------|
| `ECRAccess`          | Create repo, push/pull Docker images for the API                 |
| `ECSAccess`          | Create cluster, register tasks, manage the API service           |
| `RDSAccess`          | Create and manage the PostgreSQL database                        |
| `S3Access`           | Create buckets, configure hosting/encryption/events, upload files|
| `LambdaAccess`       | Create and update the receipt processor function                 |
| `CloudFrontAccess`   | Create CDN distribution, invalidate cache on deploy              |
| `CodeBuildAccess`    | Create CI/CD projects, webhooks, trigger builds                  |
| `IAMRoleManagement`  | Create service roles for ECS, Lambda, and CodeBuild              |
| `SSMParameterStore`  | Store and read secrets (DB URL, JWT secrets)                     |
| `CloudWatchLogs`     | Create log groups, view logs for debugging                       |
| `VPCNetworking`      | Create security groups, manage network for RDS/ECS/Lambda        |

> **Security notes:**
> - Resources are scoped to `receiptvault-*` wherever possible to limit blast radius.
> - `ECRAccess`, `ECSAccess`, `CodeBuildAccess`, `CloudFrontAccess`, and `VPCNetworking` use `"Resource": "*"` because these services don't support resource-level ARN restrictions on all actions.
> - After initial setup is complete, you can tighten permissions by removing `Create*`/`Delete*` actions and keeping only `Update*`/`Describe*` for day-to-day operations.
> - **Never commit access keys to git.** Use `aws configure` or environment variables.

### 1.2 Install & Configure AWS CLI

```bash
# Install AWS CLI v2 (macOS)
brew install awscli

# Configure credentials
aws configure
# AWS Access Key ID: <your-key>
# AWS Secret Access Key: <your-secret>
# Default region: us-east-1
# Default output format: json
```

### 1.2 Set Variables (used throughout this guide)

```bash
export AWS_REGION=us-east-1
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export PROJECT=receiptvault
```

---

## Phase 2: Database (RDS PostgreSQL)

### 2.1 Create a VPC Security Group

```bash
# Create security group for RDS
aws ec2 create-security-group \
  --group-name ${PROJECT}-db-sg \
  --description "Security group for ReceiptVault RDS"

# Allow PostgreSQL traffic from within the VPC (update with your VPC CIDR)
aws ec2 authorize-security-group-ingress \
  --group-name ${PROJECT}-db-sg \
  --protocol tcp \
  --port 5432 \
  --cidr 10.0.0.0/16
```

### 2.2 Create RDS Instance

```bash
aws rds create-db-instance \
  --db-instance-identifier ${PROJECT}-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --engine-version 16 \
  --master-username receiptvault \
  --master-user-password <STRONG_PASSWORD_HERE> \
  --allocated-storage 20 \
  --storage-type gp3 \
  --no-publicly-accessible \
  --db-name receiptvault \
  --backup-retention-period 7
```

### 2.3 Get the Database Endpoint

```bash
aws rds describe-db-instances \
  --db-instance-identifier ${PROJECT}-db \
  --query 'DBInstances[0].Endpoint.Address' \
  --output text
```

Your `DATABASE_URL` will be:
```
postgresql://receiptvault:<PASSWORD>@<RDS_ENDPOINT>:5432/receiptvault
```

### 2.4 Run Prisma Migrations

Once the database is accessible (you may need a bastion host or VPN):

```bash
cd apps/api
DATABASE_URL="postgresql://receiptvault:<PASSWORD>@<RDS_ENDPOINT>:5432/receiptvault" \
  npx prisma migrate deploy
```

---

## Phase 3: S3 Buckets

### 3.1 Receipt Storage Bucket

```bash
# Create the receipt images bucket
aws s3 mb s3://${PROJECT}-receipts-${AWS_ACCOUNT_ID}

# Block all public access
aws s3api put-public-access-block \
  --bucket ${PROJECT}-receipts-${AWS_ACCOUNT_ID} \
  --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

# Enable server-side encryption
aws s3api put-bucket-encryption \
  --bucket ${PROJECT}-receipts-${AWS_ACCOUNT_ID} \
  --server-side-encryption-configuration '{
    "Rules": [{"ApplyServerSideEncryptionByDefault": {"SSEAlgorithm": "AES256"}}]
  }'
```

**Bucket folder structure:**
```
receipts/
  └── {userId}/
      └── {receiptId}/
          ├── original.jpg     ← uploaded image
          └── thumbnail.jpg    ← generated thumbnail
```

### 3.2 Frontend Hosting Bucket

```bash
# Create the frontend bucket
aws s3 mb s3://${PROJECT}-frontend-${AWS_ACCOUNT_ID}

# Enable static website hosting
aws s3 website s3://${PROJECT}-frontend-${AWS_ACCOUNT_ID} \
  --index-document index.html \
  --error-document index.html
```

### 3.3 Configure S3 Event Notification (triggers Lambda)

After creating the Lambda function (Phase 5), add an S3 event trigger:

```bash
aws s3api put-bucket-notification-configuration \
  --bucket ${PROJECT}-receipts-${AWS_ACCOUNT_ID} \
  --notification-configuration '{
    "LambdaFunctionConfigurations": [{
      "LambdaFunctionArn": "arn:aws:lambda:'${AWS_REGION}':'${AWS_ACCOUNT_ID}':function:'${PROJECT}'-processor",
      "Events": ["s3:ObjectCreated:*"],
      "Filter": {
        "Key": {
          "FilterRules": [{"Name": "prefix", "Value": "receipts/"}]
        }
      }
    }]
  }'
```

---

## Phase 4: ECR + ECS (API Deployment)

### 4.1 Create ECR Repository

```bash
aws ecr create-repository \
  --repository-name ${PROJECT}-api \
  --image-scanning-configuration scanOnPush=true
```

### 4.2 Build & Push Docker Image (first time, manually)

```bash
# Login to ECR
aws ecr get-login-password --region ${AWS_REGION} | \
  docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com

# Build and push
cd apps/api
docker build -t ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${PROJECT}-api:latest .
docker push ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${PROJECT}-api:latest
```

### 4.3 Create ECS Cluster

```bash
aws ecs create-cluster --cluster-name ${PROJECT}
```

### 4.4 Create Task Execution Role

```bash
# Create the role
aws iam create-role \
  --role-name ${PROJECT}-ecs-task-execution \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "ecs-tasks.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

# Attach the managed policy
aws iam attach-role-policy \
  --role-name ${PROJECT}-ecs-task-execution \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
```

### 4.5 Create Task Role (for S3 access from the API)

```bash
aws iam create-role \
  --role-name ${PROJECT}-ecs-task \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "ecs-tasks.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

# Inline policy for S3 access
aws iam put-role-policy \
  --role-name ${PROJECT}-ecs-task \
  --policy-name s3-receipt-access \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::'${PROJECT}'-receipts-'${AWS_ACCOUNT_ID}'/receipts/*"
    }]
  }'
```

### 4.6 Register Task Definition

Create `task-definition.json`:

```json
{
  "family": "receiptvault-api",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "arn:aws:iam::<ACCOUNT_ID>:role/receiptvault-ecs-task-execution",
  "taskRoleArn": "arn:aws:iam::<ACCOUNT_ID>:role/receiptvault-ecs-task",
  "containerDefinitions": [{
    "name": "api",
    "image": "<ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/receiptvault-api:latest",
    "portMappings": [{"containerPort": 4000, "protocol": "tcp"}],
    "environment": [
      {"name": "PORT", "value": "4000"},
      {"name": "CORS_ORIGIN", "value": "https://your-cloudfront-domain.cloudfront.net"},
      {"name": "S3_BUCKET", "value": "receiptvault-receipts-<ACCOUNT_ID>"},
      {"name": "AWS_REGION", "value": "us-east-1"}
    ],
    "secrets": [
      {"name": "DATABASE_URL", "valueFrom": "arn:aws:ssm:us-east-1:<ACCOUNT_ID>:parameter/receiptvault/database-url"},
      {"name": "JWT_SECRET", "valueFrom": "arn:aws:ssm:us-east-1:<ACCOUNT_ID>:parameter/receiptvault/jwt-secret"},
      {"name": "JWT_REFRESH_SECRET", "valueFrom": "arn:aws:ssm:us-east-1:<ACCOUNT_ID>:parameter/receiptvault/jwt-refresh-secret"}
    ],
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": {
        "awslogs-group": "/ecs/receiptvault-api",
        "awslogs-region": "us-east-1",
        "awslogs-stream-prefix": "api"
      }
    }
  }]
}
```

```bash
# Store secrets in SSM Parameter Store
aws ssm put-parameter --name "/receiptvault/database-url" \
  --type SecureString --value "postgresql://receiptvault:<PASSWORD>@<RDS_ENDPOINT>:5432/receiptvault"

aws ssm put-parameter --name "/receiptvault/jwt-secret" \
  --type SecureString --value "<GENERATE_A_STRONG_SECRET>"

aws ssm put-parameter --name "/receiptvault/jwt-refresh-secret" \
  --type SecureString --value "<GENERATE_A_STRONG_SECRET>"

# Create CloudWatch log group
aws logs create-log-group --log-group-name /ecs/receiptvault-api

# Register the task
aws ecs register-task-definition --cli-input-json file://task-definition.json
```

### 4.7 Create ECS Service

```bash
aws ecs create-service \
  --cluster ${PROJECT} \
  --service-name ${PROJECT}-api-service \
  --task-definition ${PROJECT}-api \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration '{
    "awsvpcConfiguration": {
      "subnets": ["<SUBNET_ID_1>", "<SUBNET_ID_2>"],
      "securityGroups": ["<API_SECURITY_GROUP_ID>"],
      "assignPublicIp": "ENABLED"
    }
  }'
```

---

## Phase 5: Lambda (Receipt Processor)

### 5.1 Create Lambda Execution Role

```bash
aws iam create-role \
  --role-name ${PROJECT}-lambda-execution \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "lambda.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

# Attach basic Lambda execution
aws iam attach-role-policy \
  --role-name ${PROJECT}-lambda-execution \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# Add S3 + Textract + VPC permissions
aws iam put-role-policy \
  --role-name ${PROJECT}-lambda-execution \
  --policy-name lambda-permissions \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": ["s3:GetObject"],
        "Resource": "arn:aws:s3:::'${PROJECT}'-receipts-'${AWS_ACCOUNT_ID}'/receipts/*"
      },
      {
        "Effect": "Allow",
        "Action": ["textract:AnalyzeExpense"],
        "Resource": "*"
      },
      {
        "Effect": "Allow",
        "Action": [
          "ec2:CreateNetworkInterface",
          "ec2:DescribeNetworkInterfaces",
          "ec2:DeleteNetworkInterface"
        ],
        "Resource": "*"
      }
    ]
  }'
```

### 5.2 Build & Deploy Lambda

```bash
cd apps/lambda
npm ci && npm run build
cd dist && zip -r ../function.zip . && cd ..

aws lambda create-function \
  --function-name ${PROJECT}-processor \
  --runtime nodejs20.x \
  --handler index.handler \
  --role arn:aws:iam::${AWS_ACCOUNT_ID}:role/${PROJECT}-lambda-execution \
  --zip-file fileb://function.zip \
  --timeout 60 \
  --memory-size 512 \
  --environment "Variables={DATABASE_URL=postgresql://receiptvault:<PASSWORD>@<RDS_ENDPOINT>:5432/receiptvault}"
```

### 5.3 Allow S3 to Invoke Lambda

```bash
aws lambda add-permission \
  --function-name ${PROJECT}-processor \
  --statement-id s3-invoke \
  --action lambda:InvokeFunction \
  --principal s3.amazonaws.com \
  --source-arn arn:aws:s3:::${PROJECT}-receipts-${AWS_ACCOUNT_ID}
```

Then configure the S3 event notification from Phase 3.3.

---

## Phase 6: CloudFront (Frontend CDN)

### 6.1 Create CloudFront Distribution

```bash
aws cloudfront create-distribution \
  --distribution-config '{
    "CallerReference": "'${PROJECT}'-frontend-'$(date +%s)'",
    "Comment": "ReceiptVault Frontend",
    "DefaultCacheBehavior": {
      "TargetOriginId": "'${PROJECT}'-frontend-s3",
      "ViewerProtocolPolicy": "redirect-to-https",
      "AllowedMethods": {"Quantity": 2, "Items": ["GET", "HEAD"]},
      "ForwardedValues": {"QueryString": false, "Cookies": {"Forward": "none"}},
      "Compress": true,
      "MinTTL": 0,
      "DefaultTTL": 86400,
      "MaxTTL": 31536000
    },
    "Origins": {
      "Quantity": 1,
      "Items": [{
        "Id": "'${PROJECT}'-frontend-s3",
        "DomainName": "'${PROJECT}'-frontend-'${AWS_ACCOUNT_ID}'.s3-website-'${AWS_REGION}'.amazonaws.com",
        "CustomOriginConfig": {
          "HTTPPort": 80,
          "HTTPSPort": 443,
          "OriginProtocolPolicy": "http-only"
        }
      }]
    },
    "DefaultRootObject": "index.html",
    "Enabled": true,
    "CustomErrorResponses": {
      "Quantity": 1,
      "Items": [{
        "ErrorCode": 404,
        "ResponseCode": "200",
        "ResponsePagePath": "/index.html",
        "ErrorCachingMinTTL": 300
      }]
    }
  }'
```

Save the distribution ID and domain name from the output.

---

## Phase 7: CI/CD with CodeBuild

You already have three buildspec files in the repo. Now create the CodeBuild projects to use them.

### 7.1 Create CodeBuild Service Role

```bash
aws iam create-role \
  --role-name ${PROJECT}-codebuild-role \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "codebuild.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

# Attach permissions for all three pipelines
aws iam put-role-policy \
  --role-name ${PROJECT}-codebuild-role \
  --policy-name codebuild-permissions \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ],
        "Resource": "arn:aws:logs:'${AWS_REGION}':'${AWS_ACCOUNT_ID}':log-group:/aws/codebuild/'${PROJECT}'-*"
      },
      {
        "Effect": "Allow",
        "Action": [
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:PutImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload"
        ],
        "Resource": "*"
      },
      {
        "Effect": "Allow",
        "Action": [
          "ecs:UpdateService",
          "ecs:DescribeServices"
        ],
        "Resource": "arn:aws:ecs:'${AWS_REGION}':'${AWS_ACCOUNT_ID}':service/'${PROJECT}'/'${PROJECT}'-api-service"
      },
      {
        "Effect": "Allow",
        "Action": [
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ],
        "Resource": [
          "arn:aws:s3:::'${PROJECT}'-frontend-'${AWS_ACCOUNT_ID}'",
          "arn:aws:s3:::'${PROJECT}'-frontend-'${AWS_ACCOUNT_ID}'/*"
        ]
      },
      {
        "Effect": "Allow",
        "Action": ["cloudfront:CreateInvalidation"],
        "Resource": "*"
      },
      {
        "Effect": "Allow",
        "Action": ["lambda:UpdateFunctionCode"],
        "Resource": "arn:aws:lambda:'${AWS_REGION}':'${AWS_ACCOUNT_ID}':function:'${PROJECT}'-processor"
      }
    ]
  }'
```

### 7.2 Connect GitHub to CodeBuild

Go to the **AWS Console > CodeBuild > Settings > Connections** and create a connection to your GitHub account. Note the connection ARN.

Alternatively, use a GitHub personal access token:
```bash
aws codebuild import-source-credentials \
  --server-type GITHUB \
  --auth-type PERSONAL_ACCESS_TOKEN \
  --token <YOUR_GITHUB_PAT>
```

### 7.3 Create CodeBuild Project: API

```bash
aws codebuild create-project \
  --name ${PROJECT}-api-build \
  --source '{
    "type": "GITHUB",
    "location": "https://github.com/<YOUR_USERNAME>/receipt-vault.git",
    "buildspec": "buildspec-api.yml"
  }' \
  --artifacts '{"type": "NO_ARTIFACTS"}' \
  --environment '{
    "type": "LINUX_CONTAINER",
    "image": "aws/codebuild/standard:7.0",
    "computeType": "BUILD_GENERAL1_SMALL",
    "privilegedMode": true,
    "environmentVariables": [
      {"name": "ECR_REPO", "value": "'${AWS_ACCOUNT_ID}'.dkr.ecr.'${AWS_REGION}'.amazonaws.com/'${PROJECT}'-api"},
      {"name": "AWS_DEFAULT_REGION", "value": "'${AWS_REGION}'"}
    ]
  }' \
  --service-role arn:aws:iam::${AWS_ACCOUNT_ID}:role/${PROJECT}-codebuild-role
```

> `privilegedMode: true` is required because this build runs `docker build`.

### 7.4 Create CodeBuild Project: Web Frontend

```bash
aws codebuild create-project \
  --name ${PROJECT}-web-build \
  --source '{
    "type": "GITHUB",
    "location": "https://github.com/<YOUR_USERNAME>/receipt-vault.git",
    "buildspec": "buildspec-web.yml"
  }' \
  --artifacts '{"type": "NO_ARTIFACTS"}' \
  --environment '{
    "type": "LINUX_CONTAINER",
    "image": "aws/codebuild/standard:7.0",
    "computeType": "BUILD_GENERAL1_SMALL",
    "environmentVariables": [
      {"name": "S3_BUCKET", "value": "'${PROJECT}'-frontend-'${AWS_ACCOUNT_ID}'"},
      {"name": "CLOUDFRONT_DIST_ID", "value": "<YOUR_CLOUDFRONT_DISTRIBUTION_ID>"},
      {"name": "NEXT_PUBLIC_API_URL", "value": "https://<YOUR_API_DOMAIN>/api"}
    ]
  }' \
  --service-role arn:aws:iam::${AWS_ACCOUNT_ID}:role/${PROJECT}-codebuild-role
```

### 7.5 Create CodeBuild Project: Lambda

```bash
aws codebuild create-project \
  --name ${PROJECT}-lambda-build \
  --source '{
    "type": "GITHUB",
    "location": "https://github.com/<YOUR_USERNAME>/receipt-vault.git",
    "buildspec": "buildspec-lambda.yml"
  }' \
  --artifacts '{"type": "NO_ARTIFACTS"}' \
  --environment '{
    "type": "LINUX_CONTAINER",
    "image": "aws/codebuild/standard:7.0",
    "computeType": "BUILD_GENERAL1_SMALL",
    "environmentVariables": [
      {"name": "FUNCTION_NAME", "value": "'${PROJECT}'-processor"}
    ]
  }' \
  --service-role arn:aws:iam::${AWS_ACCOUNT_ID}:role/${PROJECT}-codebuild-role
```

### 7.6 Set Up GitHub Webhooks (Auto-trigger on push)

```bash
# API - triggers on changes to apps/api/
aws codebuild create-webhook \
  --project-name ${PROJECT}-api-build \
  --filter-groups '[[
    {"type": "EVENT", "pattern": "PUSH"},
    {"type": "HEAD_REF", "pattern": "^refs/heads/main$"},
    {"type": "FILE_PATH", "pattern": "apps/api/.*"}
  ]]'

# Web - triggers on changes to apps/web/
aws codebuild create-webhook \
  --project-name ${PROJECT}-web-build \
  --filter-groups '[[
    {"type": "EVENT", "pattern": "PUSH"},
    {"type": "HEAD_REF", "pattern": "^refs/heads/main$"},
    {"type": "FILE_PATH", "pattern": "apps/web/.*"}
  ]]'

# Lambda - triggers on changes to apps/lambda/
aws codebuild create-webhook \
  --project-name ${PROJECT}-lambda-build \
  --filter-groups '[[
    {"type": "EVENT", "pattern": "PUSH"},
    {"type": "HEAD_REF", "pattern": "^refs/heads/main$"},
    {"type": "FILE_PATH", "pattern": "apps/lambda/.*"}
  ]]'
```

### 7.7 How the CI/CD Pipelines Work

```
┌─────────────────────────────────────────────────────────┐
│                    Git Push to main                      │
└──────────┬──────────────┬──────────────┬────────────────┘
           │              │              │
     apps/api/*     apps/web/*    apps/lambda/*
           │              │              │
           ▼              ▼              ▼
   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
   │ buildspec-api│ │ buildspec-web│ │buildspec-lamb│
   ├──────────────┤ ├──────────────┤ ├──────────────┤
   │ 1. ECR Login │ │ 1. npm ci    │ │ 1. npm ci    │
   │ 2. Docker    │ │ 2. next build│ │ 2. tsc build │
   │    build     │ │ 3. S3 sync   │ │ 3. zip dist  │
   │ 3. Push ECR  │ │ 4. CF inval. │ │ 4. Update fn │
   │ 4. ECS deploy│ │              │ │              │
   └──────────────┘ └──────────────┘ └──────────────┘
           │              │              │
           ▼              ▼              ▼
     ECS Fargate    S3+CloudFront     Lambda
     (API running)  (Frontend live)   (Processor updated)
```

**API Pipeline** (`buildspec-api.yml`):
1. Logs in to ECR
2. Builds the Docker image from `apps/api/Dockerfile`
3. Tags with commit hash + `latest`
4. Pushes both tags to ECR
5. Forces a new ECS deployment (rolling update)

**Web Pipeline** (`buildspec-web.yml`):
1. Installs dependencies in `apps/web`
2. Runs `next build` (static export to `out/`)
3. Syncs build output to S3 frontend bucket
4. Invalidates CloudFront cache so users get the latest version

**Lambda Pipeline** (`buildspec-lambda.yml`):
1. Installs dependencies in `apps/lambda`
2. Compiles TypeScript
3. Zips the `dist/` folder
4. Updates the Lambda function code directly

### 7.8 Trigger a Build Manually

```bash
# Trigger API build
aws codebuild start-build --project-name ${PROJECT}-api-build

# Trigger web build
aws codebuild start-build --project-name ${PROJECT}-web-build

# Trigger lambda build
aws codebuild start-build --project-name ${PROJECT}-lambda-build
```

### 7.9 Check Build Status

```bash
# List recent builds for a project
aws codebuild list-builds-for-project \
  --project-name ${PROJECT}-api-build \
  --sort-order DESCENDING \
  --query 'ids[0]' --output text

# Get build details
aws codebuild batch-get-builds --ids <BUILD_ID>
```

---

## Phase 8: Environment Variables Reference

### ECS Task (API)

| Variable             | Source           | Value                                           |
|----------------------|------------------|-------------------------------------------------|
| `DATABASE_URL`       | SSM SecureString | `postgresql://user:pass@rds-endpoint:5432/db`   |
| `JWT_SECRET`         | SSM SecureString | Random 64-char string                           |
| `JWT_REFRESH_SECRET` | SSM SecureString | Random 64-char string                           |
| `PORT`               | Environment      | `4000`                                          |
| `CORS_ORIGIN`        | Environment      | CloudFront domain URL                           |
| `S3_BUCKET`          | Environment      | `receiptvault-receipts-<ACCOUNT_ID>`            |
| `AWS_REGION`         | Environment      | `us-east-1`                                     |

### Lambda

| Variable       | Source      | Value                                         |
|----------------|-------------|-----------------------------------------------|
| `DATABASE_URL` | Environment | `postgresql://user:pass@rds-endpoint:5432/db` |

### CodeBuild - API

| Variable             | Source      | Value                                |
|----------------------|-------------|--------------------------------------|
| `ECR_REPO`           | Environment | `<ACCOUNT>.dkr.ecr.region.amazonaws.com/receiptvault-api` |
| `AWS_DEFAULT_REGION` | Environment | `us-east-1`                          |

### CodeBuild - Web

| Variable              | Source      | Value                                |
|-----------------------|-------------|--------------------------------------|
| `S3_BUCKET`           | Environment | `receiptvault-frontend-<ACCOUNT_ID>` |
| `CLOUDFRONT_DIST_ID`  | Environment | CloudFront distribution ID           |
| `NEXT_PUBLIC_API_URL`  | Environment | `https://<API_DOMAIN>/api`          |

### CodeBuild - Lambda

| Variable        | Source      | Value                   |
|-----------------|-------------|-------------------------|
| `FUNCTION_NAME` | Environment | `receiptvault-processor`|

---

## Phase 9: Verification Checklist

After deployment, verify each component:

- [ ] **RDS**: Connect from API container, run `prisma migrate deploy`
- [ ] **S3 Receipts**: Upload a test image via the API's presigned URL endpoint
- [ ] **Lambda**: Check CloudWatch logs after S3 upload triggers processing
- [ ] **ECR**: Verify image exists with `aws ecr list-images --repository-name receiptvault-api`
- [ ] **ECS**: Service is running with `aws ecs describe-services --cluster receiptvault --services receiptvault-api-service`
- [ ] **CloudFront**: Frontend loads at the distribution domain
- [ ] **CodeBuild**: Trigger a manual build for each project and confirm success
- [ ] **Webhooks**: Push a change to `apps/api/` and verify CodeBuild triggers automatically

---

## Troubleshooting

### ECS task keeps stopping
```bash
# Check stopped task reason
aws ecs describe-tasks --cluster receiptvault \
  --tasks $(aws ecs list-tasks --cluster receiptvault --service-name receiptvault-api-service --desired-status STOPPED --query 'taskArns[0]' --output text)
```
Common causes: DATABASE_URL wrong, missing SSM permissions on execution role, security group blocking port 5432.

### CodeBuild fails at Docker push
- Ensure `privilegedMode: true` is set on the API build project
- Verify the CodeBuild role has ECR permissions
- Check ECR repository exists: `aws ecr describe-repositories`

### Lambda not triggering
- Verify S3 event notification is configured (Phase 3.3)
- Verify Lambda resource policy allows S3 invocation (Phase 5.3)
- Check CloudWatch Logs: `/aws/lambda/receiptvault-processor`

### CloudFront showing old content
```bash
aws cloudfront create-invalidation \
  --distribution-id <DIST_ID> \
  --paths "/*"
```

### Database connection from Lambda
Lambda must be in the same VPC as RDS. Configure VPC settings:
```bash
aws lambda update-function-configuration \
  --function-name receiptvault-processor \
  --vpc-config SubnetIds=<SUBNET_1>,<SUBNET_2>,SecurityGroupIds=<SG_ID>
```
