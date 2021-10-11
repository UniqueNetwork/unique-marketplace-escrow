CREATE TABLE "KusamaProcessedBlock" (
    "BlockNumber" numeric(20,0) NOT NULL,
    "ProcessDate" timestamp without time zone NOT NULL
);


CREATE TABLE "NftIncomingTransaction" (
    "Id" uuid NOT NULL,
    "CollectionId" bigint NOT NULL,
    "TokenId" bigint NOT NULL,
    "Value" text NOT NULL,
    "OwnerPublicKey" text NOT NULL,
    "Status" integer NOT NULL,
    "LockTime" timestamp without time zone,
    "ErrorMessage" text,
    "UniqueProcessedBlockId" numeric(20,0) NOT NULL,
    "OfferId" uuid
);


CREATE TABLE "NftOutgoingTransaction" (
    "Id" uuid NOT NULL,
    "CollectionId" numeric(20,0) NOT NULL,
    "TokenId" numeric(20,0) NOT NULL,
    "Value" text NOT NULL,
    "RecipientPublicKey" text NOT NULL,
    "Status" integer NOT NULL,
    "LockTime" timestamp without time zone,
    "ErrorMessage" text
);


CREATE TABLE "Offer" (
    "Id" uuid NOT NULL,
    "CreationDate" timestamp without time zone NOT NULL,
    "CollectionId" numeric(20,0) NOT NULL,
    "TokenId" numeric(20,0) NOT NULL,
    "Price" text NOT NULL,
    "Seller" text NOT NULL,
    "OfferStatus" integer NOT NULL,
    "SellerPublicKeyBytes" bytea DEFAULT '\x78'::bytea NOT NULL,
    "QuoteId" numeric(20,0) DEFAULT 2.0 NOT NULL,
    "Metadata" jsonb
);


CREATE TABLE "QuoteIncomingTransaction" (
    "Id" uuid NOT NULL,
    "Amount" text NOT NULL,
    "QuoteId" numeric(20,0) NOT NULL,
    "Description" text NOT NULL,
    "AccountPublicKey" text NOT NULL,
    "BlockId" numeric(20,0),
    "Status" integer NOT NULL,
    "LockTime" timestamp without time zone,
    "ErrorMessage" text
);


CREATE TABLE "QuoteOutgoingTransaction" (
    "Id" uuid NOT NULL,
    "Status" integer NOT NULL,
    "ErrorMessage" text,
    "Value" text NOT NULL,
    "QuoteId" numeric(20,0) NOT NULL,
    "RecipientPublicKey" text NOT NULL,
    "WithdrawType" integer DEFAULT 0 NOT NULL
);


CREATE TABLE "TokenTextSearch" (
    "Id" uuid NOT NULL,
    "CollectionId" numeric(20,0) NOT NULL,
    "TokenId" numeric(20,0) NOT NULL,
    "Text" text NOT NULL,
    "Locale" text
);


CREATE TABLE "Trade" (
    "Id" uuid NOT NULL,
    "TradeDate" timestamp without time zone NOT NULL,
    "Buyer" text NOT NULL,
    "OfferId" uuid NOT NULL
);


CREATE TABLE "UniqueProcessedBlock" (
    "BlockNumber" numeric(20,0) NOT NULL,
    "ProcessDate" timestamp without time zone NOT NULL
);



CREATE TABLE "__EFMigrationsHistory" (
    "MigrationId" character varying(150) NOT NULL,
    "ProductVersion" character varying(32) NOT NULL
);


ALTER TABLE ONLY "KusamaProcessedBlock"
    ADD CONSTRAINT "PK_KusamaProcessedBlock" PRIMARY KEY ("BlockNumber");
ALTER TABLE ONLY "NftIncomingTransaction"
    ADD CONSTRAINT "PK_NftIncomingTransaction" PRIMARY KEY ("Id");
ALTER TABLE ONLY "NftOutgoingTransaction"
    ADD CONSTRAINT "PK_NftOutgoingTransaction" PRIMARY KEY ("Id");
ALTER TABLE ONLY "Offer"
    ADD CONSTRAINT "PK_Offer" PRIMARY KEY ("Id");
ALTER TABLE ONLY "QuoteIncomingTransaction"
    ADD CONSTRAINT "PK_QuoteIncomingTransaction" PRIMARY KEY ("Id");
ALTER TABLE ONLY "QuoteOutgoingTransaction"
    ADD CONSTRAINT "PK_QuoteOutgoingTransaction" PRIMARY KEY ("Id");
ALTER TABLE ONLY "TokenTextSearch"
    ADD CONSTRAINT "PK_TokenTextSearch" PRIMARY KEY ("Id");
ALTER TABLE ONLY "Trade"
    ADD CONSTRAINT "PK_Trade" PRIMARY KEY ("Id");
