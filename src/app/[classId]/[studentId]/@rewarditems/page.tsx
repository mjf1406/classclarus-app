import React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { db } from "@/server/db";
import { reward_items } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Coins } from "lucide-react";
import { FontAwesomeIconClient } from "@/components/FontAwesomeIconClient";
import { APP_NAME } from "@/lib/constants";
import { DialogPortal } from "@radix-ui/react-dialog";

interface RewardItem {
  price: number;
  name: string;
  description?: string | null;
  icon?: string | null;
}

export default async function RewardItemsCard({
  params,
}: {
  params: Promise<{ classId: string; studentId: string }>;
}) {
  const { classId, studentId } = await params;

  const data: RewardItem[] = await db
    .select({
      price: reward_items.price,
      name: reward_items.name,
      description: reward_items.description,
      icon: reward_items.icon,
    })
    .from(reward_items)
    .where(eq(reward_items.class_id, classId));

  // Get top 5 reward items (assuming they're already ordered by popularity)
  const topRewardItems = data.slice(0, 5);

  const RewardItemsGrid = () => (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {data.map((item, index) => (
        <Card key={index} className="flex flex-col">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold">
                {item.name}
              </CardTitle>
              <div className="text-secondary flex items-center gap-1">
                <Coins size={30} />
                <span className="text-2xl font-bold">{item.price}</span>
              </div>
            </div>
            <CardDescription className="text-base text-gray-500">
              {item.description}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-grow">
            <div className="flex h-full items-center justify-center">
              {item.icon && (
                <FontAwesomeIconClient
                  icon={item.icon}
                  size={96}
                  className="text-accent"
                />
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return (
    <Card className="mx-auto w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Reward Items</CardTitle>
            <CardDescription>
              Take a look at all the things you can purchase with your{" "}
              {APP_NAME} points!
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="secondary" className="w-full">
                View all reward items
              </Button>
            </DialogTrigger>
            <DialogPortal>
              <DialogContent className="max-h-[80vh] !w-[90vw] !max-w-[90vw] overflow-auto">
                <DialogHeader>
                  <DialogTitle>Reward Items</DialogTitle>
                  <DialogDescription>
                    Browse all available reward items for redemption
                  </DialogDescription>
                </DialogHeader>
                <ScrollArea className="mt-4 h-full">
                  <RewardItemsGrid />
                </ScrollArea>
              </DialogContent>
            </DialogPortal>
          </Dialog>
          {topRewardItems.map((item, index) => (
            <div
              key={index}
              className="bg-background flex items-center justify-between rounded-lg border p-3"
            >
              <div className="flex items-center gap-3">
                {item.icon && (
                  <FontAwesomeIconClient
                    icon={item.icon}
                    size={24}
                    className="text-accent"
                  />
                )}
                <div>
                  <div className="font-medium">{item.name}</div>
                  {item.description && (
                    <div className="text-muted-foreground text-sm">
                      {item.description}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 text-amber-500">
                <Coins size={16} />
                <span className="font-bold">{item.price}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
