"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { PointsByClassIdOptions } from "@/app/api/queryOptions";
import Loader from "@/components/Loader";

interface PointsTabProps {
  classId: string | null;
}

const PointsTab: React.FC<PointsTabProps> = ({ classId }) => {
  // Using our query options for fetching points data.
  const { data, isLoading, error } = useQuery(PointsByClassIdOptions(classId));

  if (isLoading) return <Loader />;
  if (error) {
    // Cast error to Error type to access the message property.
    const err = error;
    return <div>Error: {err.message}</div>;
  }

  return <pre>{JSON.stringify(data, null, 2)}</pre>;
};

export default PointsTab;
