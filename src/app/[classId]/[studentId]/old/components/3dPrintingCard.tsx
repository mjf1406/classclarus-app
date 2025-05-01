"use client";

import React, { useState, type FormEvent } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { AlertCircleIcon } from "lucide-react";

const FILAMENT_PRICE_PER_KG = 31000; // KRW
const MATERIAL_EFFICIENCY_FACTOR = 1.1; // percent - Accounts for filament waste
const PRINT_TIME_COST_PER_HOUR = 300; // KRW

const PrintCostCalculator = () => {
  const [printingTime, setPrintingTime] = useState<string>("");
  const [filamentWeight, setFilamentWeight] = useState<string>("");
  const [result, setResult] = useState<number | null>(null);
  const [timeError, setTimeError] = useState<string>("");
  const [weightError, setWeightError] = useState<string>("");

  const validateInputs = () => {
    let isValid = true;
    setTimeError("");
    setWeightError("");
    const time = parseFloat(printingTime);
    const weight = parseFloat(filamentWeight);

    // Validate printing time input
    if (printingTime.trim() === "" || isNaN(time)) {
      setTimeError("Please enter a valid printing time (in hours).");
      isValid = false;
    }

    // Validate filament weight input
    if (filamentWeight.trim() === "" || isNaN(weight)) {
      setWeightError("Please enter a valid filament weight (in grams).");
      isValid = false;
    }

    return isValid;
  };

  const computeProduct = () => {
    const time = parseFloat(printingTime);
    const weight = parseFloat(filamentWeight);

    const unitCost =
      (weight / 1000) * FILAMENT_PRICE_PER_KG * MATERIAL_EFFICIENCY_FACTOR;
    const addedMachineCost = time * PRINT_TIME_COST_PER_HOUR;
    const totalCost = unitCost + addedMachineCost;
    const points = Math.round(totalCost / 10 / 2);

    setResult(points);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (validateInputs()) {
      computeProduct();
    } else {
      setResult(null);
    }
  };

  return (
    <Card className="h-full w-full shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl font-bold">
          3D Printing Cost Calculator
        </CardTitle>
        <CardDescription className="text-gray-600">
          Enter the printing time (in hours) and filament weight (in grams)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Always reserve space for the result */}
        <div className="min-h-[2rem]">
          {result !== null && (
            <div className="text-lg">
              This 3D model costs <strong>{result} points</strong>.
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="printingTime"
              className="block text-sm font-medium text-gray-700"
            >
              Printing Time (hours)
            </label>
            <input
              id="printingTime"
              type="number"
              step="0.01"
              value={printingTime}
              onChange={(e) => setPrintingTime(e.target.value)}
              placeholder="e.g. 1.2"
              className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-indigo-500 focus:ring focus:ring-indigo-500 sm:text-sm"
            />
            {timeError && (
              <Alert className="border-none">
                <AlertDescription className="flex items-center gap-2 text-sm text-red-600">
                  <AlertCircleIcon /> {timeError}
                </AlertDescription>
              </Alert>
            )}
          </div>
          <div>
            <label
              htmlFor="filamentWeight"
              className="block text-sm font-medium text-gray-700"
            >
              Filament Weight (grams)
            </label>
            <input
              id="filamentWeight"
              type="number"
              step="0.01"
              value={filamentWeight}
              onChange={(e) => setFilamentWeight(e.target.value)}
              placeholder="e.g. 150"
              className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-indigo-500 focus:ring focus:ring-indigo-500 sm:text-sm"
            />
            {weightError && (
              <Alert className="border-none">
                <AlertDescription className="flex items-center gap-2 text-sm text-red-600">
                  <AlertCircleIcon /> {weightError}
                </AlertDescription>
              </Alert>
            )}
          </div>

          <Button type="submit" className="w-full">
            Calculate
          </Button>
        </form>
      </CardContent>
      <CardFooter />
    </Card>
  );
};

export default PrintCostCalculator;
