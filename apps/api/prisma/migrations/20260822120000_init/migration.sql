-- CreateSchema
CREATE TYPE "MembershipRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');
CREATE TYPE "MemberRelation" AS ENUM ('SELF', 'SPOUSE', 'CHILD', 'PARENT', 'SIBLING', 'OTHER');
CREATE TYPE "AssetType" AS ENUM ('EQUITY', 'MUTUAL_FUND', 'SIP', 'NPS', 'SUKANYA', 'PPF', 'EPF', 'FD', 'RD', 'LAND', 'REAL_ESTATE', 'GOLD', 'SGB', 'BOND', 'INSURANCE', 'CASH', 'OTHER');
CREATE TYPE "HoldingSource" AS ENUM ('MANUAL', 'CAS', 'ANGEL_ONE');
CREATE TYPE "PlanType" AS ENUM ('SIP', 'RD');
CREATE TYPE "TransactionType" AS ENUM ('BUY', 'SELL', 'SIP_INSTALLMENT', 'CONTRIBUTION', 'INTEREST', 'DIVIDEND', 'ADJUSTMENT');
CREATE TYPE "CasImportStatus" AS ENUM ('UPLOADED', 'PARSING', 'READY_FOR_REVIEW', 'CONFIRMED', 'FAILED');
CREATE TYPE "BrokerType" AS ENUM ('ANGEL_ONE');

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Family" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Family_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FamilyMembership" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "MembershipRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FamilyMembership_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FamilyMember" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "relation" "MemberRelation" NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "panEncrypted" TEXT,
    "panLast4" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FamilyMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Holding" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "assetType" "AssetType" NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT,
    "isin" TEXT,
    "folio" TEXT,
    "quantity" DECIMAL(20,6) NOT NULL,
    "avgCost" DECIMAL(20,4) NOT NULL,
    "currentPrice" DECIMAL(20,4) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "metadata" JSONB,
    "source" "HoldingSource" NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Holding_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RecurringPlan" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "holdingId" TEXT,
    "type" "PlanType" NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(20,2) NOT NULL,
    "dayOfMonth" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RecurringPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "holdingId" TEXT,
    "type" "TransactionType" NOT NULL,
    "amount" DECIMAL(20,4) NOT NULL,
    "quantity" DECIMAL(20,6),
    "note" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PriceQuote" (
    "id" TEXT NOT NULL,
    "quoteKey" TEXT NOT NULL,
    "assetType" "AssetType" NOT NULL,
    "price" DECIMAL(20,4) NOT NULL,
    "asOf" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    CONSTRAINT "PriceQuote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BrokerConnection" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "broker" "BrokerType" NOT NULL DEFAULT 'ANGEL_ONE',
    "credentialsEnc" TEXT NOT NULL,
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BrokerConnection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CasImport" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "status" "CasImportStatus" NOT NULL DEFAULT 'UPLOADED',
    "parsedJson" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CasImport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiInsight" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "memberId" TEXT,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiInsight_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Invite" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "MembershipRole" NOT NULL DEFAULT 'MEMBER',
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "FamilyMembership_familyId_userId_key" ON "FamilyMembership"("familyId", "userId");
CREATE INDEX "FamilyMembership_userId_idx" ON "FamilyMembership"("userId");
CREATE INDEX "FamilyMember_familyId_idx" ON "FamilyMember"("familyId");
CREATE INDEX "Holding_familyId_idx" ON "Holding"("familyId");
CREATE INDEX "Holding_memberId_idx" ON "Holding"("memberId");
CREATE INDEX "Holding_isin_idx" ON "Holding"("isin");
CREATE INDEX "RecurringPlan_familyId_idx" ON "RecurringPlan"("familyId");
CREATE INDEX "Transaction_familyId_idx" ON "Transaction"("familyId");
CREATE UNIQUE INDEX "PriceQuote_quoteKey_key" ON "PriceQuote"("quoteKey");
CREATE UNIQUE INDEX "BrokerConnection_memberId_broker_key" ON "BrokerConnection"("memberId", "broker");
CREATE INDEX "CasImport_familyId_idx" ON "CasImport"("familyId");
CREATE INDEX "AiInsight_familyId_idx" ON "AiInsight"("familyId");
CREATE UNIQUE INDEX "Invite_token_key" ON "Invite"("token");
CREATE INDEX "Invite_token_idx" ON "Invite"("token");

ALTER TABLE "FamilyMembership" ADD CONSTRAINT "FamilyMembership_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FamilyMembership" ADD CONSTRAINT "FamilyMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FamilyMember" ADD CONSTRAINT "FamilyMember_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Holding" ADD CONSTRAINT "Holding_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Holding" ADD CONSTRAINT "Holding_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecurringPlan" ADD CONSTRAINT "RecurringPlan_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecurringPlan" ADD CONSTRAINT "RecurringPlan_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_holdingId_fkey" FOREIGN KEY ("holdingId") REFERENCES "Holding"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BrokerConnection" ADD CONSTRAINT "BrokerConnection_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BrokerConnection" ADD CONSTRAINT "BrokerConnection_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CasImport" ADD CONSTRAINT "CasImport_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CasImport" ADD CONSTRAINT "CasImport_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiInsight" ADD CONSTRAINT "AiInsight_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;
