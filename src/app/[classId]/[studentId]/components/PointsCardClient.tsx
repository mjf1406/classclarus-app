"use client";

import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTrophy,
  faAward,
  faFlag,
  faGift,
} from "@fortawesome/free-solid-svg-icons";
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DialogPortal } from "@radix-ui/react-dialog";

// This type represents a point record as passed from the server.
export type PointClient = {
  id: string;
  type: "positive" | "negative" | "redemption";
  number_of_points: number;
  created_date: string;
  behavior_name: string | null;
  reward_item_name: string | null;
};

type PointsCardProps = {
  pointsData: PointClient[];
};

const formatDateTime = (dateString: string) => {
  return new Date(dateString).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const aggregatePoints = (points: PointClient[]): PointClient[] => {
  const map = new Map<string, PointClient>();

  points.forEach((point) => {
    // Use behavior name for non-redemption records, and reward_item_name for redemptions
    const name =
      point.type === "redemption"
        ? point.reward_item_name
        : point.behavior_name;

    // Round the date to the minute
    const date = new Date(point.created_date);
    const roundedDate = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      date.getHours(),
      date.getMinutes(),
    ).toISOString();

    if (name && roundedDate) {
      const key = `${name}-${roundedDate}`;

      if (map.has(key)) {
        const existing = map.get(key)!;
        existing.number_of_points += point.number_of_points;
      } else {
        map.set(key, { ...point, created_date: roundedDate });
      }
    }
  });

  return Array.from(map.values());
};

