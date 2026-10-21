CREATE TABLE "Profile" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProfileLink" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    CONSTRAINT "ProfileLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Skill" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Experience" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "achievements" TEXT[] NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    CONSTRAINT "Experience_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Profile_slug_key" ON "Profile"("slug");
CREATE UNIQUE INDEX "ProfileLink_profileId_key_key" ON "ProfileLink"("profileId", "key");
CREATE UNIQUE INDEX "Skill_profileId_key_key" ON "Skill"("profileId", "key");
CREATE UNIQUE INDEX "Experience_profileId_key_key" ON "Experience"("profileId", "key");
CREATE UNIQUE INDEX "Project_profileId_key_key" ON "Project"("profileId", "key");

CREATE INDEX "ProfileLink_profileId_sortOrder_id_idx" ON "ProfileLink"("profileId", "sortOrder", "id");
CREATE INDEX "Skill_profileId_sortOrder_id_idx" ON "Skill"("profileId", "sortOrder", "id");
CREATE INDEX "Experience_profileId_sortOrder_id_idx" ON "Experience"("profileId", "sortOrder", "id");
CREATE INDEX "Project_profileId_sortOrder_id_idx" ON "Project"("profileId", "sortOrder", "id");

ALTER TABLE "ProfileLink" ADD CONSTRAINT "ProfileLink_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Experience" ADD CONSTRAINT "Experience_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Experience" ADD CONSTRAINT "Experience_period_check"
    CHECK ("endDate" IS NULL OR "endDate" >= "startDate");
ALTER TABLE "ProfileLink" ADD CONSTRAINT "ProfileLink_sortOrder_check" CHECK ("sortOrder" >= 0);
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_sortOrder_check" CHECK ("sortOrder" >= 0);
ALTER TABLE "Experience" ADD CONSTRAINT "Experience_sortOrder_check" CHECK ("sortOrder" >= 0);
ALTER TABLE "Project" ADD CONSTRAINT "Project_sortOrder_check" CHECK ("sortOrder" >= 0);
