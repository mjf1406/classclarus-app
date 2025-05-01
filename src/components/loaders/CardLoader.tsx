import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

export default function CardLoader() {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center">
          {" "}
          <Loader2 className="mr-2 h-6 w-6 animate-spin" /> Loading Card...
        </CardTitle>
      </CardHeader>
      <CardContent className="flex h-full w-full items-center justify-center">
        <Loader2 className="h-24 w-24 animate-spin" />
      </CardContent>
    </Card>
  );
}