const PointsCardClient: React.FC<PointsCardProps> = ({ pointsData }) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const sortPoints = (a: PointClient, b: PointClient) =>
    new Date(b.created_date).getTime() - new Date(a.created_date).getTime();

  const positivePoints = aggregatePoints(
    pointsData.filter((point) => point.type === "positive"),
  ).sort(sortPoints);

  const negativePoints = aggregatePoints(
    pointsData.filter((point) => point.type === "negative"),
  ).sort(sortPoints);

  const redemptionPoints = aggregatePoints(
    pointsData.filter((point) => point.type === "redemption"),
  ).sort(sortPoints);

  const recentPositivePoints = positivePoints.slice(0, 5);
  const recentNegativePoints = negativePoints.slice(0, 5);
  const recentRedemptionPoints = redemptionPoints.slice(0, 5);

  const totalPositivePoints = positivePoints.reduce(
    (sum, point) => sum + point.number_of_points,
    0,
  );
  const totalNegativePoints = negativePoints.reduce(
    (sum, point) => sum + point.number_of_points,
    0,
  );
  const totalRedemptionPoints = redemptionPoints.reduce(
    (sum, point) => sum + point.number_of_points,
    0,
  );
  const totalPoints =
    totalPositivePoints + totalNegativePoints + totalRedemptionPoints;

  const renderRows = (points: PointClient[], type: string) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{type === "redemption" ? "Reward" : "Activity"}</TableHead>
          <TableHead className="text-center">Points</TableHead>
          <TableHead className="text-right">Date</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {points.map((point) => (
          <TableRow
            key={point.id}
            className="transition-colors duration-200 hover:bg-blue-100 dark:hover:bg-gray-700"
          >
            <TableCell>
              {type === "redemption"
                ? point.reward_item_name
                : point.behavior_name}
            </TableCell>
            <TableCell className="text-center">
              {type === "positive"
                ? `+${point.number_of_points}`
                : point.number_of_points}
            </TableCell>
            <TableCell className="text-right text-gray-600 dark:text-gray-400">
              {formatDateTime(point.created_date)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  return (
    <>
      <Card className="mx-auto h-[600px] w-full">
        <CardHeader className="flex-none">
          <CardTitle>Points</CardTitle>
          <CardDescription>
            Take a look at your entire point history in this class!
          </CardDescription>
        </CardHeader>
        <CardContent className="flex h-[calc(100%-8rem)] flex-col gap-2">
          <Button
            className="w-full flex-none"
            variant="secondary"
            onClick={() => setIsDialogOpen(true)}
          >
            View entire point history
          </Button>

          <div className="flex flex-none flex-col items-center justify-center">
            <TooltipProvider>
              <Tooltip delayDuration={0}>
                <TooltipTrigger className="cursor-help">
                  <div className="my-2 flex items-center justify-center text-4xl font-bold text-yellow-500 dark:text-yellow-400">
                    <FontAwesomeIcon icon={faTrophy} className="mr-2" />
                    {totalPoints ?? 0}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Your current points.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <div className="mt-2 flex gap-12">
              <TooltipProvider>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger className="cursor-help">
                    <div className="flex items-center text-lg text-green-600 dark:text-green-400">
                      <FontAwesomeIcon icon={faAward} className="mr-2" />
                      {totalPositivePoints}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>The amount of positive points you&apos;ve earned.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger className="cursor-help">
                    <div className="flex items-center text-lg text-red-500 dark:text-red-400">
                      <FontAwesomeIcon icon={faFlag} className="mr-2" />
                      {totalNegativePoints}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>The sum of all negative points you&apos;ve received.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger className="cursor-help">
                    <div className="flex items-center text-lg text-blue-500 dark:text-blue-400">
                      <FontAwesomeIcon icon={faGift} className="mr-2" />
                      {totalRedemptionPoints}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      The total number of points you&apos;ve spent on rewards.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          <Tabs
            className="flex min-h-0 flex-1 flex-col"
            defaultValue="positive"
          >
            <TabsList className="bg-primary grid w-full flex-none grid-cols-3">
              <TabsTrigger value="positive">
                <FontAwesomeIcon icon={faAward} className="mr-2" /> Positive
              </TabsTrigger>
              <TabsTrigger value="negative">
                <FontAwesomeIcon icon={faFlag} className="mr-2" /> Negative
              </TabsTrigger>
              <TabsTrigger value="redemptions">
                <FontAwesomeIcon icon={faGift} className="mr-2" /> Redemptions
              </TabsTrigger>
            </TabsList>

            <div className="h-full min-h-0 flex-1">
              <TabsContent
                value="positive"
                className="h-full bg-green-50 p-4 dark:bg-gray-800"
              >
                {renderRows(recentPositivePoints, "positive")}
              </TabsContent>
              <TabsContent
                value="negative"
                className="h-full bg-red-50 p-4 dark:bg-gray-800"
              >
                {renderRows(recentNegativePoints, "negative")}
              </TabsContent>
              <TabsContent
                value="redemptions"
                className="h-full bg-blue-50 p-4 dark:bg-gray-800"
              >
                {renderRows(recentRedemptionPoints, "redemption")}
              </TabsContent>
            </div>
          </Tabs>
        </CardContent>
      </Card>

      {/* Full History Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogPortal>
          <DialogContent className="max-h-[80vh] !w-[90vw] !max-w-[90vw] overflow-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl text-blue-700 dark:text-blue-300">
                📖 Points History
              </DialogTitle>
              <DialogDescription className="text-gray-600 dark:text-gray-400">
                View the complete history of points for the student.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 flex flex-1 flex-col">
              <Tabs className="flex h-full flex-col" defaultValue="positive">
                <TabsList className="grid flex-shrink-0 grid-cols-3 rounded-t-md bg-blue-100 dark:bg-gray-600">
                  <TabsTrigger
                    value="positive"
                    className="font-semibold text-blue-700 dark:text-blue-300"
                  >
                    😊 Positive
                  </TabsTrigger>
                  <TabsTrigger
                    value="negative"
                    className="font-semibold text-red-700 dark:text-red-300"
                  >
                    😞 Negative
                  </TabsTrigger>
                  <TabsTrigger
                    value="redemptions"
                    className="font-semibold text-blue-700 dark:text-blue-300"
                  >
                    🎁 Redemptions
                  </TabsTrigger>
                </TabsList>
                <TabsContent
                  value="positive"
                  className="max-h-[70vh] flex-1 overflow-y-scroll bg-green-50 p-4 dark:bg-gray-800"
                >
                  {renderRows(positivePoints, "positive")}
                </TabsContent>
                <TabsContent
                  value="negative"
                  className="flex-1 overflow-auto bg-red-50 p-4 dark:bg-gray-800"
                >
                  {renderRows(negativePoints, "negative")}
                </TabsContent>
                <TabsContent
                  value="redemptions"
                  className="flex-1 overflow-auto bg-blue-50 p-4 dark:bg-gray-800"
                >
                  {renderRows(redemptionPoints, "redemption")}
                </TabsContent>
              </Tabs>
            </div>
            <DialogFooter className="mt-4">
              <Button
                variant="secondary"
                onClick={() => setIsDialogOpen(false)}
                className="rounded-md bg-blue-500 px-6 py-2 text-white transition-colors duration-200 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700"
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </DialogPortal>
      </Dialog>
    </>
  );
};

export default PointsCardClient;
