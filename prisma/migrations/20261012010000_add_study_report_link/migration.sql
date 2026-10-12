CREATE TABLE "StudyReportLink" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "token" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyReportLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StudyReportLink_userId_key" ON "StudyReportLink"("userId");
CREATE UNIQUE INDEX "StudyReportLink_token_key" ON "StudyReportLink"("token");
ALTER TABLE "StudyReportLink" ADD CONSTRAINT "StudyReportLink_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