ALTER TABLE ONLY "UniqueProcessedBlock"
    ADD CONSTRAINT "PK_UniqueProcessedBlock" PRIMARY KEY ("BlockNumber");
ALTER TABLE ONLY "__EFMigrationsHistory"
    ADD CONSTRAINT "PK___EFMigrationsHistory" PRIMARY KEY ("MigrationId");


CREATE INDEX "IX_NftIncomingTransaction_OfferId" ON "NftIncomingTransaction" USING btree ("OfferId");
CREATE INDEX "IX_NftIncomingTransaction_Status_LockTime" ON "NftIncomingTransaction" USING btree ("Status", "LockTime") WHERE ("Status" = 0);
CREATE INDEX "IX_NftIncomingTransaction_UniqueProcessedBlockId" ON "NftIncomingTransaction" USING btree ("UniqueProcessedBlockId");
CREATE INDEX "IX_NftOutgoingTransaction_Status_LockTime" ON "NftOutgoingTransaction" USING btree ("Status", "LockTime") WHERE ("Status" = 0);
CREATE INDEX "IX_Offer_CreationDate" ON "Offer" USING btree ("CreationDate");
CREATE INDEX "IX_Offer_Metadata" ON "Offer" USING btree ("Metadata");
CREATE INDEX "IX_Offer_OfferStatus_CollectionId_TokenId" ON "Offer" USING btree ("OfferStatus", "CollectionId", "TokenId");
CREATE INDEX "IX_QuoteIncomingTransaction_AccountPublicKey" ON "QuoteIncomingTransaction" USING btree ("AccountPublicKey");
CREATE INDEX "IX_QuoteIncomingTransaction_Status_LockTime" ON "QuoteIncomingTransaction" USING btree ("Status", "LockTime") WHERE ("Status" = 0);
CREATE INDEX "IX_QuoteOutgoingTransaction_Status" ON "QuoteOutgoingTransaction" USING btree ("Status") WHERE ("Status" = 0);
CREATE INDEX "IX_TokenTextSearch_CollectionId_TokenId_Locale" ON "TokenTextSearch" USING btree ("CollectionId", "TokenId", "Locale");
CREATE INDEX "IX_Trade_OfferId" ON "Trade" USING btree ("OfferId");


INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion") VALUES ('20210121093304_Initial', '5.0.2');
INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion") VALUES ('20210210063040_KusamaVault', '5.0.2');
INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion") VALUES ('20210224065850_UniqueScanner', '5.0.2');
INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion") VALUES ('20210303090905_RegisteringNftDeposit', '5.0.2');
INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion") VALUES ('20210310100907_DataToProcessRefactoring', '5.0.2');
INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion") VALUES ('20210310113953_KusamaOutgoingTransactions', '5.0.2');
INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion") VALUES ('20210311060602_AddedQuoteIdToKusamaIncome', '5.0.2');
INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion") VALUES ('20210311090819_RenamesAndMissingFields', '5.0.2');
INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion") VALUES ('20210311094419_RenamesKusamaToQuote', '5.0.2');
INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion") VALUES ('20210311095148_RenamedTablesToSingular', '5.0.2');
INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion") VALUES ('20210311100100_RenamedIncomeToIncoming', '5.0.2');
INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion") VALUES ('20210312022703_WithdrawType', '5.0.2');
INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion") VALUES ('20210705034532_OnHold', '5.0.2');
INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion") VALUES ('20210715081147_PriceFilter', '5.0.2');
INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion") VALUES ('20210722091927_JsonMetadata', '5.0.2');
INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion") VALUES ('20210802081707_TokensTextSearch', '5.0.2');
INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion") VALUES ('20210805043620_AddTokenPrefixAndIdToSearch', '5.0.2');
INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion") VALUES ('20210806043509_FixedTokensSearchIndexing', '5.0.2');


ALTER TABLE ONLY "NftIncomingTransaction"
    ADD CONSTRAINT "FK_NftIncomingTransaction_Offer_OfferId" FOREIGN KEY ("OfferId") REFERENCES "Offer"("Id") ON DELETE RESTRICT;
ALTER TABLE ONLY "NftIncomingTransaction"
    ADD CONSTRAINT "FK_NftIncomingTransaction_UniqueProcessedBlock_UniqueProcessed~" FOREIGN KEY ("UniqueProcessedBlockId") REFERENCES "UniqueProcessedBlock"("BlockNumber") ON DELETE CASCADE;
ALTER TABLE ONLY "Trade"
    ADD CONSTRAINT "FK_Trade_Offer_OfferId" FOREIGN KEY ("OfferId") REFERENCES "Offer"("Id") ON DELETE CASCADE;
