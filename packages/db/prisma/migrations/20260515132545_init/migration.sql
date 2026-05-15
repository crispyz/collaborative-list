-- CreateTable
CREATE TABLE "List" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "ownerToken" TEXT NOT NULL,
    "isFrozen" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "List_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TodoItem" (
    "id" UUID NOT NULL,
    "listId" UUID NOT NULL,
    "parentId" UUID,
    "position" DOUBLE PRECISION NOT NULL,
    "title" TEXT NOT NULL,
    "isDone" BOOLEAN NOT NULL DEFAULT false,
    "priceCents" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TodoItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TodoItem_listId_position_idx" ON "TodoItem"("listId", "position");

-- CreateIndex
CREATE INDEX "TodoItem_parentId_idx" ON "TodoItem"("parentId");

-- AddForeignKey
ALTER TABLE "TodoItem" ADD CONSTRAINT "TodoItem_listId_fkey" FOREIGN KEY ("listId") REFERENCES "List"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TodoItem" ADD CONSTRAINT "TodoItem_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "TodoItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
